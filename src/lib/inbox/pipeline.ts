/**
 * Phase 3.8.2 — Unified Inbox Pipeline
 *
 * Takes a NormalizedInboxEvent and:
 * 1. Resolves the Integration
 * 2. Derives companyId exclusively from the Integration
 * 3. Resolves/creates Contact via the existing identity engine
 * 4. Resolves/creates Conversation
 * 5. Resolves/creates Conversation Participant
 * 6. Upserts Message
 * 7. Updates Conversation.last_message_at
 *
 * Conversation recovery:
 * - First searches by integrationId + externalConversationId.
 * - If not found, searches for a legacy conversation belonging to the
 *   same company/channel/externalConversationId where integration_id is NULL.
 * - If found, reattaches that conversation to the current integration.
 *
 * This prevents duplicate conversations when an integration is
 * disconnected and later reconnected.
 *
 * Security:
 * - Never trusts companyId from an external webhook payload.
 * - Company ownership comes exclusively from the Integration.
 * - Legacy conversation recovery is tenant-scoped.
 *
 * Idempotency:
 * - Conversation: integrationId + externalConversationId
 * - Message: conversationId + externalMessageId
 * - Participant: conversationId + contactId + externalIdentityId + role
 */

import { prisma } from "../prisma";
import { decrypt } from "@/lib/encryption";
import { getInstagramUserProfile } from "../integrations/providers/meta";
import { resolveContactIdentity } from "../integrations/identity-service";
import type {
  NormalizedInboxEvent,
  InboxPipelineResult,
} from "./types";
import { buildNewMessageEvent, buildConversationUpdatedEvent } from "./realtime-events";
import { emitInboxRealtime } from "./realtime-emit";
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Error
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a single NormalizedInboxEvent through the inbox pipeline.
 *
 * All DB writes are wrapped in a transaction for atomicity.
 *
 * Idempotent:
 * - Calling twice with the same event is safe.
 * - The second call returns messageStatus: "EXISTING".
 *
 * Conversation recovery:
 * - Existing current conversation is reused.
 * - Legacy conversation with NULL integration_id is reattached.
 * - Only a tenant-safe legacy conversation can be recovered.
 */
