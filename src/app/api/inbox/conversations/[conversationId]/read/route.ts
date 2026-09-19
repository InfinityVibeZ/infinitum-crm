import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";
import { buildConversationReadEvent } from "@/lib/inbox/realtime-events";
import { emitInboxRealtime } from "@/lib/inbox/realtime-emit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        company_id: user.companyId,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const currentMetadata = conversation.metadata as Record<string, any> || {};

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          ...currentMetadata,
          lastReadAt: new Date().toISOString(),
        },
      },
    });

    // Realtime (Phase 3.8.7.2): best-effort, after the read state persisted.
    // companyId derives from the authenticated server-side session.
    emitInboxRealtime(
      buildConversationReadEvent({
        companyId: user.companyId,
        conversationId,
        userId: user.id,
        readAt: new Date(),
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Inbox Conversation Read API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
