import { prisma } from "./src/lib/prisma";
import { getProvider } from "./src/lib/integrations/provider-registry";
import { receiveWebhookEvents } from "./src/lib/integrations/webhook-gateway";
import { processLeadWebhookEvents } from "./src/lib/integrations/lead-processor";

async function runTests() {
  console.log("Starting Lead Processor Tests...");

  // Setup mock tenant
  const company = await prisma.company.create({
    data: { name: `LeadTest_Company_${Date.now()}` }
  });

  const integration = await prisma.integration.create({
    data: {
      companyId: company.id,
      provider: "META",
      type: "OAUTH",
      externalId: "meta_acct_456",
      displayName: "Meta Test Acc",
      status: "CONNECTED",
    }
  });

  // Mock Asset connection (e.g. Page or Instagram)
  const asset = await prisma.integrationAsset.create({
    data: {
      integrationId: integration.id,
      companyId: company.id,
      provider: "META",
      assetType: "PAGE",
      externalId: "page_456",
      name: "Test Page",
      isActive: true,
    }
  });
  console.log("✅ Created mock Integration and Asset");

  const provider = getProvider("META");
  
  // MOCK the getLeadDetails function to avoid real API calls
  provider.getLeadDetails = async (credentials: any, leadId: string) => {
    if (leadId === "lead_fail") {
       const err: any = new Error("Meta access token invalid or expired");
       err.code = "AUTH_FAILED";
       throw err;
    }
    return {
      externalLeadId: leadId,
      createdTime: new Date().toISOString(),
      formId: "form_123",
      normalized: {
        email: `test_${leadId}@example.com`,
        phone: "1234567890",
        name: `Test Lead ${leadId}`
      },
      customFields: {}
    };
  };

  // Test 1: Valid new lead
  const mockPayload = {
    object: "page",
    entry: [
      {
        id: "page_456",
        changes: [
          {
            field: "leadgen",
            value: {
              leadgen_id: "lead_123"
            }
          }
        ]
      }
    ]
  };

  const events = provider.extractEvents!(mockPayload);
  
  // Webhook Gateway receives it (and triggers background process async, but we will call it manually to await it)
  await receiveWebhookEvents("META", events);
  console.log("✅ Webhook Gateway persisted event");

  // Run processor manually to wait for it
  await processLeadWebhookEvents();
  
  // Verify Contact created
  const contact = await prisma.contact.findFirst({
    where: { companyId: company.id, email: "test_lead_123@example.com" }
  });
  if (contact) console.log("✅ Contact created successfully");
  else console.error("❌ Contact creation failed");

  // Verify Lead created
  const lead = await prisma.lead.findFirst({
    where: { companyId: company.id, externalLeadId: "lead_123" }
  });
  if (lead && lead.contactId === contact?.id && lead.sourcePlatform === "META") {
    console.log("✅ Lead created and linked to Contact with attribution");
  } else {
    console.error("❌ Lead creation or attribution failed");
  }

  // Test 2: Idempotency - Same lead again
  await receiveWebhookEvents("META", events);
  await processLeadWebhookEvents();
  
  const leadCount = await prisma.lead.count({
    where: { companyId: company.id, externalLeadId: "lead_123" }
  });
  if (leadCount === 1) console.log("✅ Idempotency works: duplicate Lead not created");
  else console.error("❌ Idempotency failed: multiple leads created");

  // Test 3: Existing Contact matched by email (new lead from same person)
  const mockPayload2 = {
    object: "page",
    entry: [{ id: "page_456", changes: [{ field: "leadgen", value: { leadgen_id: "lead_123_new_form" } }] }]
  };
  provider.getLeadDetails = async (credentials: any, leadId: string) => {
    return {
      externalLeadId: leadId,
      createdTime: new Date().toISOString(),
      formId: "form_456",
      normalized: { email: `test_lead_123@example.com`, name: "Same Person" },
      customFields: {}
    };
  };

  const events2 = provider.extractEvents!(mockPayload2);
  await receiveWebhookEvents("META", events2);
  await processLeadWebhookEvents();

  const newLead = await prisma.lead.findFirst({
    where: { companyId: company.id, externalLeadId: "lead_123_new_form" }
  });
  if (newLead && newLead.contactId === contact?.id) {
    console.log("✅ Existing Contact successfully matched for new Lead opportunity");
  } else {
    console.error("❌ Contact matching failed");
  }

  const contactCount = await prisma.contact.count({ where: { companyId: company.id } });
  if (contactCount === 1) console.log("✅ Idempotency works: duplicate Contact not created");
  else console.error("❌ Idempotency failed: multiple Contacts created");

  // Test 4: Auth Failure Handling
  const mockPayloadFail = {
    object: "page",
    entry: [{ id: "page_456", changes: [{ field: "leadgen", value: { leadgen_id: "lead_fail" } }] }]
  };
  const eventsFail = provider.extractEvents!(mockPayloadFail);
  await receiveWebhookEvents("META", eventsFail);
  await processLeadWebhookEvents();

  const failedEvent = await prisma.integrationWebhookEvent.findFirst({
    where: { externalEventId: "lead_fail" }
  });

  if (failedEvent && failedEvent.status === "FAILED") {
    console.log("✅ Meta Auth failures transition event to FAILED safely for retry");
  } else {
    console.error("❌ Error handling failed", failedEvent?.status);
  }

  // Cleanup
  await prisma.integrationWebhookEvent.deleteMany({ where: { provider: "META" } });
  await prisma.lead.deleteMany({ where: { companyId: company.id } });
  await prisma.contactIdentity.deleteMany({ where: { companyId: company.id } });
  await prisma.contact.deleteMany({ where: { companyId: company.id } });
  await prisma.integrationAsset.delete({ where: { id: asset.id } });
  await prisma.integration.delete({ where: { id: integration.id } });
  await prisma.company.delete({ where: { id: company.id } });

  console.log("Tests completed.");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
