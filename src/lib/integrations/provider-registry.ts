export interface IntegrationProvider {
  /** The unique string identifying this provider (e.g. "META", "GOOGLE") */
  id: string;

  /**
   * Return the URL to redirect the user to for OAuth authorization
   */
  getAuthorizationUrl(companyId: string, redirectUri: string): Promise<string> | string;

  /**
   * Exchange an authorization code for tokens, or perform whatever
   * initial credential exchange is necessary
   */
  exchangeToken(code: string, redirectUri: string, intent?: string): Promise<any>;

  /**
   * Validate that the credentials still work (e.g. make a test API call)
   */
  testConnection(credentials: any): Promise<boolean>;

  /**
   * Optionally fetches lead details for an external lead ID.
   */
  getLeadDetails?: (credentials: any, leadId: string) => Promise<any>;

  /**
   * Disconnect the integration on the provider's side if applicable
   * (e.g. revoking an OAuth token)
   */
  disconnect(credentials: any): Promise<void>;

  /**
   * Optional: fetch metadata like account name, picture, etc.
   */
  getAccountMetadata?(credentials: any): Promise<any>;

  /**
   * Verify the incoming webhook signature based on provider logic.
   * Return true if valid, false if invalid.
   */
  verifyWebhookSignature?(request: Request, rawBody: Buffer): Promise<boolean>;

  /**
   * Extract standardized events from the raw webhook payload.
   * `accountId` is the provider's ID for the user/page (mapped to Integration.externalId)
   */
  extractEvents?(payload: any): NormalizedWebhookEvent[];
}

export interface NormalizedWebhookEvent {
  externalEventId: string;
  eventType: string;
  payload: any;
  accountId?: string;
}

import { metaProvider } from "./providers/meta";

const registry: Record<string, IntegrationProvider> = {};

export function registerProvider(provider: IntegrationProvider) {
  registry[provider.id] = provider;
}

// ── Built-in providers ────────────────────────────────────────────────────────

// META handles Facebook Messenger + leadgen events (object === "page")
registerProvider(metaProvider);

/**
 * INSTAGRAM provider — scoped to Instagram DM events (object === "instagram").
 *
 * Shares OAuth, token exchange, signature verification, and lead retrieval
 * with the META provider, but extracts events ONLY from Instagram-specific
 * webhook payloads. This keeps Instagram and Facebook routing cleanly separated
 * in the gateway even though they share a Meta platform configuration.
 */
registerProvider({
  ...metaProvider,
  id: "INSTAGRAM",

  /**
   * Extract Instagram DM events from webhook payloads where object === "instagram".
   * Filters out Facebook Page events (object === "page") to avoid double-processing.
   */
  extractEvents: (payload: any): NormalizedWebhookEvent[] => {
    const events: NormalizedWebhookEvent[] = [];

    // Only handle Instagram-specific payloads
    if (payload.object !== "instagram") return events;

    for (const entry of (payload.entry || [])) {
      const accountId = entry.id; // IG Business account ID

      // Instagram DMs come in entry.messaging[]
      for (const messagingEvent of (entry.messaging || [])) {
        events.push({
          externalEventId: messagingEvent.message?.mid || `ig_${accountId}_${Date.now()}_${Math.random()}`,
          eventType: "message",
          accountId,
          payload: messagingEvent,
        });
      }

      // Instagram webhook changes (e.g. comments, mentions) come in entry.changes[]
      // These are not inbox messages — they are non-message events for future use.
      // Instagram webhook changes (e.g. messages, comments, mentions)
      for (const changesEvent of entry.changes || []) {
        const value = changesEvent.value || {};

        // ---------------------------------------------------------
        // Instagram DM delivered through entry.changes[]
        // field === "messages"
        // ---------------------------------------------------------
        if (
          changesEvent.field === "messages" &&
          value.message?.mid
        ) {
          events.push({
            externalEventId: value.message.mid,
            eventType: "message",
            accountId,
            payload: value,
          });

          continue;
        }

        // ---------------------------------------------------------
        // Other Instagram change events
        // ---------------------------------------------------------
        if (value.id || value.comment_id) {
          events.push({
            externalEventId:
              value.id ||
              value.comment_id ||
              `ig_chg_${accountId}_${Date.now()}`,
            eventType: `instagram_${changesEvent.field}`,
            accountId,
            payload: value,
          });
        }
      }
    }

    return events;
  },
});

export function getProvider(id: string): IntegrationProvider {
  const provider = registry[id];
  if (!provider) {
    throw new Error(`Integration provider '${id}' not found in registry`);
  }
  return provider;
}

