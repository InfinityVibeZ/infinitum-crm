import { prisma } from "./src/lib/prisma";
import { getProvider } from "./src/lib/integrations/provider-registry";
import { receiveWebhookEvents } from "./src/lib/integrations/webhook-gateway";

async function runTests() {
  console.log("Starting Meta Integration Tests...");

  const provider = getProvider("META");
  if (!provider) throw new Error("Meta provider not registered");
  console.log("✅ Meta Provider loaded");

  // Setup mock tenant
  const company = await prisma.company.create({
    data: { name: `MetaTest_Company_${Date.now()}` }
  });

  const integration = await prisma.integration.create({
    data: {
      companyId: company.id,
      provider: "META",
      type: "OAUTH",
      externalId: "meta_acct_123",
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
      externalId: "page_123",
      name: "Test Page",
      isActive: true,
    }
  });
  console.log("✅ Created mock Integration and Asset");

  // Test webhook parsing
  const mockPayload = {
    object: "page",
    entry: [
      {
        id: "page_123",
        messaging: [{ message: { mid: "mid_123" } }]
      }
    ]
  };

  const events = provider.extractEvents!(mockPayload);
  if (events.length === 1 && events[0].accountId === "page_123") {
    console.log("✅ Meta Webhook payload extracted correctly.");
  } else {
    console.error("❌ Meta Webhook extraction failed.");
  }

  // Test Gateway resolution
  const saved = await receiveWebhookEvents("META", events);
  if (saved.length === 1 && saved[0].integrationId === integration.id) {
    console.log("✅ Gateway properly resolved Integration via Asset's externalId.");
  } else {
    console.error("❌ Gateway resolution via Asset failed.");
  }

  // Cleanup
  await prisma.integrationWebhookEvent.deleteMany({
    where: { provider: "META" }
  });
  await prisma.integrationAsset.delete({ where: { id: asset.id } });
  await prisma.integration.delete({ where: { id: integration.id } });
  await prisma.company.delete({ where: { id: company.id } });

  console.log("Tests completed.");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
