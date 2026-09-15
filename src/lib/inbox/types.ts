/**
 * Phase 3.8.2 — Unified Inbox Channel Normalization
 *
 * Shared types for the channel-agnostic inbox pipeline.
 * All provider adapters MUST produce a NormalizedInboxEvent.
 * The core pipeline MUST only depend on these types — never on
 * provider-specific payload structures.
 */

// ── Channels ────────────────────────────────────────────────────────────────

/**
 * Supported inbox channels.
 * Extend this union as new providers are onboarded (e.g. WHATSAPP, SMS).
 */
export type InboxChannel = "INSTAGRAM" | "FACEBOOK" | "WHATSAPP";

// ── Direction ────────────────────────────────────────────────────────────────

/** Whether the message was sent TO us (INBOUND) or FROM us (OUTBOUND). */
export type MessageDirection = "INBOUND" | "OUTBOUND";

// ── Content Types ────────────────────────────────────────────────────────────

/**
 * Normalized message content type.
 * Maps provider-specific attachment types to a canonical set.
 */
export type MessageContentType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "FILE"
  | "STICKER"
  | "LOCATION"
  | "UNSUPPORTED";

// ── Attachments ──────────────────────────────────────────────────────────────

export interface NormalizedAttachment {
  /** Canonical content type for this attachment. */
  type: MessageContentType;
  /** Direct URL to the media resource (if available). */
  url?: string;
  /** MIME type reported by the provider (if available). */
  mimeType?: string;
  /** Human-readable file name (if available). */
  name?: string;
  /** Provider-reported payload ID / media ID. */
  payloadId?: string;
}

// ── Core Normalized Event ────────────────────────────────────────────────────

/**
 * The canonical inbox event produced by all provider normalizers.
 *
 * Rules:
 * - `integrationId` is always resolved from the database — never from the payload.
 * - `companyId` is derived from the Integration, never from the webhook body.
 * - `raw` preserves the full provider-specific payload for audit / debugging.
 * - `externalConversationId` uniquely identifies the thread within this integration.
 * - `externalMessageId` uniquely identifies this message within the conversation.
 */
export interface NormalizedInboxEvent {
  /** Provider identifier string (e.g. "META", "INSTAGRAM"). */
  provider: string;

  /** Normalized channel (INSTAGRAM | FACEBOOK | WHATSAPP). */
  channel: InboxChannel;

  /** Integration DB ID — resolved from DB, NOT from the payload. */
  integrationId: string;

  /**
   * Provider-scoped conversation / thread identifier.
   * For Meta: the PSID-based thread ID (sender.id + recipient.id composite).
   */
  externalConversationId: string;

  /** Provider-issued unique message ID. */
  externalMessageId: string;

  /** Provider-issued external sender ID (e.g. PSID for Meta). */
  externalSenderId: string;

  /** Message direction relative to the business. */
  direction: MessageDirection;

  /** Primary content type. TEXT for plain text; others for media. */
  contentType: MessageContentType;

  /** Plain-text body. Null for pure media messages. */
  text: string | null;

  /** Zero or more normalized attachments. */
  attachments: NormalizedAttachment[];

  /** Message timestamp (from provider or ingestion time). */
  timestamp: Date;

  /** Full raw provider-specific payload — stored in Message.metadata. */
  raw: Record<string, unknown>;
}

// ── Normalization Result ─────────────────────────────────────────────────────

/**
 * Result of attempting to normalize a provider-specific webhook event.
 *
 * - `ok: true`  → `event` contains the normalized inbox event.
 * - `ok: false` → `reason` explains why normalization was skipped/rejected.
 */
export type NormalizationResult =
  | { ok: true; event: NormalizedInboxEvent }
  | { ok: false; reason: string };

// ── Pipeline Result ──────────────────────────────────────────────────────────

/**
 * Result of running the inbox pipeline for a single normalized event.
 */
export interface InboxPipelineResult {
  conversationId: string;
  messageId: string;
  contactId: string;
  /** "CREATED" if new record was inserted, "EXISTING" if idempotent no-op. */
  messageStatus: "CREATED" | "EXISTING";
  conversationStatus: "CREATED" | "EXISTING";
}
