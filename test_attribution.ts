import { prisma } from "./src/lib/prisma";
import { normalizeUTM, resolveSource, captureTouch } from "./src/lib/integrations/attribution-service";

async function runTests() {
  console.log("Starting Attribution Service Tests...");

  // 1. Test UTM Normalization
  console.log("Testing UTM Normalization...");
  if (normalizeUTM("  CampaignName  ") !== "campaignname") throw new Error("UTM trim/case failed");
  if (normalizeUTM("NULL") !== null) throw new Error("UTM null string failed");
  if (normalizeUTM(undefined) !== null) throw new Error("UTM undefined failed");
  console.log("✅ UTM Normalization passed");

  // 2. Test Source Resolution
  console.log("Testing Source Resolution...");
  const metaIG = resolveSource("META", { source_platform: "ig" });
  if (metaIG.platform !== "META" || metaIG.channel !== "INSTAGRAM") throw new Error("Meta IG resolution failed");
  
  const google = resolveSource("GOOGLE");
  if (google.platform !== "GOOGLE" || google.channel !== "SEARCH") throw new Error("Google resolution failed");
  console.log("✅ Source Resolution passed");

  // DB Setup
  const company = await prisma.company.create({
    data: { name: `AttrTest_Company_${Date.now()}` }
  });

  const contact = await prisma.contact.create({
    data: { companyId: company.id, name: "Attr Test Contact", email: "attr@test.com" }
  });

  const lead = await prisma.lead.create({
    data: { 
      companyId: company.id, 
      contactId: contact.id, 
      userId: (await prisma.user.create({ data: { companyId: company.id, email: "u@test.com", passwordHash: "x", name: "u" } })).id,
      name: "Attr Test Lead",
      status: "NEW"
    }
  });

  // 3. Test captureTouch Idempotency & First/Last logic
  console.log("Testing Touch Capture...");
  const firstTouchId = await captureTouch(prisma, company.id, contact.id, lead.id, null, "META", {
    externalEventId: "ext_123",
    campaignName: "Test Campaign",
    capturedAt: new Date(Date.now() - 10000)
  });

  const leadAfterFirst = await prisma.lead.findUnique({ where: { id: lead.id } });
  if (leadAfterFirst?.firstTouchId !== firstTouchId || leadAfterFirst?.lastTouchId !== firstTouchId) {
    throw new Error("First touch assignment failed");
  }

  // Duplicate (Idempotent)
  const duplicateTouchId = await captureTouch(prisma, company.id, contact.id, lead.id, null, "META", {
    externalEventId: "ext_123",
    campaignName: "Test Campaign"
  });
  if (duplicateTouchId !== firstTouchId) throw new Error("Idempotency deduplication failed");

  // Last touch
  const lastTouchId = await captureTouch(prisma, company.id, contact.id, lead.id, null, "GOOGLE", {
    externalEventId: "ext_456",
    campaignName: "Retargeting"
  });

  const leadAfterLast = await prisma.lead.findUnique({ where: { id: lead.id } });
  if (leadAfterLast?.firstTouchId !== firstTouchId) throw new Error("First touch was incorrectly overwritten");
  if (leadAfterLast?.lastTouchId !== lastTouchId) throw new Error("Last touch assignment failed");

  console.log("✅ Touch Capture passed");

  // Cleanup
  await prisma.attributionTouch.deleteMany({ where: { companyId: company.id } });
  await prisma.lead.deleteMany({ where: { companyId: company.id } });
  await prisma.user.deleteMany({ where: { companyId: company.id } });
  await prisma.contact.deleteMany({ where: { companyId: company.id } });
  await prisma.company.delete({ where: { id: company.id } });

  console.log("All tests completed successfully.");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
