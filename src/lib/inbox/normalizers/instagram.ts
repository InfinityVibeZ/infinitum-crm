/**
 * Phase 3.8.2 — Instagram Message Normalizer
 *
 * Converts raw Instagram webhook messaging payloads (entry.messaging[])
 * into NormalizedInboxEvent. All Instagram-specific payload structures
 * stay in this file — the core pipeline never sees them.
 *
 * Reference:
 *   https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
 *   https://developers.facebook.com/docs/messenger-platform/webhook#messaging
 */

import type {
  NormalizedInboxEvent,
  NormalizationResult,
  MessageContentType,
  NormalizedAttachment,
} from "../types";

// ── Instagram-specific payload shapes ────────────────────────────────────────

interface IGMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    attachments?: IGAttachment[];
    sticker_id?: number;
    is_echo?: boolean;
  };
  read?: unknown;
  delivery?: unknown;
  postback?: unknown;
}

interface IGAttachment {
  type?: string; // "image", "video", "audio", "file", "template", "location"
  payload?: {
    url?: string;
    sticker_id?: number;
    coordinates?: { lat: number; long: number };
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeAttachmentType(igType: string | undefined): MessageContentType {
  switch ((igType ?? "").toLowerCase()) {
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
    default:
      return "UNSUPPORTED";
  }
}

function normalizeAttachments(igAttachments: IGAttachment[]): NormalizedAttachment[] {
  return igAttachments.map((a) => ({
    type: normalizeAttachmentType(a.type),
    url: a.payload?.url,
    payloadId: a.payload?.sticker_id?.toString(),
  }));
}

function deriveContentType(
  text: string | null,
  attachments: NormalizedAttachment[]
): MessageContentType {
  if (text) return "TEXT";
  if (attachments.length === 0) return "UNSUPPORTED";
  // Primary type = first attachment type
  return attachments[0].type;
}

// ── Main Normalizer ───────────────────────────────────────────────────────────

/**
 * Normalizes a single Instagram messaging event payload.
 *
 * @param rawEvent  - The raw `entry.messaging[]` item from the webhook payload.
 * @param integrationId - The DB Integration ID (already resolved from the gateway).
 * @returns NormalizationResult — ok:true with the event, or ok:false with a reason.
 */
export function normalizeInstagramMessage(
  rawEvent: unknown,
  integrationId: string
): NormalizationResult {
  const e = rawEvent as IGMessagingEvent;

  // ── Validate required fields ─────────────────────────────────────────────
  const senderId = e?.sender?.id;
  const recipientId = e?.recipient?.id;

  if (!senderId || !recipientId) {
    return { ok: false, reason: "Missing sender.id or recipient.id" };
  }

  // Skip echo messages (messages sent by the page itself via API)
  if (e.message?.is_echo) {
    return { ok: false, reason: "Echo message — skip" };
  }

  // Skip read receipts and delivery notifications (no message payload)
  if (!e.message) {
    return { ok: false, reason: "No message payload — likely a read/delivery event" };
  }

  const mid = e.message.mid;
  if (!mid) {
    // Use a deterministic fallback so we can still ingest (log warning)
    console.warn("[InboxNormalizer:Instagram] message.mid is missing — using timestamp fallback");
  }
  const externalMessageId = mid ?? `ig_${senderId}_${e.timestamp ?? Date.now()}`;

  // ── Build thread ID ──────────────────────────────────────────────────────
  // Instagram conversations are identified by the sender PSID.
  // The recipient ID is the business's IG account / page ID.
  const externalConversationId = `${recipientId}_${senderId}`;

  // ── Normalize text & attachments ─────────────────────────────────────────
  const text = e.message.text ?? null;
  const igAttachments: IGAttachment[] = e.message.attachments ?? [];
  const attachments = normalizeAttachments(igAttachments);

  // Sticker → normalize as STICKER type
  if (e.message.sticker_id && attachments.length === 0) {
    attachments.push({ type: "STICKER", payloadId: String(e.message.sticker_id) });
  }

  const contentType = deriveContentType(text, attachments);

  const normalizedEvent: NormalizedInboxEvent = {
    provider: "INSTAGRAM",
    channel: "INSTAGRAM",
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
