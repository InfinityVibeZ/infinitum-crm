/**
 * Realtime event abstraction.
 *
 * REST remains the source of truth; SignalR only DELIVERS these events to
 * authenticated, tenant-scoped connections. Nothing here persists data or
 * contains business logic. No secrets, tokens, or integration credentials
 * are ever included in payloads.
 */
export type RealtimeEventName =
  | "new_message"
  | "conversation_updated"
  | "conversation_read"
  | "conversation_unread"
  | "outbound_message";

export interface RealtimeEvent {
  /** The event name clients subscribe to. */
  name: RealtimeEventName;
  /** Authoritative tenant of the event — determines the delivery group. */
  companyId: string;
  /** Conversation this event relates to (used for client-side routing). */
  conversationId?: string;
  /** Sanitized payload — must never contain tokens or credentials. */
  payload: Record<string, unknown>;
}
