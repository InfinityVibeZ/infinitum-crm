import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { sendInstagramMessage } from "@/lib/integrations/providers/meta";
import { buildOutboundMessageEvent } from "@/lib/inbox/realtime-events";
import { emitInboxRealtime } from "@/lib/inbox/realtime-emit";

/**
 * Phase 3.8.5 — Outbound Instagram text messaging.
 *
 * POST /api/inbox/conversations/[conversationId]/messages
 *
 * Sends a plain-text outbound message over an Instagram conversation.
 * Server-side validation is authoritative. Tenant isolation uses the same
 * company_id-scoped lookup as the existing GET handler. The access token
 * is never logged or persisted; provider error responses are reduced to
 * safe code/message fields.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    // ── Validate body (server-side authoritative) ─────────────────────────
    let body: { text?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { error: "Message text must be 1000 characters or fewer" },
        { status: 400 }
      );
    }

    // ── Tenant-scoped conversation lookup (same pattern as GET) ────────────
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        company_id: user.companyId,
      },
      include: {
        integration: {
          select: { id: true, isActive: true, provider: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.channel.toUpperCase() !== "INSTAGRAM") {
      return NextResponse.json(
        { error: "Outbound messaging is only supported for Instagram conversations" },
        { status: 400 }
      );
    }

    if (!conversation.integration_id || !conversation.integration?.isActive) {
      return NextResponse.json(
        { error: "Conversation is not connected to an active Instagram integration" },
        { status: 400 }
      );
    }

    // ── Resolve the customer's Instagram recipient ID ──────────────────────
    // Preferred: the CUSTOMER participant's external_identity_id.
    // Fallback: parse from external_conversation_id
    //   (format: `${businessIgId}_${customerIgId}` per the normalizer).
    let recipientIgId: string | null = null;

    const customerParticipant = await prisma.conversationParticipant.findFirst({
      where: {
        conversation_id: conversationId,
        role: "CUSTOMER",
        external_identity_id: { not: null },
      },
      select: { external_identity_id: true },
    });

    if (customerParticipant?.external_identity_id) {
      recipientIgId = customerParticipant.external_identity_id;
    } else if (conversation.external_conversation_id) {
      const parts = conversation.external_conversation_id.split("_");
      if (parts.length === 2 && parts[1]) {
        recipientIgId = parts[1];
      }
    }

    if (!recipientIgId) {
      return NextResponse.json(
        { error: "Unable to resolve recipient Instagram ID for this conversation" },
        { status: 400 }
      );
    }

    // ── Duplicate-send protection ─────────────────────────────────────────
    // If the exact same text was already sent by the same user to the same
    // conversation within the last 5 seconds, treat it as a double-click
    // / retry and reject it.
    const dedupeWindowMs = 5_000;
    const recentDuplicate = await prisma.message.findFirst({
      where: {
        conversation_id: conversationId,
        direction: "OUTBOUND",
        sender_user_id: user.id,
        content: text,
        created_at: { gte: new Date(Date.now() - dedupeWindowMs) },
      },
      select: { id: true },
    });

    if (recentDuplicate) {
      return NextResponse.json(
        { error: "Duplicate message — this exact message was just sent" },
        { status: 409 }
      );
    }

    // ── Load + decrypt integration credentials ────────────────────────────
    const credentialsRecord = await prisma.integrationCredential.findUnique({
      where: { integrationId: conversation.integration_id },
      select: { encryptedData: true },
    });

    if (!credentialsRecord?.encryptedData) {
      return NextResponse.json(
        { error: "Instagram integration credentials are missing" },
        { status: 400 }
      );
    }

    let credentials: any;
    try {
      const decryptedData = decrypt(credentialsRecord.encryptedData);
      credentials =
        typeof decryptedData === "string"
          ? JSON.parse(decryptedData)
          : decryptedData;
    } catch {
      return NextResponse.json(
        { error: "Instagram integration credentials are invalid" },
        { status: 400 }
      );
    }

    // ── Send via Instagram Messaging API ──────────────────────────────────
    const sendResult = await sendInstagramMessage(credentials, recipientIgId, text);

    if (sendResult.ok) {
      // ── Success: persist the sent message ──────────────────────────────
      const message = await prisma.message.create({
        data: {
          company_id: user.companyId,
          conversation_id: conversationId,
          external_message_id: sendResult.externalMessageId,
          direction: "OUTBOUND",
          sender_type: "USER",
          sender_user_id: user.id,
          content: text,
          content_type: "TEXT",
          status: "SENT",
          metadata: {
            provider: "INSTAGRAM",
            recipientIgId,
          },
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { last_message_at: new Date() },
      });

      // Realtime (Phase 3.8.7.2): best-effort, after persistence succeeded.
      // Never affects the REST response; companyId comes from the
      // authenticated server-side session, never from the client body.
      emitInboxRealtime(
        buildOutboundMessageEvent({
          companyId: user.companyId,
          conversationId,
          messageId: message.id,
          content: message.content,
          status: message.status,
          senderUserId: user.id,
          createdAt: message.created_at,
          lastMessageAt: message.created_at,
        })
      );

      return NextResponse.json({ message }, { status: 201 });
    }

    // ── Failure: persist a FAILED record (externalMessageId = null unless
    // Meta actually returned one, which only happens on success) ──────────
    const failedMessage = await prisma.message.create({
      data: {
        company_id: user.companyId,
        conversation_id: conversationId,
        external_message_id: null,
        direction: "OUTBOUND",
        sender_type: "USER",
        sender_user_id: user.id,
        content: text,
        content_type: "TEXT",
        status: "FAILED",
        error_code: sendResult.errorCode ?? null,
        error_message: sendResult.errorMessage ?? null,
        metadata: {
          provider: "INSTAGRAM",
          recipientIgId,
        },
      },
    });

    return NextResponse.json(
      {
        error: "Failed to send message",
        message: failedMessage,
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("Inbox Messages POST API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const cursor = searchParams.get("cursor");
    const search = searchParams.get("search")?.trim().slice(0, 100) || "";

    // Validate access
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        company_id: user.companyId,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversation_id: conversationId,
        ...(search
          ? { content: { contains: search, mode: "insensitive" } }
          : {}),
      },
      orderBy: { created_at: "desc" },
      take: limit + 1,
      include: {
        sender_user: {
          select: { id: true, name: true, email: true },
        },
      },
      ...(cursor && {
        cursor: { id: cursor },
      }),
    });

    let nextCursor: string | null = null;
    if (messages.length > limit) {
      const nextItem = messages.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({ messages: messages.reverse(), nextCursor });
  } catch (error) {
    console.error("Inbox Messages GET API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
