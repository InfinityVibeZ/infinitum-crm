import { prisma } from "@/lib/prisma";
import { getProvider, NormalizedWebhookEvent } from "./provider-registry";
import { processLeadWebhookEvents } from "./lead-processor";
import { logAuditEvent } from "@/lib/audit";
import { normalizeInboundEvent } from "@/lib/inbox/normalizers";
import { processInboxEvent, InboxPipelineError } from "@/lib/inbox/pipeline";

/**
 * Persists raw webhook events into the gateway for reliable processing,
 * then dispatches them to the appropriate processor:
 *
 * - "message" events → processWebhookEvent() → inbox pipeline (Phase 3.8.2+)
 * - "leadgen" events → processLeadWebhookEvents() → lead processor
 *
 * Both dispatches are fire-and-forget so the webhook acknowledgement stays fast.
 */
export async function receiveWebhookEvents(
  provider: string,
  events: NormalizedWebhookEvent[]
) {
  console.log("\n========== [WEBHOOK GATEWAY START] ==========");

  console.log("[Gateway] Incoming provider:", provider);

  console.log("[Gateway] Incoming events:", {
    count: events.length,
    events: events.map((event) => ({
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      accountId: event.accountId,
      hasPayload: !!event.payload,
    })),
  });

  const savedEvents = [];

  for (const event of events) {
    console.log("\n[Gateway] Processing incoming event:", {
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      accountId: event.accountId,
    });

    try {
      let integrationId: string | undefined = undefined;

      // ---------------------------------------------------------
      // Resolve Integration
      // ---------------------------------------------------------

      if (event.accountId) {
        console.log("[Gateway] Looking for Integration:", {
          provider,
          externalId: event.accountId,
        });

        let integration = await prisma.integration.findFirst({
          where: {
            provider,
            externalId: event.accountId,
            isActive: true,
          },
          select: {
            id: true,
            companyId: true,
            externalId: true,
          },
        });

        console.log("[Gateway] Direct Integration lookup:", {
          found: !!integration,
          integrationId: integration?.id,
          companyId: integration?.companyId,
          externalId: integration?.externalId,
        });

        // -------------------------------------------------------
        // IntegrationAsset fallback
        // -------------------------------------------------------

        if (!integration) {
          console.log("[Gateway] Checking IntegrationAsset:", {
            provider,
            externalId: event.accountId,
          });

          const asset = await prisma.integrationAsset.findFirst({
            where: {
              provider,
              externalId: event.accountId,
              isActive: true,
            },
            select: {
              integrationId: true,
            },
          });

          console.log("[Gateway] IntegrationAsset lookup:", {
            found: !!asset,
            integrationId: asset?.integrationId,
          });

          if (asset) {
            integration = await prisma.integration.findUnique({
              where: {
                id: asset.integrationId,
              },
              select: {
                id: true,
                companyId: true,
                externalId: true,
              },
            });
          }
        }

        if (integration) {
          integrationId = integration.id;

          console.log("[Gateway] Integration resolved:", {
            integrationId,
            companyId: integration.companyId,
          });
        } else {
          console.warn("[Gateway] ⚠️ No Integration found for event:", {
            provider,
            accountId: event.accountId,
          });
        }
      } else {
        console.warn(
          "[Gateway] ⚠️ Event has no accountId"
        );
      }

      // ---------------------------------------------------------
      // Persist webhook event
      // ---------------------------------------------------------

      console.log("[Gateway] Persisting IntegrationWebhookEvent:", {
        provider,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        integrationId,
      });

      const saved = await prisma.integrationWebhookEvent.upsert({
        where: {
          provider_externalEventId: {
            provider,
            externalEventId: event.externalEventId,
          },
        },
        update: {},
        create: {
          provider,
          integrationId,
          externalEventId: event.externalEventId,
          eventType: event.eventType,
          payload: event.payload,
          status: "PENDING",
        },
      });

      console.log("[Gateway] ✅ Event persisted:", {
        id: saved.id,
        status: saved.status,
        integrationId: saved.integrationId,
        eventType: saved.eventType,
      });

      savedEvents.push(saved);
    } catch (error) {
      console.error(
        "[Gateway] ❌ Failed to save webhook event:",
        error
      );
    }
  }

  console.log("\n[Gateway] Persistence complete:", {
    received: events.length,
    saved: savedEvents.length,
  });

  // ------------------------------------------------------------
  // MESSAGE EVENTS
  // TEMPORARILY AWAIT PROCESSING FOR DEBUGGING
  // ------------------------------------------------------------

  const pendingMessageEvents = savedEvents.filter(
    (e) =>
      e.status === "PENDING" &&
      e.eventType === "message"
  );

  console.log("[Gateway] Pending message events:", {
    count: pendingMessageEvents.length,
    ids: pendingMessageEvents.map((e) => e.id),
  });

  for (const msgEvent of pendingMessageEvents) {
    try {
      console.log(
        `[Gateway] ▶ Starting inbox processing: ${msgEvent.id}`
      );

      const result = await processWebhookEvent(msgEvent.id);

      console.log(
        `[Gateway] ✅ Inbox processing completed: ${msgEvent.id}`,
        {
          status: result.status,
        }
      );
    } catch (err) {
      console.error(
        `[Gateway] ❌ Inbox processing failed: ${msgEvent.id}`,
        err
      );
    }
  }

  // ------------------------------------------------------------
  // NON-MESSAGE EVENTS
  // ------------------------------------------------------------

  const pendingOtherEvents = savedEvents.filter(
    (e) =>
      e.status === "PENDING" &&
      e.eventType !== "message"
  );

  console.log("[Gateway] Pending non-message events:", {
    count: pendingOtherEvents.length,
  });

  if (pendingOtherEvents.length > 0) {
    try {
      await processLeadWebhookEvents();

      console.log(
        "[Gateway] ✅ Lead processing completed"
      );
    } catch (err) {
      console.error(
        "[Gateway] ❌ Lead processing failed:",
        err
      );
    }
  }

  console.log("========== [WEBHOOK GATEWAY END] ==========\n");

  return savedEvents;
}


