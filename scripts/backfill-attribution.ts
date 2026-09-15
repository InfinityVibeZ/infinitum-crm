import { PrismaClient } from "@prisma/client";
import { resolveSource, captureTouch } from "../src/lib/integrations/attribution-service";

const prisma = new PrismaClient();

async function backfillAttribution() {
  console.log("Starting backfill for existing leads with attribution data...");

  // Find all leads that have a sourcePlatform but no firstTouchId
  const legacyLeads = await prisma.lead.findMany({
    where: {
      sourcePlatform: { not: null },
      firstTouchId: null
    }
  });

  console.log(`Found ${legacyLeads.length} leads requiring backfill.`);

  let successCount = 0;
  let failCount = 0;

  for (const lead of legacyLeads) {
    try {
      await prisma.$transaction(async (tx) => {
        // Backfill generic touches
        await captureTouch(tx, lead.companyId, lead.contactId, lead.id, lead.integrationId, lead.sourcePlatform || "UNKNOWN", {
          externalEventId: lead.externalLeadId || `backfill_${lead.id}`,
          campaignId: lead.campaignId,
          adSetId: lead.adSetId,
          adId: lead.adId,
          creativeId: lead.creativeId,
          formId: lead.formId,
          utmSource: lead.utmSource,
          utmMedium: lead.utmMedium,
          utmCampaign: lead.utmCampaign,
          utmTerm: lead.utmTerm,
          utmContent: lead.utmContent,
          capturedAt: lead.createdAt
        });
      });
      successCount++;
    } catch (error) {
      console.error(`Failed to backfill lead ${lead.id}:`, error);
      failCount++;
    }
  }

  console.log(`Backfill complete. Success: ${successCount}. Failures: ${failCount}`);
}

backfillAttribution().catch(console.error).finally(() => prisma.$disconnect());
