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
 * - "message" events → processWebhookEvent() → inbox pipeline
 * - "leadgen" events → processLeadWebhookEvents() → lead processor
 *
 * TEMPORARY DEBUG VERSION
 * Extensive [IG-INBOX-TRACE] logging is intentionally enabled.
 */
export async function receiveWebhookEvents(
  provider: string,
  events: NormalizedWebhookEvent[]
) {
  console.log("\n============================================================");
  console.log("========== [WEBHOOK GATEWAY START] ==========");
  console.log("============================================================");

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
    console.log("\n------------------------------------------------------------");
    console.log("========== [IG-INBOX-TRACE: GATEWAY EVENT] ==========");
    console.log("------------------------------------------------------------");

    console.log("[IG-INBOX-TRACE] EVENT INPUT:", {
      provider,
      accountId: event.accountId,
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      hasPayload: !!event.payload,
    });

    console.log("[Gateway] Processing incoming event:", {
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      accountId: event.accountId,
    });

    try {
      let integrationId: string | undefined = undefined;
      let integration: any = undefined;

      // ---------------------------------------------------------
      // STEP 1: Resolve Integration
      // ---------------------------------------------------------

      console.log("\n========== [IG-INBOX-TRACE: INTEGRATION RESOLUTION] ==========");

      if (event.accountId) {
        console.log("[IG-INBOX-TRACE] STEP 1 - Direct Integration lookup START");

        console.log("[IG-INBOX-TRACE] Direct lookup parameters:", {
          provider,
          externalId: event.accountId,
          accountIdType: typeof event.accountId,
        });

        console.log("[Gateway] Looking for Integration:", {
          provider,
          externalId: event.accountId,
        });

        integration = await prisma.integration.findFirst({
          where: {
            provider,
            externalId: event.accountId,
            isActive: true,
          },
          select: {
            id: true,
            companyId: true,
            externalId: true,
            provider: true,
            isActive: true,
          },
        });

        console.log(
          "[IG-INBOX-TRACE] STEP 1 - Direct Integration lookup RESULT:",
          {
            found: !!integration,
            integrationId: integration?.id,
            companyId: integration?.companyId,
            externalId: integration?.externalId,
            provider: integration?.provider,
            isActive: integration?.isActive,
          }
        );

        console.log("[Gateway] Direct Integration lookup:", {
          found: !!integration,
          integrationId: integration?.id,
          companyId: integration?.companyId,
          externalId: integration?.externalId,
        });

        // -------------------------------------------------------
        // STEP 2: IntegrationAsset fallback
        // -------------------------------------------------------

        if (!integration) {
          console.log(
            "\n[IG-INBOX-TRACE] STEP 2 - IntegrationAsset lookup START"
          );

          console.log("[IG-INBOX-TRACE] IntegrationAsset parameters:", {
            provider,
            externalId: event.accountId,
            accountIdType: typeof event.accountId,
          });

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
              id: true,
              integrationId: true,
              provider: true,
              externalId: true,
              isActive: true,
            },
          });

          console.log(
            "[IG-INBOX-TRACE] STEP 2 - IntegrationAsset lookup RESULT:",
            {
              found: !!asset,
              assetId: asset?.id,
              assetIntegrationId: asset?.integrationId,
              assetProvider: asset?.provider,
              assetExternalId: asset?.externalId,
              assetIsActive: asset?.isActive,
            }
          );

          console.log("[Gateway] IntegrationAsset lookup:", {
            found: !!asset,
            integrationId: asset?.integrationId,
          });

          if (asset) {
            console.log(
              "[IG-INBOX-TRACE] STEP 2.1 - Resolving Integration from Asset:",
              {
                assetId: asset.id,
                integrationId: asset.integrationId,
              }
            );

            integration = await prisma.integration.findUnique({
              where: {
                id: asset.integrationId,
              },
              select: {
                id: true,
                companyId: true,
                externalId: true,
                provider: true,
                isActive: true,
              },
            });

            console.log(
              "[IG-INBOX-TRACE] STEP 2.2 - Integration from Asset RESULT:",
              {
                found: !!integration,
                integrationId: integration?.id,
                companyId: integration?.companyId,
                externalId: integration?.externalId,
                provider: integration?.provider,
                isActive: integration?.isActive,
              }
            );
          }
        }

        // -------------------------------------------------------
        // FINAL RESOLUTION
        // -------------------------------------------------------

        console.log(
          "\n========== [IG-INBOX-TRACE: FINAL INTEGRATION RESOLUTION] =========="
        );

        if (integration) {
          integrationId = integration.id;

          console.log("[IG-INBOX-TRACE] ✅ INTEGRATION RESOLVED:", {
            integrationId,
            companyId: integration.companyId,
            provider: integration.provider,
            externalId: integration.externalId,
            isActive: integration.isActive,
          });

          console.log("[Gateway] Integration resolved:", {
            integrationId,
            companyId: integration.companyId,
          });
        } else {
          console.error("[IG-INBOX-TRACE] ❌ INTEGRATION NOT RESOLVED:", {
            provider,
            accountId: event.accountId,
            externalEventId: event.externalEventId,
          });

          console.warn("[Gateway] ⚠️ No Integration found for event:", {
            provider,
            accountId: event.accountId,
          });
        }
      } else {
        console.error("[IG-INBOX-TRACE] ❌ EVENT HAS NO ACCOUNT ID:", {
          externalEventId: event.externalEventId,
          eventType: event.eventType,
        });

        console.warn("[Gateway] ⚠️ Event has no accountId");
      }

      console.log("[IG-INBOX-TRACE] Resolution summary:", {
        resolved: !!integration,
        integrationId,
        companyId: integration?.companyId,
      });

      // ---------------------------------------------------------
      // STEP 3: Persist webhook event
      // ---------------------------------------------------------

      console.log(
        "\n========== [IG-INBOX-TRACE: WEBHOOK EVENT PERSISTENCE] =========="
      );

      console.log("[Gateway] Persisting IntegrationWebhookEvent:", {
        provider,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        integrationId,
      });

      console.log("[IG-INBOX-TRACE] Persistence payload:", {
        provider,
        integrationId,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        hasPayload: !!event.payload,
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

      console.log("[IG-INBOX-TRACE] Persisted event details:", {
        id: saved.id,
        status: saved.status,
        integrationId: saved.integrationId,
        provider: saved.provider,
        eventType: saved.eventType,
        externalEventId: saved.externalEventId,
      });

      savedEvents.push(saved);
    } catch (error) {
      console.error(
        "========== [IG-INBOX-TRACE: SAVE ERROR] =========="
      );

      console.error("[IG-INBOX-TRACE] Failed to save webhook event:", {
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        accountId: event.accountId,
        error,
      });

      console.error(
        "[IG-INBOX-TRACE] Stack:",
        error instanceof Error ? error.stack : undefined
      );

      console.error(
        "[Gateway] ❌ Failed to save webhook event:",
        error
      );
    }
  }

  // ------------------------------------------------------------
  // Persistence complete
  // ------------------------------------------------------------

  console.log("\n========== [IG-INBOX-TRACE: PERSISTENCE COMPLETE] ==========");

  console.log("[Gateway] Persistence complete:", {
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

  console.log("\n========== [IG-INBOX-TRACE: MESSAGE DISPATCH] ==========");

  console.log("[Gateway] Pending message events:", {
    count: pendingMessageEvents.length,
    ids: pendingMessageEvents.map((e) => e.id),
  });

  for (const msgEvent of pendingMessageEvents) {
    try {
      console.log("\n------------------------------------------------------------");
      console.log(
        `[IG-INBOX-TRACE] ▶ STARTING INBOX PROCESSING: ${msgEvent.id}`
      );
      console.log("------------------------------------------------------------");

      console.log("[IG-INBOX-TRACE] Message event before processing:", {
        eventId: msgEvent.id,
        provider: msgEvent.provider,
        eventType: msgEvent.eventType,
        integrationId: msgEvent.integrationId,
        externalEventId: msgEvent.externalEventId,
      });

      console.log(
        `[Gateway] ▶ Starting inbox processing: ${msgEvent.id}`
      );

      const result = await processWebhookEvent(msgEvent.id);

      console.log(
        `[Gateway] ✅ Inbox processing completed: ${msgEvent.id}`,
        {
          status: result.status,
          integrationId: result.integrationId,
        }
      );

      console.log(
        "[IG-INBOX-TRACE] ✅ processWebhookEvent COMPLETED:",
        {
          eventId: msgEvent.id,
          status: result.status,
          integrationId: result.integrationId,
        }
      );
    } catch (err) {
      console.error(
        "\n========== [IG-INBOX-TRACE: INBOX PROCESSING ERROR] =========="
      );

      console.error(
        `[Gateway] ❌ Inbox processing failed: ${msgEvent.id}`,
        err
      );

      console.error("[IG-INBOX-TRACE] Error details:", {
        eventId: msgEvent.id,
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
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
      console.log(
        "[IG-INBOX-TRACE] Starting non-message/lead processing:",
        {
          count: pendingOtherEvents.length,
        }
      );

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

  console.log("\n============================================================");
  console.log("========== [WEBHOOK GATEWAY END] ==========");
  console.log("============================================================\n");

  return savedEvents;
}

/**
 * Processes a pending webhook event.
 * Enforces retries and updates statuses safely.
 */
export async function processWebhookEvent(eventId: string) {
  console.log("\n============================================================");
  console.log(
    "========== [IG-INBOX-TRACE: PROCESS WEBHOOK EVENT] =========="
  );
  console.log("============================================================");

  console.log("[IG-INBOX-TRACE] Loading webhook event:", {
    eventId,
  });

  const event = await prisma.integrationWebhookEvent.findUnique({
    where: { id: eventId },
    include: { integration: true },
  });

  console.log("[IG-INBOX-TRACE] Loaded webhook event:", {
    found: !!event,
    eventId: event?.id,
    provider: event?.provider,
    eventType: event?.eventType,
    externalEventId: event?.externalEventId,
    integrationId: event?.integrationId,
    hasIntegration: !!event?.integration,
    companyId: event?.integration?.companyId,
    integrationExternalId: event?.integration?.externalId,
    integrationProvider: event?.integration?.provider,
    integrationActive: event?.integration?.isActive,
  });

  if (!event) {
    console.error(
      "[IG-INBOX-TRACE] ❌ Webhook event not found:",
      eventId
    );

    throw new Error("Event not found");
  }

  if (
    event.status === "PROCESSED" ||
    event.status === "IGNORED"
  ) {
    console.log(
      "[IG-INBOX-TRACE] Event already completed:",
      {
        eventId,
        status: event.status,
      }
    );

    return event;
  }

  // ---------------------------------------------------------
  // Mark as processing
  // ---------------------------------------------------------

  console.log(
    "[IG-INBOX-TRACE] STEP - Marking event PROCESSING:",
    {
      eventId,
      previousStatus: event.status,
      retryCount: event.retryCount,
      nextRetryCount: event.retryCount + 1,
    }
  );

  await prisma.integrationWebhookEvent.update({
    where: { id: eventId },
    data: {
      status: "PROCESSING",
      retryCount: event.retryCount + 1,
    },
  });

  console.log(
    "[IG-INBOX-TRACE] Event marked PROCESSING:",
    eventId
  );

  try {
    // ---------------------------------------------------------
    // STEP 1: Integration validation
    // ---------------------------------------------------------

    console.log(
      "\n========== [IG-INBOX-TRACE: INTEGRATION VALIDATION] =========="
    );

    console.log(
      "[IG-INBOX-TRACE] Integration state before processing:",
      {
        eventId: event.id,
        integrationId: event.integrationId,
        hasIntegration: !!event.integration,
        companyId: event.integration?.companyId,
        provider: event.integration?.provider,
        externalId: event.integration?.externalId,
        isActive: event.integration?.isActive,
      }
    );

    if (
      !event.integrationId ||
      !event.integration
    ) {
      console.error(
        "[IG-INBOX-TRACE] ❌ PROCESSING ABORTED - NO ACTIVE INTEGRATION"
      );

      console.error(
        "[IG-INBOX-TRACE] Missing values:",
        {
          integrationId: event.integrationId,
          hasIntegration: !!event.integration,
        }
      );

      throw new Error(
        "No active integration found to process this event."
      );
    }

    console.log(
      "[IG-INBOX-TRACE] ✅ ACTIVE INTEGRATION AVAILABLE:",
      {
        integrationId: event.integration.id,
        companyId: event.integration.companyId,
        provider: event.integration.provider,
        externalId: event.integration.externalId,
        isActive: event.integration.isActive,
      }
    );

    // ---------------------------------------------------------
    // STEP 2: Tenant isolation
    // ---------------------------------------------------------

    console.log(
      "\n========== [IG-INBOX-TRACE: TENANT VALIDATION] =========="
    );

    console.log(
      "[IG-INBOX-TRACE] Tenant information:",
      {
        integrationId: event.integration.id,
        companyId: event.integration.companyId,
      }
    );

    if (!event.integration.companyId) {
      console.error(
        "[IG-INBOX-TRACE] ❌ Integration has no tenant assigned."
      );

      throw new Error(
        "Integration has no tenant assigned."
      );
    }

    console.log(
      "[IG-INBOX-TRACE] ✅ Tenant validation passed:",
      event.integration.companyId
    );

    // ---------------------------------------------------------
    // STEP 3: Inbox Pipeline Dispatch
    // ---------------------------------------------------------

    console.log(
      "\n========== [IG-INBOX-TRACE: INBOX PIPELINE DISPATCH] =========="
    );

    if (event.eventType === "message") {
      const channel =
        event.provider === "INSTAGRAM"
          ? "INSTAGRAM"
          : event.provider === "META"
            ? "FACEBOOK"
            : event.provider;

      console.log(
        "[IG-INBOX-TRACE] Channel determined:",
        {
          provider: event.provider,
          channel,
          eventType: event.eventType,
        }
      );

      console.log(
        "[IG-INBOX-TRACE] Calling normalizeInboundEvent:",
        {
          channel,
          integrationId: event.integrationId,
          payloadPresent: !!event.payload,
        }
      );

      const normResult = normalizeInboundEvent(
        channel,
        event.payload,
        event.integrationId
      );

      console.log(
        "[IG-INBOX-TRACE] normalizeInboundEvent RESULT:",
        {
          ok: normResult.ok,
          reason: !normResult.ok
            ? normResult.reason
            : undefined,
          hasEvent: normResult.ok,
        }
      );

      if (!normResult.ok) {
        console.info(
          `[InboxGateway] Skipped ${event.provider} message event ${event.externalEventId}: ${normResult.reason}`
        );

        console.log(
          "[IG-INBOX-TRACE] Event marked IGNORED:",
          {
            eventId,
            reason: normResult.reason,
          }
        );

        const skipped =
          await prisma.integrationWebhookEvent.update({
            where: { id: eventId },
            data: {
              status: "IGNORED",
              processedAt: new Date(),
              errorMessage: normResult.reason,
            },
          });

        return skipped;
      }

      console.log(
        "\n========== [IG-INBOX-TRACE: NORMALIZED EVENT] =========="
      );

      console.log(
        "[IG-INBOX-TRACE] Normalized inbox event:",
        {
          integrationId: normResult.event.integrationId,
          channel: normResult.event.channel,
          externalConversationId:
            normResult.event.externalConversationId,
          externalMessageId:
            normResult.event.externalMessageId,
          senderExternalId:
            normResult.event.senderExternalId,
          recipientExternalId:
            normResult.event.recipientExternalId,
          messageType:
            normResult.event.messageType,
          hasText:
            !!normResult.event.text,
        }
      );

      try {
        console.log(
          "\n========== [IG-INBOX-TRACE: PROCESS INBOX EVENT START] =========="
        );

        console.log(
          "[IG-INBOX-TRACE] Calling processInboxEvent with:",
          {
            integrationId: normResult.event.integrationId,
            channel: normResult.event.channel,
            externalConversationId:
              normResult.event.externalConversationId,
            externalMessageId:
              normResult.event.externalMessageId,
            senderExternalId:
              normResult.event.senderExternalId,
          }
        );

        const pipelineResult =
          await processInboxEvent(normResult.event);

        console.log(
          "\n========== [IG-INBOX-TRACE: PROCESS INBOX EVENT SUCCESS] =========="
        );

        console.log(
          "[IG-INBOX-TRACE] ✅ Inbox pipeline completed:",
          {
            conversationId:
              pipelineResult.conversationId,
            messageId:
              pipelineResult.messageId,
            messageStatus:
              pipelineResult.messageStatus,
          }
        );

        console.info(
          `[InboxGateway] Processed ${event.provider} message: conv=${pipelineResult.conversationId} msg=${pipelineResult.messageId} (${pipelineResult.messageStatus})`
        );
      } catch (pipelineError: any) {
        console.error(
          "\n========== [IG-INBOX-TRACE: PIPELINE ERROR] =========="
        );

        console.error(
          "[IG-INBOX-TRACE] Inbox pipeline failed:",
          {
            eventId,
            integrationId: event.integrationId,
            provider: event.provider,
            error: pipelineError,
            message:
              pipelineError instanceof Error
                ? pipelineError.message
                : String(pipelineError),
            stack:
              pipelineError instanceof Error
                ? pipelineError.stack
                : undefined,
          }
        );

        if (
          pipelineError instanceof InboxPipelineError
        ) {
          throw new Error(
            `Inbox pipeline error [${pipelineError.code}]: ${pipelineError.message}`
          );
        }

        throw pipelineError;
      }
    } else {
      console.log(
        "[IG-INBOX-TRACE] Event is not a message event:",
        {
          eventType: event.eventType,
        }
      );
    }

    // ---------------------------------------------------------
    // STEP 4: Mark as processed
    // ---------------------------------------------------------

    console.log(
      "\n========== [IG-INBOX-TRACE: MARK PROCESSED] =========="
    );

    const processed =
      await prisma.integrationWebhookEvent.update({
        where: { id: eventId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          errorMessage: null,
        },
      });

    console.log(
      "[IG-INBOX-TRACE] ✅ WEBHOOK EVENT PROCESSED:",
      {
        eventId: processed.id,
        status: processed.status,
        integrationId: processed.integrationId,
        processedAt: processed.processedAt,
      }
    );

    return processed;
  } catch (error: any) {
    // ---------------------------------------------------------
    // ERROR / RETRY
    // ---------------------------------------------------------

    console.error(
      "\n============================================================"
    );
    console.error(
      "========== [IG-INBOX-TRACE: PROCESSING ERROR] =========="
    );
    console.error(
      "============================================================"
    );

    console.error(
      "[IG-INBOX-TRACE] Processing error:",
      {
        eventId,
        provider: event.provider,
        eventType: event.eventType,
        externalEventId: event.externalEventId,
        integrationId: event.integrationId,
        companyId: event.integration?.companyId,
        retryCount: event.retryCount,
        errorMessage:
          error instanceof Error
            ? error.message
            : String(error),
        stack:
          error instanceof Error
            ? error.stack
            : undefined,
      }
    );

    const isFailed = event.retryCount >= 3;
    const finalStatus = isFailed
      ? "FAILED"
      : "PENDING";

    console.log(
      "[IG-INBOX-TRACE] Retry decision:",
      {
        retryCount: event.retryCount,
        maxRetries: 3,
        isFailed,
        finalStatus,
      }
    );

    const failedEvent =
      await prisma.integrationWebhookEvent.update({
        where: { id: eventId },
        data: {
          status: finalStatus,
          errorMessage: error.message,
        },
      });

    console.log(
      "[IG-INBOX-TRACE] Webhook event status updated after error:",
      {
        eventId: failedEvent.id,
        status: failedEvent.status,
        retryCount: failedEvent.retryCount,
        errorMessage: failedEvent.errorMessage,
      }
    );

    if (isFailed && event.integration) {
      console.log(
        "[IG-INBOX-TRACE] Permanent failure - writing audit event:",
        {
          eventId,
          integrationId: event.integration.id,
          companyId: event.integration.companyId,
        }
      );

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