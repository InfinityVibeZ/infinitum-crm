/**
 * Phase 3.8.2 — Normalizer Dispatch Index
 *
 * Entry point for channel normalization.
 * Dispatches to the correct provider adapter based on the channel.
 * The inbox pipeline and webhook gateway call ONLY this function —
 * never the individual provider normalizers directly.
 */

import type { InboxChannel, NormalizationResult } from "../types";
import { normalizeInstagramMessage } from "./instagram";
import { normalizeFacebookMessage } from "./facebook";

/**
 * Normalize a raw provider messaging payload into a NormalizedInboxEvent.
 *
 * @param channel       - The resolved inbox channel ("INSTAGRAM" | "FACEBOOK" | ...).
 * @param rawEvent      - The raw `entry.messaging[]` item from the webhook.
 * @param integrationId - The DB Integration ID (resolved upstream, never from payload).
 * @returns NormalizationResult
 */
export function normalizeInboundEvent(
  channel: InboxChannel | string,
  rawEvent: unknown,
  integrationId: string
): NormalizationResult {
  switch (channel) {
    case "INSTAGRAM":
      return normalizeInstagramMessage(rawEvent, integrationId);

    case "FACEBOOK":
      return normalizeFacebookMessage(rawEvent, integrationId);

    default:
      return {
        ok: false,
        reason: `Unsupported channel: ${channel}. Supported channels: INSTAGRAM, FACEBOOK.`,
      };
  }
}

// Re-export types for convenience
export type { NormalizationResult, NormalizedInboxEvent } from "../types";
