/**
 * Phase 3.8.7.2 — Fire-and-forget realtime emission for Inbox flows.
 *
 * Diagnostic version.
 *
 * Realtime is best-effort:
 *  - never blocks the request path
 *  - never changes persistence semantics
 *  - publish failures are logged and swallowed
 */

import type { RealtimeEvent } from "@/realtime/events";

export function emitInboxRealtime(event: RealtimeEvent): void {
  console.log("[REALTIME DEBUG] EMIT: FUNCTION CALLED", {
    event: event.name,
    companyId: event.companyId,
    conversationId: event.conversationId ?? null,
  });

  try {
    console.log("[REALTIME DEBUG] EMIT: STARTING DYNAMIC IMPORT", {
      event: event.name,
      companyId: event.companyId,
      conversationId: event.conversationId ?? null,
    });

    void import("@/realtime/publish")
      .then(({ publishRealtimeEvent }) => {
        console.log("[REALTIME DEBUG] EMIT: PUBLISH MODULE LOADED", {
          event: event.name,
          companyId: event.companyId,
          conversationId: event.conversationId ?? null,
          publishType: typeof publishRealtimeEvent,
        });

        console.log("[REALTIME DEBUG] EMIT: CALLING publishRealtimeEvent", {
          event: event.name,
          companyId: event.companyId,
          conversationId: event.conversationId ?? null,
        });

        console.log("[realtime-debug] emitter before publishRealtimeEvent", {
          event: event.name,
          messageId: event.payload.messageId ?? null,
          conversationId: event.conversationId ?? null,
          companyId: event.companyId,
        });

        return publishRealtimeEvent(event);
      })
      .then(() => {
        console.log("[REALTIME DEBUG] EMIT: publishRealtimeEvent RESOLVED", {
          event: event.name,
          companyId: event.companyId,
          conversationId: event.conversationId ?? null,
        });
      })
      .catch((err: unknown) => {
        console.error("[REALTIME DEBUG] EMIT: PUBLISH FAILED", {
          event: event.name,
          companyId: event.companyId,
          conversationId: event.conversationId ?? null,
          error:
            err instanceof Error
              ? {
                  name: err.name,
                  message: err.message,
                  stack: err.stack,
                }
              : String(err),
        });
      });
  } catch (err) {
    console.error("[REALTIME DEBUG] EMIT: SYNCHRONOUS FAILURE", {
      event: event.name,
      companyId: event.companyId,
      conversationId: event.conversationId ?? null,
      error:
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack,
            }
          : String(err),
    });
  }
}