export async function processInboxEvent(
  event: NormalizedInboxEvent
): Promise<InboxPipelineResult> {
  console.log("[REALTIME DEBUG] PIPELINE START", {
    integrationId: event.integrationId,
    provider: event.provider,
    channel: event.channel,
    externalMessageId: event.externalMessageId,
    externalConversationId: event.externalConversationId,
    externalSenderId: event.externalSenderId,
    direction: event.direction,
    timestamp: event.timestamp,
  });
  // ───────────────────────────────────────────────────────────────────────────
  // Step 1: Resolve Integration
  // ───────────────────────────────────────────────────────────────────────────

  const integration = await prisma.integration.findUnique({
    where: {
      id: event.integrationId,
    },
    select: {
      id: true,
      companyId: true,
      isActive: true,
      provider: true,
    },
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

  // ───────────────────────────────────────────────────────────────────────────
  // Step 2: Derive companyId from Integration
  // NEVER from webhook payload
  // ───────────────────────────────────────────────────────────────────────────

  const companyId = integration.companyId;

  // ───────────────────────────────────────────────────────────────────────────
  // Step 2.1: Resolve Instagram sender profile
  // ───────────────────────────────────────────────────────────────────────────
  //
  // The webhook gives us the sender's Instagram ID, but not necessarily
  // the human-readable username/name.
  //
  // Resolve it using the access token belonging to this tenant's
  // Instagram integration.
  //
  // This is best-effort. Failure must never prevent the message
  // from entering the inbox.

  let instagramProfile:
    | {
      id: string;
      username?: string;
      name?: string;
      profilePictureUrl?: string;
    }
    | null = null;

  if (
    event.provider === "INSTAGRAM" &&
    event.channel === "INSTAGRAM"
  ) {
    try {
      const credentialsRecord =
        await prisma.integrationCredential.findUnique({
          where: {
            integrationId: event.integrationId,
          },
          select: {
            encryptedData: true,
          },
        });

      if (credentialsRecord?.encryptedData) {
        const decryptedData = decrypt(
          credentialsRecord.encryptedData
        );

        const credentials =
          typeof decryptedData === "string"
            ? JSON.parse(decryptedData)
            : decryptedData;

        instagramProfile =
          await getInstagramUserProfile(
            credentials,
            event.externalSenderId
          );

        if (instagramProfile) {
          console.log(
            "[Inbox] Instagram sender profile resolved:",
            {
              senderId: event.externalSenderId,
              username:
                instagramProfile.username ?? null,
              hasName:
                !!instagramProfile.name,
              hasProfilePicture:
                !!instagramProfile.profilePictureUrl,
            }
          );
        }
      }
    } catch (error) {
      console.warn(
        "[Inbox] Instagram profile enrichment failed; continuing without profile:",
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Step 3: Resolve Contact via identity engine
  // ───────────────────────────────────────────────────────────────────────────

  const instagramDisplayName =
    instagramProfile?.name ||
    instagramProfile?.username ||
    null;

  const identityResult = await resolveContactIdentity(prisma, {
    companyId,
    provider: event.provider,
    externalId: event.externalSenderId,
    integrationId: event.integrationId,

    contactData: {
      name:
        instagramDisplayName ||
        `${event.channel} User`,

      customFields:
        instagramProfile
          ? {
            instagram: {
              username:
                instagramProfile.username ?? null,
              name:
                instagramProfile.name ?? null,
              externalId:
                instagramProfile.id,
              profilePictureUrl:
                instagramProfile.profilePictureUrl ?? null,
            },
          }
          : undefined,
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

  // ───────────────────────────────────────────────────────────────────────────
  // Step 3.1: Enrich existing Instagram contact
  // ───────────────────────────────────────────────────────────────────────────
  //
  // The identity engine may have already resolved an existing Contact.
  //
  // Older Instagram contacts may have been created as:
  // "INSTAGRAM User"
  //
  // Only replace the placeholder.
  // Never overwrite a real CRM contact name.

  if (
    event.provider === "INSTAGRAM" &&
    instagramProfile
  ) {
    const instagramDisplayName =
      instagramProfile.name ||
      instagramProfile.username;

    if (instagramDisplayName || instagramProfile.profilePictureUrl) {
      const existingContact =
        await prisma.contact.findUnique({
          where: {
            id: contactId,
          },
          select: {
            id: true,
            name: true,
            customFields: true,
          },
        });

      if (existingContact) {
        const existingCustomFields =
          existingContact.customFields &&
            typeof existingContact.customFields === "object" &&
            !Array.isArray(existingContact.customFields)
            ? existingContact.customFields
            : {};

        const existingInstagram =
          existingCustomFields.instagram &&
            typeof existingCustomFields.instagram === "object" &&
            !Array.isArray(existingCustomFields.instagram)
            ? existingCustomFields.instagram
            : {};

        await prisma.contact.update({
          where: { id: contactId },
          data: {
            ...(instagramDisplayName &&
            (!existingContact.name ||
              existingContact.name === "INSTAGRAM User" ||
              existingContact.name === "Unknown")
              ? { name: instagramDisplayName }
              : {}),
            customFields: {
              ...existingCustomFields,
              instagram: {
                ...existingInstagram,
                username: instagramProfile.username ?? null,
                name: instagramProfile.name ?? null,
                externalId: instagramProfile.id,
                profilePictureUrl:
                  instagramProfile.profilePictureUrl ??
                  existingInstagram.profilePictureUrl ??
                  null,
              },
            },
          },
        });

        console.log(
          "[Inbox] Instagram contact enriched:",
          {
            contactId,
            name: instagramDisplayName,
            username:
              instagramProfile.username ?? null,
            externalId:
              instagramProfile.id,
            hasProfilePicture:
              !!instagramProfile.profilePictureUrl,
          }
        );
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Steps 4-7: Transactional
  // ───────────────────────────────────────────────────────────────────────────

  const txResult = await prisma.$transaction(async (tx) => {
    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Resolve / Upsert Conversation
    // ─────────────────────────────────────────────────────────────────────────
    //
    // Primary lookup:
    //
    //   integration_id
    //   +
    //   external_conversation_id
    //
    // Legacy recovery:
    //
    // Some historical conversations were created before the integration
    // was attached. Those conversations can have:
    //
    //   integration_id = NULL
    //
    // We recover them only when all of these match:
    //
    //   company_id
    //   channel
    //   external_conversation_id
    //   integration_id IS NULL
    //
    // This prevents cross-tenant recovery.

    let conversationStatus: "CREATED" | "EXISTING" = "CREATED";

    let existingConversation =
      event.externalConversationId
        ? await tx.conversation.findFirst({
          where: {
            integration_id: event.integrationId,
            external_conversation_id:
              event.externalConversationId,
          },

          select: {
            id: true,
            contact_id: true,
          },
        })
        : null;

    let conversationId: string;

    // ─────────────────────────────────────────────────────────────────────────
    // Case 1: Existing conversation already linked to integration
    // ─────────────────────────────────────────────────────────────────────────

    if (existingConversation) {
      conversationId = existingConversation.id;
      conversationStatus = "EXISTING";

      // Keep contact relationship synchronized.
      if (
        existingConversation.contact_id !== contactId
      ) {
        await tx.conversation.update({
          where: {
            id: conversationId,
          },
          data: {
            contact_id: contactId,
          },
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Case 2: Legacy conversation recovery
    // ─────────────────────────────────────────────────────────────────────────
    //
    // This is the important reconnect fix.
    //
    // Example:
    //
    // OLD:
    //   company_id = X
    //   channel = INSTAGRAM
    //   external_conversation_id = ABC
    //   integration_id = NULL
    //
    // NEW:
    //   integration_id = CURRENT_INSTAGRAM_INTEGRATION
    //
    // Instead of creating a new conversation, attach the old conversation
    // to the current integration.

    else if (event.externalConversationId) {
      const legacyConversation =
        await tx.conversation.findFirst({
          where: {
            company_id: companyId,
            channel: event.channel,
            external_conversation_id:
              event.externalConversationId,
            integration_id: null,
          },

          select: {
            id: true,
            contact_id: true,
          },
        });

      if (legacyConversation) {
        await tx.conversation.update({
          where: {
            id: legacyConversation.id,
          },

          data: {
            integration_id: event.integrationId,
            contact_id: contactId,
          },
        });

        conversationId = legacyConversation.id;
        conversationStatus = "EXISTING";

        console.log(
          "[Inbox] Reattached legacy conversation:",
          {
            conversationId,
            integrationId: event.integrationId,
            companyId,
            channel: event.channel,
            externalConversationId:
              event.externalConversationId,
          }
        );
      }

      // ───────────────────────────────────────────────────────────────────────
      // Case 3: No existing/legacy conversation → create new
      // ───────────────────────────────────────────────────────────────────────

      else {
        const newConversation =
          await tx.conversation.create({
            data: {
              company_id: companyId,
              contact_id: contactId,
              integration_id: event.integrationId,
              channel: event.channel,
              external_conversation_id:
                event.externalConversationId,
              status: "OPEN",
              last_message_at: event.timestamp,

              metadata: {
                openedBy: event.provider,
                firstMessageId:
                  event.externalMessageId,
              },
            },

            select: {
              id: true,
            },
          });

        conversationId = newConversation.id;
        conversationStatus = "CREATED";
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Case 4: No external conversation ID
    // ─────────────────────────────────────────────────────────────────────────
    //
    // Defensive fallback.
    //
    // Normally Instagram/Facebook message events should have an
    // externalConversationId.

    else {
      const newConversation =
        await tx.conversation.create({
          data: {
            company_id: companyId,
            contact_id: contactId,
            integration_id: event.integrationId,
            channel: event.channel,
            external_conversation_id:
              event.externalConversationId,
            status: "OPEN",
            last_message_at: event.timestamp,

            metadata: {
              openedBy: event.provider,
              firstMessageId:
                event.externalMessageId,
            },
          },

          select: {
            id: true,
          },
        });

      conversationId = newConversation.id;
      conversationStatus = "CREATED";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5: Resolve / Upsert Conversation Participant
    // ─────────────────────────────────────────────────────────────────────────
    //
    // Previously the participant was only created when a NEW conversation
    // was created.
    //
    // That could result in duplicate/missing participants when a legacy
    // conversation was recovered or an existing conversation received
    // another event.
    //
    // We now always check before creating.

    const existingParticipant =
      await tx.conversationParticipant.findFirst({
        where: {
          conversation_id: conversationId,
          contact_id: contactId,
          external_identity_id:
            event.externalSenderId,
          role: "CUSTOMER",
        },

        select: {
          id: true,
        },
      });

    if (!existingParticipant) {
      await tx.conversationParticipant.create({
        data: {
          conversation_id: conversationId,
          contact_id: contactId,
          external_identity_id:
            event.externalSenderId,
          role: "CUSTOMER",
        },
      });

      console.log(
        "[Inbox] Customer participant created:",
        {
          conversationId,
          contactId,
          externalIdentityId:
            event.externalSenderId,
        }
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 6: Upsert Message
    // ─────────────────────────────────────────────────────────────────────────
    //
    // Idempotency:
    //
    //   conversation_id
    //   +
    //   external_message_id
    //
    // If Meta retries the same webhook, we don't create a duplicate message.

    let messageStatus:
      | "CREATED"
      | "EXISTING" = "CREATED";

    let messageId: string;

    const existingMessage =
      await tx.message.findFirst({
        where: {
          conversation_id: conversationId,
          external_message_id:
            event.externalMessageId,
        },

        select: {
          id: true,
        },
      });

    if (existingMessage) {
      messageId = existingMessage.id;
      messageStatus = "EXISTING";

      // Do not modify the message.
      // The webhook is a duplicate/retry.
    } else {
      const newMessage =
        await tx.message.create({
          data: {
            company_id: companyId,
            conversation_id: conversationId,

            external_message_id:
              event.externalMessageId,

            direction: event.direction,

            sender_type: "CONTACT",

            sender_contact_id: contactId,

            content: event.text ?? "",

            content_type: event.contentType,

            status: "DELIVERED",

            metadata: {
              attachments:
                event.attachments as unknown as Prisma.InputJsonValue,

              raw:
                event.raw as unknown as Prisma.InputJsonValue,

              provider: event.provider,

              channel: event.channel,

              externalSenderId:
                event.externalSenderId,
            } satisfies Prisma.InputJsonObject,
          },

          select: {
            id: true,
          },
        });

      messageId = newMessage.id;
      messageStatus = "CREATED";

      // ───────────────────────────────────────────────────────────────────────
      // Step 7: Update Conversation.last_message_at
      // ───────────────────────────────────────────────────────────────────────

      await tx.conversation.update({
        where: {
          id: conversationId,
        },

        data: {
          last_message_at: event.timestamp,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Result
    // ─────────────────────────────────────────────────────────────────────────

    return {
      conversationId,
      messageId,
      contactId,
      messageStatus,
      conversationStatus,
    };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Realtime (Phase 3.8.7.2) — best-effort, AFTER the transaction COMMITTED.
  // Never blocks or fails the pipeline; carries no persistence semantics.
  // companyId comes from the Integration (server-side), never the webhook.
  // Only newly-created messages emit events — Meta webhook retries (the
  // idempotent EXISTING path) publish nothing.
  // ───────────────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  // Realtime — diagnostic instrumentation
  // ───────────────────────────────────────────────────────────────────────────

  console.log("[REALTIME DEBUG] PIPELINE TRANSACTION COMPLETE", {
    integrationId: event.integrationId,
    provider: event.provider,
    channel: event.channel,
    companyId,
    conversationId: txResult.conversationId,
    messageId: txResult.messageId,
    messageStatus: txResult.messageStatus,
    conversationStatus: txResult.conversationStatus,
    externalMessageId: event.externalMessageId,
    externalConversationId: event.externalConversationId,
    direction: event.direction,
  });

  if (txResult.messageStatus === "CREATED") {
    console.log("[REALTIME DEBUG] PIPELINE CREATING new_message EVENT", {
      companyId,
      conversationId: txResult.conversationId,
      messageId: txResult.messageId,
      direction: event.direction,
      contentType: event.contentType,
      createdAt: event.timestamp,
    });

    const newMessageEvent = buildNewMessageEvent({
      companyId,
      conversationId: txResult.conversationId,
      messageId: txResult.messageId,
      content: event.text,
      contentType: event.contentType,
      direction: event.direction,
      senderType: "CONTACT",
      senderContactId: txResult.contactId,
      createdAt: event.timestamp,
      lastMessageAt: event.timestamp,
      conversationStatus: txResult.conversationStatus,
      messageStatus: txResult.messageStatus,
    });

    console.log(
      "[REALTIME DEBUG] PIPELINE CALLING emitInboxRealtime(new_message)",
      {
        event: newMessageEvent,
      }
    );

    try {
      emitInboxRealtime(newMessageEvent);

      console.log(
        "[REALTIME DEBUG] PIPELINE emitInboxRealtime(new_message) CALLED"
      );
    } catch (error) {
      console.error(
        "[REALTIME DEBUG] PIPELINE emitInboxRealtime(new_message) THREW",
        error
      );
    }

    console.log(
      "[REALTIME DEBUG] PIPELINE CREATING conversation_updated EVENT",
      {
        companyId,
        conversationId: txResult.conversationId,
        channel: event.channel,
        lastMessageAt: event.timestamp,
      }
    );

    const conversationUpdatedEvent = buildConversationUpdatedEvent({
      companyId,
      conversationId: txResult.conversationId,
      channel: event.channel,
      status: "OPEN",
      lastMessageAt: event.timestamp,
      lastMessagePreview: event.text
        ? event.text.slice(0, 160)
        : null,
      lastMessageDirection: event.direction,
      profilePictureUrl: instagramProfile?.profilePictureUrl ?? null,
    });

    console.log(
      "[REALTIME DEBUG] PIPELINE CALLING emitInboxRealtime(conversation_updated)",
      {
        event: conversationUpdatedEvent,
      }
    );

    try {
      emitInboxRealtime(conversationUpdatedEvent);

      console.log(
        "[REALTIME DEBUG] PIPELINE emitInboxRealtime(conversation_updated) CALLED"
      );
    } catch (error) {
      console.error(
        "[REALTIME DEBUG] PIPELINE emitInboxRealtime(conversation_updated) THREW",
        error
      );
    }
  } else {
    console.log("[REALTIME DEBUG] PIPELINE SKIPPING REALTIME", {
      reason: "messageStatus !== CREATED",
      messageStatus: txResult.messageStatus,
      messageId: txResult.messageId,
      conversationId: txResult.conversationId,
      externalMessageId: event.externalMessageId,
    });
  }

  return txResult;
}