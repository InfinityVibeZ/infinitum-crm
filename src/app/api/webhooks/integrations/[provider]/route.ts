import { NextResponse } from "next/server";
import { getProvider } from "@/lib/integrations/provider-registry";
import { receiveWebhookEvents } from "@/lib/integrations/webhook-gateway";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

/**
 * GET — Meta/Instagram webhook subscription verification (hub.challenge handshake).
 *
 * Meta sends:
 *   GET /api/webhooks/integrations/meta?hub.mode=subscribe
 *                                       &hub.verify_token=<token>
 *                                       &hub.challenge=<challenge>
 *
 * We verify hub.verify_token against our stored platform configuration
 * and echo back hub.challenge as plain text with 200 to confirm the endpoint.
 *
 * Works for both META and INSTAGRAM provider slugs since they share the
 * same Meta platform configuration.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ provider: string }> | { provider: string } }
) {
  const resolvedParams = await props.params;
  const providerId = resolvedParams.provider.toUpperCase();

  // Only META and INSTAGRAM use the Meta hub.challenge verification flow
  if (providerId !== "META" && providerId !== "INSTAGRAM") {
    return new NextResponse("Not supported", { status: 404 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad request — missing hub params", { status: 400 });
  }

  try {
    const config = await prisma.platformMetaConfiguration.findFirst();
    if (!config || !config.enabled) {
      console.warn("[WebhookVerification] Meta platform config not found or disabled");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const expectedToken = config.encryptedWebhookVerifyToken
      ? decrypt(config.encryptedWebhookVerifyToken)
      : "";

    if (!expectedToken || token !== expectedToken) {
      console.warn("[WebhookVerification] hub.verify_token mismatch");
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Echo back the challenge — this confirms our endpoint to Meta
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    console.error("[WebhookVerification] Error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * POST — Receive inbound webhook events from Meta (Instagram DMs, FB messages, leadgen, etc.)
 *
 * Flow:
 *   1. Verify HMAC-SHA256 signature (x-hub-signature-256)
 *   2. Parse payload
 *   3. Extract normalized events via provider.extractEvents()
 *   4. Persist events through the gateway (idempotent upsert)
 *   5. Gateway dispatches message events → inbox pipeline immediately
 *   6. Return 200 quickly — Meta expects a fast acknowledgement
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ provider: string }> | { provider: string } }
) {
  // TEMPORARY DIAGNOSTIC — must be the very first thing in the handler
  const _diagTimestamp = new Date().toISOString();
  const _diagUrl = new URL(request.url);
  const _diagContentType = request.headers.get("content-type") ?? "";
  const _diagHasSignature = request.headers.has("x-hub-signature-256");
  const _diagContentLength = request.headers.get("content-length") ?? "";
  console.error("[WEBHOOK_DIAGNOSTIC] POST RECEIVED", {
    timestamp: _diagTimestamp,
    provider: _diagUrl.pathname.split("/").pop(),
    pathname: _diagUrl.pathname,
    contentType: _diagContentType,
    hasSignature: _diagHasSignature,
    contentLength: _diagContentLength,
  });

  /** Attach diagnostic header to every response from this handler */
  const diagHeaders = { "X-Nexus-Webhook-Diagnostic": "reached" };

  const resolvedParams = await props.params;
  const providerId = resolvedParams.provider.toUpperCase();

  try {
    let provider;
    try {
      provider = getProvider(providerId);
    } catch (e) {
      return new NextResponse("Provider not supported", { status: 404, headers: diagHeaders });
    }

    // Read raw body once — needed for both signature verification and JSON parsing
    const rawBytes = Buffer.from(await request.arrayBuffer());

    // Development bypass for HMAC verification
    const devBypass = process.env.NODE_ENV !== "production" && process.env.DEV_WEBHOOK_BYPASS === "true";
    if (devBypass) {
      console.warn("[WebhookRoute] DEV BYPASS: skipping HMAC verification");
    } else if (provider.verifyWebhookSignature) {
      const isValid = await provider.verifyWebhookSignature(request, rawBytes);
      if (!isValid) {
        console.warn(`[WebhookRoute] Invalid signature for provider: ${providerId}`);
        return new NextResponse("Invalid signature", { status: 401, headers: diagHeaders });
      }
    }

    // Parse JSON payload from raw bytes
    let payload;
    try {
      payload = JSON.parse(rawBytes.toString("utf8"));
    } catch (e) {
      return new NextResponse("Invalid JSON", { status: 400, headers: diagHeaders });
    }

    // Extract and persist events through the gateway
    if (provider.extractEvents) {
      console.log("[WebhookRoute] Payload parsed:", {
        object: payload?.object,
        hasEntry: Array.isArray(payload?.entry),
        entryCount: Array.isArray(payload?.entry)
          ? payload.entry.length
          : 0,
      });
      console.log("[WebhookRoute] Meta entry diagnostics:", {
        entry: Array.isArray(payload?.entry)
          ? payload.entry.map((entry: any) => ({
            id: entry?.id,
            idType: typeof entry?.id,
            hasMessaging: Array.isArray(entry?.messaging),
            messagingCount: Array.isArray(entry?.messaging)
              ? entry.messaging.length
              : 0,
            hasChanges: Array.isArray(entry?.changes),
            changesCount: Array.isArray(entry?.changes)
              ? entry.changes.length
              : 0,
          }))
          : [],
      });
      console.log(
        "[WebhookRoute] Meta payload for extractor:",
        JSON.stringify(payload, null, 2)
      );
      const events = provider.extractEvents(payload);

      console.log("[WebhookRoute] Events extracted:", {
        count: events.length,
        events: events.map((event) => ({
          externalEventId: event.externalEventId,
          eventType: event.eventType,
          accountId: event.accountId,
        })),
      });

      console.log("[WebhookRoute] Calling receiveWebhookEvents...");

      const savedEvents = await receiveWebhookEvents(
        providerId,
        events
      );

      console.log("[WebhookRoute] Gateway completed:", {
        savedCount: savedEvents.length,
        saved: savedEvents.map((event) => ({
          id: event.id,
          status: event.status,
          eventType: event.eventType,
          integrationId: event.integrationId,
        })),
      });
    } else {
      console.warn(`[WebhookRoute] Provider ${providerId} does not implement extractEvents.`);
    }

    // Always acknowledge 200 quickly — processing happens in the gateway
    return new NextResponse("OK", { status: 200, headers: diagHeaders });
  } catch (error: any) {
    console.error(`[WebhookRoute] Error processing webhook for ${providerId}:`, error);
    return new NextResponse("Internal Server Error", { status: 500, headers: diagHeaders });
  }
}
