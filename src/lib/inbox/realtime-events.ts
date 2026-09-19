/**
 * Phase 3.8.7.2 — Safe realtime payload builders for Inbox events.
 *
 * Pure functions: no DB access, no side effects. Every payload contains
 * ONLY fields already exposed by the existing Inbox REST APIs — never
 * tokens, credentials, or provider secrets. companyId comes exclusively
 * from the server-side persisted relationship (Integration/Conversation),
 * never from a webhook payload or browser input.
 */
import type { RealtimeEvent } from "@/realtime/events";
import type { NormalizedInboxEvent } from "./types";

/** Preview text length used by the Inbox list — keep payloads small. */
const PREVIEW_LENGTH = 160;

export function buildNewMessageEvent(input: {
  companyId: string;
  conversationId: string;
  messageId: string;
  content: string | null;
  contentType: string;
  direction: string;
  senderType: string;
  senderContactId?: string | null;
  senderUserId?: string | null;
  createdAt: Date;
  lastMessageAt: Date;
  conversationStatus?: "CREATED" | "EXISTING";
  messageStatus?: "CREATED" | "EXISTING";
}): RealtimeEvent {
  return {
    name: "new_message",
    companyId: input.companyId,
    conversationId: input.conversationId,
    payload: {
      conversationId: input.conversationId,
      messageId: input.messageId,
      direction: input.direction,
      contentType: input.contentType,
      senderType: input.senderType,
      senderContactId: input.senderContactId ?? null,
      senderUserId: input.senderUserId ?? null,
      preview:
        input.content && input.content.length > PREVIEW_LENGTH
          ? input.content.slice(0, PREVIEW_LENGTH)
          : (input.content ?? ""),
      createdAt: input.createdAt.toISOString(),
      lastMessageAt: input.lastMessageAt.toISOString(),
      conversationStatus: input.conversationStatus ?? null,
      messageStatus: input.messageStatus ?? null,
    },
  };
}

/**
 * Conversation-list update payload — the minimum fields the Inbox client
 * needs to update/reorder its list without a full refetch.
 */
export function buildConversationUpdatedEvent(input: {
  companyId: string;
  conversationId: string;
  channel: string;
  status: string;
  lastMessageAt: Date;
  lastMessagePreview?: string | null;
  lastMessageDirection?: string | null;
  profilePictureUrl?: string | null;
}): RealtimeEvent {
  return {
    name: "conversation_updated",
    companyId: input.companyId,
    conversationId: input.conversationId,
    payload: {
      conversationId: input.conversationId,
      channel: input.channel,
      status: input.status,
      lastMessageAt: input.lastMessageAt.toISOString(),
      lastMessagePreview: input.lastMessagePreview ?? null,
      lastMessageDirection: input.lastMessageDirection ?? null,
      profilePictureUrl: input.profilePictureUrl ?? null,
    },
  };
}

export function buildOutboundMessageEvent(input: {
  companyId: string;
  conversationId: string;
  messageId: string;
  content: string | null;
  status: string;
  senderUserId: string;
  createdAt: Date;
  lastMessageAt: Date;
}): RealtimeEvent {
  return {
    name: "outbound_message",
    companyId: input.companyId,
    conversationId: input.conversationId,
    payload: {
      conversationId: input.conversationId,
      messageId: input.messageId,
      direction: "OUTBOUND",
      contentType: "TEXT",
      senderType: "USER",
      senderUserId: input.senderUserId,
      status: input.status,
      preview:
        input.content && input.content.length > PREVIEW_LENGTH
          ? input.content.slice(0, PREVIEW_LENGTH)
          : (input.content ?? ""),
      createdAt: input.createdAt.toISOString(),
      lastMessageAt: input.lastMessageAt.toISOString(),
    },
  };
}

export function buildConversationReadEvent(input: {
  companyId: string;
  conversationId: string;
  userId: string;
  readAt: Date;
}): RealtimeEvent {
  return {
    name: "conversation_read",
    companyId: input.companyId,
    conversationId: input.conversationId,
    payload: {
      conversationId: input.conversationId,
      userId: input.userId,
      readAt: input.readAt.toISOString(),
    },
  };
}
