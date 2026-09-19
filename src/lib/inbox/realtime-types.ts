/**
 * Shared client-side Inbox types for realtime state helpers.
 * Mirrors the shapes the /inbox page already uses (kept minimal here so the
 * helpers do not depend on the page module).
 */
export interface Message {
  id: string;
  content: string;
  direction: string;
  created_at: string;
  status?: string;
}

export interface Conversation {
  id: string;
  channel: string;
  status: string;
  last_message_at: string | null;
  metadata: any;
  contact: any;
  integration: any;
  messages: Message[];
}
