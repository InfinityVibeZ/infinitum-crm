import { prisma } from "@/lib/prisma";
import { getProvider } from "./provider-registry";
import { getIntegrationCredentials } from "@/lib/integrations";
import { logAuditEvent } from "@/lib/audit";
import { captureTouch } from "./attribution-service";
import { resolveContactIdentity } from "./identity-service";
import { assignLead } from "./assignment-service";

export async function processLeadWebhookEvents() {
  const pendingEvents = await prisma.integrationWebhookEvent.findMany({
    where: {
      status: "PENDING",
    },
    take: 50,
  });

  if (pendingEvents.length === 0) return;

  for (const event of pendingEvents) {
    try {
      await processSingleEvent(event);
    } catch (error: any) {
      console.error(`Failed to process webhook event ${event.id}:`, error);
      
      const isAuthError = error.code === "AUTH_FAILED";
      
      await prisma.integrationWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          errorMessage: error.message || "Unknown processing error",
          retryCount: { increment: 1 }
        }
      });
    }
  }
}

async function processSingleEvent(event: any) {
  const SUPPORTED_LEAD_PROVIDERS = ["META", "INSTAGRAM"];

  if (!SUPPORTED_LEAD_PROVIDERS.includes(event.provider)) {
    // Unknown provider — mark processed and skip
    await prisma.integrationWebhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED" }
    });
    return;
  }

  // Message events are handled by the inbox pipeline (webhook-gateway.ts).
  // The lead processor only handles lead generation events (e.g. "leadgen").
  if (event.eventType === "message") {
    // Already handled upstream by the inbox pipeline — just mark processed here
    // if it somehow arrives without being routed (safety valve).
    await prisma.integrationWebhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED" }
    });
    return;
  }


  // 1. Resolve Integration
  if (!event.integrationId) {
    throw new Error("No associated integration found for event");
  }

  const integration = await prisma.integration.findUnique({
    where: { id: event.integrationId }
  });

  if (!integration) throw new Error("Integration not found");
  const companyId = integration.companyId;

  const provider = getProvider(event.provider);
  if (!provider || !provider.getLeadDetails) {
    throw new Error(`Provider ${event.provider} does not support lead retrieval`);
  }

  const credentials = await getIntegrationCredentials(integration.id, companyId);
  if (!credentials) throw new Error("No credentials available for integration");

  // 2. Fetch Lead Details from Meta
  const leadDetails = await provider.getLeadDetails(credentials, event.externalEventId);
  const { normalized, customFields, externalLeadId, formId, pageId, adId, campaignId, adsetId } = leadDetails;

  if (!normalized.email && !normalized.phone) {
    throw new Error("Lead missing both email and phone - cannot resolve identity reliably");
  }

  // 3. Perform Transactional Identity Resolution and Creation
  await prisma.$transaction(async (tx) => {
    // Call the centralized Identity Engine
    const identityResult = await resolveContactIdentity(tx, {
      companyId,
      provider: "META",
      externalId: externalLeadId,
      email: normalized.email,
      phone: normalized.phone,
      integrationId: integration.id,
      contactData: {
        name: normalized.name || "New Meta Lead",
        companyName: normalized.companyName,
        city: normalized.city,
        state: normalized.state,
        country: normalized.country,
        customFields: customFields
      }
    });

    if (identityResult.status === "CONFLICT") {
      throw new Error(`Identity conflict detected. Cannot safely merge. Candidates: ${identityResult.conflicts?.join(", ")}`);
    }

    const contactId = identityResult.contactId;

    if (!contactId) {
      throw new Error("Failed to resolve or create contact identity");
    }

    // 4. Create Lead Opportunity
    // Check idempotency again at Lead level
    const existingLead = await tx.lead.findUnique({
      where: {
        companyId_integrationId_externalLeadId: {
          companyId,
          integrationId: integration.id,
          externalLeadId
        }
      }
    });

    let resolvedLeadId = existingLead?.id;

    if (!existingLead) {
      const company = await tx.company.findUnique({ where: { id: companyId }});
      let leadOwnerId = company?.ownerUserId;
      if (!leadOwnerId) {
        // Fallback to finding any admin user in the company
        const adminUser = await tx.user.findFirst({
          where: { companyId, role: "ADMIN" }
        });
        if (adminUser) {
          leadOwnerId = adminUser.id;
        } else {
          // Fallback to any user
          const anyUser = await tx.user.findFirst({
            where: { companyId }
          });
          if (anyUser) leadOwnerId = anyUser.id;
        }
      }

      const leadData: any = {
        companyId,
        contactId,
        name: normalized.name || "Unknown",
        email: normalized.email,
        phone: normalized.phone,
        company: normalized.companyName,
        source: "META_LEAD",
        status: "NEW",
        priority: "MEDIUM",
        sourcePlatform: "META",
        externalLeadId,
        integrationId: integration.id,
        adId,
        adSetId: adsetId,
        campaignId,
        formId,
        pageId,
        userId: leadOwnerId, // Use the fallback owner resolved above
        firstTouchId: null,
        lastTouchId: null,
        conversionTouchId: null,
      };

      const lead = await tx.lead.create({
        data: leadData
      });

      resolvedLeadId = lead.id;

      // 5. Automatic Lead Assignment
      const assignmentResult = await assignLead(tx, {
        companyId,
        leadId: resolvedLeadId,
        trigger: "LEAD_CREATED",
        context: { sourcePlatform: "META", campaignId }
      });

      await logAuditEvent({
        action: "LEAD_CREATED",
        category: "Sales",
        severity: "SUCCESS",
        actorName: "System",
        actorEmail: "",
        actorRole: "ADMIN",
        summary: `Lead opportunity created for ${normalized.name} from Meta`
      });
    }

    // Capture Attribution Touch
    await captureTouch(tx, companyId, contactId, resolvedLeadId || null, integration.id, "META", {
      externalEventId: event.externalEventId,
      campaignId,
      adSetId: adsetId,
      adId,
      formId,
      capturedAt: leadDetails.createdTime ? new Date(leadDetails.createdTime) : new Date()
    });

    // Mark event processed
    await tx.integrationWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        errorMessage: null
      }
    });
  });
}
