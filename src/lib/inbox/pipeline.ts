/**
 * Phase 3.8.2 — Unified Inbox Pipeline
 *
 * Takes a NormalizedInboxEvent and:
 * 1. Resolves the Integration (trusts integrationId, never external IDs)
 * 2. Derives companyId exclusively from the Integration
 * 3. Resolves/creates Contact via the existing identity engine
 * 4. Upserts Conversation (idempotent on integrationId + externalConversationId)
 * 5. Upserts Message (idempotent on conversationId + externalMessageId)
 * 6. Updates Conversation.last_message_at
 *
 * Never trusts companyId from an external webhook payload.
 * Never crashes if an event is malformed — returns a typed error result.
 */

import { prisma } from "../prisma";
import { resolveContactIdentity } from "../integrations/identity-service";
import type { NormalizedInboxEvent, InboxPipelineResult } from "./types";
import { Prisma } from "@prisma/client";

// ── Pipeline Error ────────────────────────────────────────────────────────────

export class InboxPipelineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INTEGRATION_NOT_FOUND"
      | "INTEGRATION_INACTIVE"
      | "IDENTITY_CONFLICT"
      | "CONTACT_RESOLUTION_FAILED"
      | "TENANT_MISMATCH"
  ) {
    super(message);
    this.name = "InboxPipelineError";
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Processes a single NormalizedInboxEvent through the inbox pipeline.
 *
 * All DB writes are wrapped in a transaction for atomicity.
 * Idempotent: calling twice with the same event is safe — the second
 * call returns messageStatus: "EXISTING" without modifying any data.
 */
export async function processInboxEvent(
  event: NormalizedInboxEvent
): Promise<InboxPipelineResult> {
  // ── Step 1: Resolve Integration ──────────────────────────────────────────
  const integration = await prisma.integration.findUnique({
    where: { id: event.integrationId },
    select: { id: true, companyId: true, isActive: true, provider: true },
  });

  if (!integration) {
    throw new InboxPipelineError(
      `Integration ${event.integrationId} not found`,
      "INTEGRATION_NOT_FOUND"
    );
  }

  if (!integration.isActive) {
    throw new InboxPipelineError(
      `Integration ${event.integrationId} is inactive`,
      "INTEGRATION_INACTIVE"
    );
  }

  // ── Step 2: Derive companyId from Integration — NEVER from payload ───────
  const companyId = integration.companyId;

  // ── Step 3: Resolve Contact via identity engine (OUTSIDE TRANSACTION) ────
  const identityResult = await resolveContactIdentity(prisma, {
    companyId,
    provider: event.provider,
    externalId: event.externalSenderId,
    integrationId: event.integrationId,
    contactData: {
      // Sender name is unknown from messaging events; enrich later if needed
      name: `${event.channel} User`,
    },
  });

  if (identityResult.status === "CONFLICT") {
    throw new InboxPipelineError(
      `Identity conflict for sender ${event.externalSenderId} in company ${companyId}`,
      "IDENTITY_CONFLICT"
    );
  }

  const contactId = identityResult.contactId;
  if (!contactId) {
    throw new InboxPipelineError(
      `Failed to resolve or create contact for sender ${event.externalSenderId}`,
      "CONTACT_RESOLUTION_FAILED"
    );
  }

  // ── Steps 4-6: Transactional ─────────────────────────────────────────────
  return await prisma.$transaction(async (tx) => {
    // Step 4: Upsert Conversation
    // Idempotent on (integration_id, external_conversation_id) unique constraint.
    // For conversations without an externalConversationId (shouldn't happen but
    // handled defensively), we create a new conversation each time.
    let conversationStatus: "CREATED" | "EXISTING" = "CREATED";

    const existingConversation = event.externalConversationId
      ? await tx.conversation.findFirst({
          where: {
            integration_id: event.integrationId,
            external_conversation_id: event.externalConversationId,
          },
          select: { id: true },
        })
      : null;

    let conversationId: string;

    if (existingConversation) {
      conversationId = existingConversation.id;
      conversationStatus = "EXISTING";
    } else {
      const newConversation = await tx.conversation.create({
        data: {
          company_id: companyId,
          contact_id: contactId,
          integration_id: event.integrationId,
          channel: event.channel,
          external_conversation_id: event.externalConversationId,
          status: "OPEN",
          last_message_at: event.timestamp,
          metadata: {
            openedBy: event.provider,
            firstMessageId: event.externalMessageId,
          },
        },
        select: { id: true },
      });
      conversationId = newConversation.id;

      // Add sender as a participant
      await tx.conversationParticipant.create({
        data: {
          conversation_id: conversationId,
          contact_id: contactId,
          external_identity_id: event.externalSenderId,
          role: "CUSTOMER",
        },
      });
    }

    // Step 5: Upsert Message
    // Idempotent on (conversation_id, external_message_id).
    let messageStatus: "CREATED" | "EXISTING" = "CREATED";
    let messageId: string;

    const existingMessage = await tx.message.findFirst({
      where: {
        conversation_id: conversationId,
        external_message_id: event.externalMessageId,
      },
      select: { id: true },
    });

    if (existingMessage) {
      messageId = existingMessage.id;
      messageStatus = "EXISTING";
    } else {
      const newMessage = await tx.message.create({
        data: {
          company_id: companyId,
          conversation_id: conversationId,
          external_message_id: event.externalMessageId,
          direction: event.direction,
          sender_type: "CONTACT",
          sender_contact_id: contactId,
          content: event.text ?? "",
          content_type: event.contentType,
          status: "DELIVERED",
          metadata: {
            attachments: event.attachments as unknown as Prisma.InputJsonValue,
            raw: event.raw as Prisma.InputJsonValue,
            provider: event.provider,
            channel: event.channel,
            externalSenderId: event.externalSenderId,
          } satisfies Prisma.InputJsonObject,
        },
        select: { id: true },
      });
      messageId = newMessage.id;

      // Step 6: Update Conversation.last_message_at
      await tx.conversation.update({
        where: { id: conversationId },
        data: { last_message_at: event.timestamp },
      });
    }

    return {
      conversationId,
      messageId,
      contactId,
      messageStatus,
      conversationStatus,
    };
  });
}
