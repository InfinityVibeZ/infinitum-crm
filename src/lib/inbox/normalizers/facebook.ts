/**
 * Phase 3.8.2 — Facebook Messenger Message Normalizer
 *
 * Converts raw Facebook Messenger webhook messaging payloads (entry.messaging[])
 * into NormalizedInboxEvent. All Facebook-specific payload structures stay
 * in this file — the core pipeline never sees them.
 *
 * Reference:
 *   https://developers.facebook.com/docs/messenger-platform/webhook#messaging
 *   https://developers.facebook.com/docs/messenger-platform/send-messages/templates
 */

import type {
  NormalizedInboxEvent,
  NormalizationResult,
  MessageContentType,
  NormalizedAttachment,
} from "../types";

// ── Facebook Messenger-specific payload shapes ────────────────────────────────

interface FBMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    attachments?: FBAttachment[];
    sticker_id?: number;
    is_echo?: boolean;
    app_id?: string;
  };
  read?: unknown;
  delivery?: unknown;
  postback?: { title?: string; payload?: string; mid?: string };
  referral?: unknown;
  reaction?: unknown;
}

interface FBAttachment {
  type?: string; // "image", "video", "audio", "file", "template", "location", "fallback"
  payload?: {
    url?: string;
    title?: string;
    sticker_id?: number;
    coordinates?: { lat: number; long: number };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeAttachmentType(fbType: string | undefined): MessageContentType {
  switch ((fbType ?? "").toLowerCase()) {
    case "image":
      return "IMAGE";
    case "video":
      return "VIDEO";
    case "audio":
      return "AUDIO";
    case "file":
      return "FILE";
    case "sticker":
      return "STICKER";
    case "location":
      return "LOCATION";
    case "template":
    case "fallback":
    default:
      return "UNSUPPORTED";
  }
}

function normalizeAttachments(fbAttachments: FBAttachment[]): NormalizedAttachment[] {
  return fbAttachments.map((a) => ({
    type: normalizeAttachmentType(a.type),
    url: a.payload?.url,
    name: a.payload?.title,
    payloadId: a.payload?.sticker_id?.toString(),
  }));
}

function deriveContentType(
  text: string | null,
  attachments: NormalizedAttachment[]
): MessageContentType {
  if (text) return "TEXT";
  if (attachments.length === 0) return "UNSUPPORTED";
  return attachments[0].type;
}

// ── Main Normalizer ───────────────────────────────────────────────────────────

/**
 * Normalizes a single Facebook Messenger messaging event payload.
 *
 * @param rawEvent      - The raw `entry.messaging[]` item from the webhook payload.
 * @param integrationId - The DB Integration ID (already resolved from the gateway).
 * @returns NormalizationResult — ok:true with the event, or ok:false with a reason.
 */
export function normalizeFacebookMessage(
  rawEvent: unknown,
  integrationId: string
): NormalizationResult {
  const e = rawEvent as FBMessagingEvent;

  // ── Validate required fields ─────────────────────────────────────────────
  const senderId = e?.sender?.id;
  const recipientId = e?.recipient?.id;

  if (!senderId || !recipientId) {
    return { ok: false, reason: "Missing sender.id or recipient.id" };
  }

  // Skip echo messages (messages sent by the page via API)
  if (e.message?.is_echo) {
    return { ok: false, reason: "Echo message — skip" };
  }

  // Skip postbacks, referrals, reactions — not conversation messages
  if (e.postback || e.reaction || e.referral) {
    return { ok: false, reason: "Postback/reaction/referral event — not a message" };
  }

  // Skip read receipts and delivery notifications
  if (!e.message) {
    return { ok: false, reason: "No message payload — likely a read/delivery event" };
  }

  const mid = e.message.mid;
  if (!mid) {
    console.warn("[InboxNormalizer:Facebook] message.mid is missing — using timestamp fallback");
  }
  const externalMessageId = mid ?? `fb_${senderId}_${e.timestamp ?? Date.now()}`;

  // ── Build thread ID ──────────────────────────────────────────────────────
  // Messenger thread is uniquely identified by the Page PSID of the user.
  // recipient.id = Page ID (our business), sender.id = user PSID.
  const externalConversationId = `${recipientId}_${senderId}`;

  // ── Normalize text & attachments ─────────────────────────────────────────
  const text = e.message.text ?? null;
  const fbAttachments: FBAttachment[] = e.message.attachments ?? [];
  const attachments = normalizeAttachments(fbAttachments);

  // Sticker sent without attachment entry
  if (e.message.sticker_id && attachments.length === 0) {
    attachments.push({ type: "STICKER", payloadId: String(e.message.sticker_id) });
  }

  const contentType = deriveContentType(text, attachments);

  const normalizedEvent: NormalizedInboxEvent = {
    provider: "META",
    channel: "FACEBOOK",
    integrationId,
    externalConversationId,
    externalMessageId,
    externalSenderId: senderId,
    direction: "INBOUND",
    contentType,
    text,
    attachments,
    timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    raw: rawEvent as Record<string, unknown>,
  };

  return { ok: true, event: normalizedEvent };
}
