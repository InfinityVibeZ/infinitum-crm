/**
 * Pure reducer helpers for realtime Inbox events (Phase 3.8.7.3).
 *
 * Kept free of React so they are unit-testable without a DOM. Every helper
 * is deduplication-safe: the same event can arrive via REST, optimistic UI,
 * and SignalR — conversations and messages are merged by stable id and never
 * duplicated.
 */
import type { Conversation, Message } from "./realtime-types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Upsert a message into a message array by id. Existing messages are never
 * duplicated; the incoming payload only fills fields that are missing
 * (so a richer REST-fetched message always wins over a realtime preview).
 */
export function mergeMessage(
  existing: Message[],
  incoming: Message
): Message[] {
  const index = existing.findIndex((m) => m.id === incoming.id);
  if (index >= 0) {
    // Already present (REST response or optimistic send) — keep it.
    return existing;
  }
  return [...existing, incoming];
}

/**
 * Apply a new_message / outbound_message payload to the conversation list.
 * Updates the matching conversation's preview/timestamp and moves it to the
 * top (latest activity ordering). Never creates a conversation that is not
 * already in the list — an unknown conversationId means the conversation is
 * not on the current page, and a fabricated partial row would corrupt
 * pagination. Returns the list unchanged in that case.
 */
export function applyMessageToList(
  list: Conversation[],
  event: {
    conversationId: string;
    messageId?: string;
    direction?: string;
    contentType?: string;
    preview?: string;
    createdAt?: string;
    lastMessageAt?: string;
  }
): Conversation[] {
  if (!event.conversationId) return list;
  const index = list.findIndex((c) => c.id === event.conversationId);
  if (index === -1) return list; // unknown → do not fabricate

  const conv = list[index];
  const isOutbound = event.direction === "OUTBOUND";
  const stamp = event.lastMessageAt || event.createdAt || conv.last_message_at;
  const preview = event.preview || "";
  const message = event.messageId
    ? {
        id: event.messageId,
        content: preview,
        direction: event.direction || "INBOUND",
        created_at: event.createdAt || stamp || new Date().toISOString(),
        status: isOutbound ? "SENT" : "RECEIVED",
      }
    : null;

  const updated: Conversation = {
    ...conv,
    last_message_at: stamp || conv.last_message_at,
    messages:
      message && !conv.messages.some((item) => item.id === message.id)
        ? [message, ...conv.messages]
        : conv.messages,
    metadata: {
      ...conv.metadata,
      lastMessagePreview: preview,
      lastMessageDirection: event.direction,
      // FIX 1: an outbound message must never make the conversation unread.
      // Setting lastReadAt to the outbound timestamp keeps it READ; an
      // inbound message leaves lastReadAt untouched so it becomes unread.
      ...(isOutbound
        ? { lastReadAt: stamp || conv.last_message_at || new Date().toISOString() }
        : {}),
    },
  };

  const next = [...list];
  next.splice(index, 1);
  next.unshift(updated); // latest activity first
  return next;
}

/**
 * Apply a conversation_updated payload: update in place and move to the top.
 * Dedupe-safe by conversationId; unknown ids are ignored (no fabrication).
 */
export function applyConversationUpdated(
  list: Conversation[],
  event: {
    conversationId: string;
    status?: string;
    lastMessageAt?: string;
    lastMessagePreview?: string;
    profilePictureUrl?: string | null;
  }
): Conversation[] {
  if (!event.conversationId) return list;
  const index = list.findIndex((c) => c.id === event.conversationId);
  if (index === -1) return list;

  const conv = list[index];
  const updated: Conversation = {
    ...conv,
    status: event.status || conv.status,
    last_message_at: event.lastMessageAt || conv.last_message_at,
    metadata: {
      ...conv.metadata,
      ...(event.lastMessagePreview !== undefined
        ? { lastMessagePreview: event.lastMessagePreview }
        : {}),
    },
    contact: event.profilePictureUrl
      ? { ...conv.contact, avatarUrl: event.profilePictureUrl }
      : conv.contact,
  };

  const next = [...list];
  next.splice(index, 1);
  next.unshift(updated);
  return next;
}

/**
 * Apply a conversation_read payload: update local read state only — no REST
 * call. Marks the conversation read as of the event timestamp (falls back to
 * now). Dedupe-safe: same id → same row updated.
 */
export function applyConversationRead(
  list: Conversation[],
  event: { conversationId: string; readAt?: string }
): Conversation[] {
  if (!event.conversationId) return list;
  const readAt = event.readAt || new Date().toISOString();
  return list.map((c) =>
    c.id === event.conversationId
      ? { ...c, metadata: { ...c.metadata, lastReadAt: readAt } }
      : c
  );
}

export { asString as safeString };
