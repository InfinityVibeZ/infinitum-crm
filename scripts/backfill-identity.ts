import { PrismaClient } from "@prisma/client";
import { normalizeEmail, normalizePhone, resolveContactIdentity } from "../src/lib/integrations/identity-service";

const prisma = new PrismaClient();

async function backfillIdentity() {
  console.log("Starting backfill for Identity Engine...");

  // 1. Normalize existing Contacts
  console.log("Step 1: Normalizing existing Contacts...");
  const contacts = await prisma.contact.findMany({
    where: {
      OR: [
        { normalizedEmail: null, email: { not: null } },
        { normalizedPhone: null, phone: { not: null } }
      ]
    }
  });

  console.log(`Found ${contacts.length} contacts to normalize.`);
  let normalizedCount = 0;
  for (const c of contacts) {
    const nEmail = normalizeEmail(c.email);
    const nPhone = normalizePhone(c.phone);
    if (nEmail || nPhone) {
      try {
        await prisma.contact.update({
          where: { id: c.id },
          data: {
            normalizedEmail: nEmail,
            normalizedPhone: nPhone
          }
        });
        normalizedCount++;
      } catch (e: any) {
        console.warn(`Could not normalize contact ${c.id} - duplicate unique constraint? Error: ${e.message}`);
      }
    }
  }
  console.log(`Successfully normalized ${normalizedCount} contacts.`);

  // 2. Backfill Legacy Leads without contactId
  console.log("\nStep 2: Resolving legacy leads without contactId...");
  const legacyLeads = await prisma.lead.findMany({
    where: {
      contactId: null
    }
  });

  console.log(`Found ${legacyLeads.length} legacy leads requiring Contact resolution.`);
  let resolvedLeadsCount = 0;
  let conflictLeadsCount = 0;

  for (const lead of legacyLeads) {
    try {
      await prisma.$transaction(async (tx) => {
        const result = await resolveContactIdentity(tx, {
          companyId: lead.companyId,
          provider: "LEGACY_CRM",
          email: lead.email,
          phone: lead.phone,
          contactData: {
            name: lead.name,
            companyName: lead.company
          }
        });

        if (result.status === "CONFLICT") {
          console.warn(`Lead ${lead.id} caused a conflict during backfill. Skipped.`);
          conflictLeadsCount++;
          return;
        }

        if (result.contactId) {
          await tx.lead.update({
            where: { id: lead.id },
            data: { contactId: result.contactId }
          });
          resolvedLeadsCount++;
        }
      });
    } catch (error) {
      console.error(`Failed to process lead ${lead.id}:`, error);
    }
  }

  console.log(`Legacy leads resolved: ${resolvedLeadsCount}. Conflicts/Skipped: ${conflictLeadsCount}.`);
  console.log("\nIdentity backfill complete.");
}

backfillIdentity().catch(console.error).finally(() => prisma.$disconnect());
