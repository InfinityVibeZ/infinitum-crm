/**
 * Realtime publishing entry point for the rest of the application.
 *
 * API routes call `publishRealtimeEvent(event)`; the hub fans it out to
 * authenticated, tenant-scoped connections only. Publishing never throws
 * and never blocks — REST remains the source of truth, SignalR is a
 * best-effort delivery layer.
 *
 * Cross-process delivery (Phase 3.8.7.3 fix):
 * The Next.js app and the standalone hub run in SEPARATE processes, so
 * `getRealtimeHub()` is null inside Next.js. When REALTIME_PUBLISH_URL is
 * configured, events are POSTed to the hub's internal /publish endpoint
 * (health server) instead. The endpoint is loopback-only in practice and
 * requires the shared REALTIME_PUBLISH_TOKEN, carries no tenant data
 * authority (companyId in the event was already derived server-side), and
 * never contains tokens or credentials.
 */
import type { RealtimeEvent } from "./events";

export type { RealtimeEvent, RealtimeEventName } from "./events";

export async function publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
  try {
    // Preferred in-process path (when the hub runs inside this process,
    // e.g. tests or single-process deployments).
    const { getRealtimeHub } = await import("./server");
    const hub = getRealtimeHub();
    if (hub) {
      hub.publish(event);
      return;
    }

    // Cross-process path: POST the event to the hub's publish endpoint.
    // URL is explicit when configured; otherwise derive from the hub port
    // (same host, internal loopback endpoint) so delivery works in every
    // process that shares the hub port convention.
    const publishUrl =
      process.env.REALTIME_PUBLISH_URL ||
      `http://127.0.0.1:${process.env.REALTIME_PORT || "5001"}/publish`;
    if (publishUrl) {
      const res = await fetch(publishUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-publish-token": process.env.REALTIME_PUBLISH_TOKEN || "",
        },
        body: JSON.stringify({
          name: event.name,
          companyId: event.companyId,
          conversationId: event.conversationId,
          payload: event.payload,
        }),
        signal: AbortSignal.timeout(3000), // strict best-effort; never block the request path
      });
      if (!res.ok) {
        console.warn("[realtime] publish endpoint returned non-ok:", res.status);
      }
      return;
    }

    // Realtime not configured — silently no-op (REST-only mode).
  } catch {
    // Never let realtime delivery break REST request handling.
  }
}