/**
 * Processes a pending webhook event.
 * Enforces retries and updates statuses safely.
 */
export async function processWebhookEvent(eventId: string) {
  const event = await prisma.integrationWebhookEvent.findUnique({
    where: { id: eventId },
    include: { integration: true },
  });

  if (!event) throw new Error("Event not found");

  if (event.status === "PROCESSED" || event.status === "IGNORED") {
    return event; // Already processed
  }

  // Mark as processing
  await prisma.integrationWebhookEvent.update({
    where: { id: eventId },
    data: { status: "PROCESSING", retryCount: event.retryCount + 1 },
  });

  try {
    // If we have an integration, process the business logic
    if (!event.integrationId || !event.integration) {
      throw new Error("No active integration found to process this event.");
    }

    // Tenant isolation check
    if (!event.integration.companyId) {
      throw new Error("Integration has no tenant assigned.");
    }

    // ── Phase 3.8.2: Inbox Pipeline Dispatch ──────────────────────────────
    // Dispatch messaging events to the unified inbox pipeline.
    // Lead gen events continue through the lead processor unchanged.
    if (event.eventType === "message") {
      // Determine channel from provider
      const channel =
        event.provider === "INSTAGRAM" ? "INSTAGRAM" :
          event.provider === "META" ? "FACEBOOK" :
            event.provider;

      const normResult = normalizeInboundEvent(channel, event.payload, event.integrationId);

      if (!normResult.ok) {
        // Log skipped events (echoes, read receipts, etc.) without failing
        console.info(`[InboxGateway] Skipped ${event.provider} message event ${event.externalEventId}: ${normResult.reason}`);
        const skipped = await prisma.integrationWebhookEvent.update({
          where: { id: eventId },
          data: { status: "IGNORED", processedAt: new Date(), errorMessage: normResult.reason },
        });
        return skipped;
      }

      try {
        const pipelineResult = await processInboxEvent(normResult.event);
        console.info(
          `[InboxGateway] Processed ${event.provider} message: conv=${pipelineResult.conversationId} msg=${pipelineResult.messageId} (${pipelineResult.messageStatus})`
        );
      } catch (pipelineError: any) {
        if (pipelineError instanceof InboxPipelineError) {
          // Known pipeline errors: log and fail cleanly
          throw new Error(`Inbox pipeline error [${pipelineError.code}]: ${pipelineError.message}`);
        }
        throw pipelineError;
      }
    }

    // Mark as processed
    const processed = await prisma.integrationWebhookEvent.update({
      where: { id: eventId },
      data: { status: "PROCESSED", processedAt: new Date(), errorMessage: null },
    });

    return processed;
  } catch (error: any) {
    const isFailed = event.retryCount >= 3;
    const finalStatus = isFailed ? "FAILED" : "PENDING";

    const failedEvent = await prisma.integrationWebhookEvent.update({
      where: { id: eventId },
      data: { status: finalStatus, errorMessage: error.message },
    });

    if (isFailed && event.integration) {
      await logAuditEvent({
        action: "WEBHOOK_PROCESSING_FAILED",
        category: "System",
        severity: "DANGER",
        actorName: "System",
        actorEmail: "",
        actorRole: "SYSTEM",
        summary: `Webhook processing permanently failed for ${event.provider} event ${event.eventType}.`,
      });
    }

    throw error;
  }
}
