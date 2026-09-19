/**
 * Realtime publishing entry point for the rest of the application.
 *
 * API routes call `publishRealtimeEvent(event)`; the hub fans it out to
 * authenticated, tenant-scoped connections only. Publishing never throws
 * and never blocks — REST remains the source of truth, SignalR is a
 * best-effort delivery layer.
 *
 * Cross-process delivery remains available through an explicit
 * REALTIME_PUBLISH_URL. In the shared production server, getRealtimeHub()
 * handles publishing in-process and this fallback is not used.
 */
import type { RealtimeEvent } from "./events";

export type { RealtimeEvent, RealtimeEventName } from "./events";

export async function publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
  const context = {
    event: event.name,
    conversationId: event.conversationId,
    companyId: event.companyId,
  };

  try {
    // Preferred in-process path (when the hub runs inside this process,
    // e.g. tests or single-process deployments).
    const { getRealtimeHub } = await import("./server");
    const hub = getRealtimeHub();
    console.log("[realtime-debug] publishRealtimeEvent entered", {
      ...context,
      hasHub: !!hub,
      directPublish: !!hub,
      usingRealtimePublishUrl: !!process.env.REALTIME_PUBLISH_URL,
    });

    if (hub) {
      console.log("[realtime-debug] direct hub.publish starting", context);
      hub.publish(event);
      console.log("[realtime-debug] direct hub.publish completed", context);
      return;
    }

    // Cross-process path: POST only to an explicitly configured endpoint, or
    // to an explicitly configured local development port.
    const publishUrl =
      process.env.REALTIME_PUBLISH_URL ||
      (process.env.REALTIME_PORT
        ? `http://127.0.0.1:${process.env.REALTIME_PORT}/publish`
        : "");
    if (publishUrl) {
      console.log("[realtime-debug] publish POST starting", {
        ...context,
        postUrl: publishUrl,
        usingRealtimePublishUrl: !!process.env.REALTIME_PUBLISH_URL,
      });
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
      console.log("[realtime-debug] publish POST response", {
        ...context,
        postUrl: publishUrl,
        status: res.status,
      });
      if (!res.ok) {
        console.warn("[realtime-debug] publish POST non-2xx body", {
          ...context,
          postUrl: publishUrl,
          status: res.status,
          body: await res.text(),
        });
      }
      return;
    }

    // Realtime not configured — silently no-op (REST-only mode).
  } catch (error) {
    console.error("[realtime-debug] publishRealtimeEvent caught error", {
      ...context,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    });
  }
}
