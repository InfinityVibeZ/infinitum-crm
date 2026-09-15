import { prisma } from "./src/lib/prisma";
import { resolveContactIdentity, normalizeEmail, normalizePhone } from "./src/lib/integrations/identity-service";

async function runTests() {
  console.log("Starting Identity Engine Tests...");

  // 1. Normalization Tests
  if (normalizeEmail(" TEST@example.com  ") !== "test@example.com") throw new Error("Email normalization failed");
  if (normalizePhone(" +1 (555) 123-4567 ") !== "+15551234567") throw new Error("Phone normalization failed");
  console.log("✅ Normalization passed");

  const company = await prisma.company.create({
    data: { name: `IdTest_Company_${Date.now()}` }
  });

  const company2 = await prisma.company.create({
    data: { name: `IdTest_Company2_${Date.now()}` }
  });

  try {
    // 2. New Contact Creation
    const res1 = await resolveContactIdentity(prisma, {
      companyId: company.id,
      provider: "META",
      externalId: "meta_123",
      email: "new@example.com",
      phone: "+15550000000"
    });
    if (res1.status !== "CREATED" || !res1.contactId) throw new Error("New contact creation failed");
    console.log("✅ New Contact creation passed");

    // 3. Exact Provider Identity Match
    const res2 = await resolveContactIdentity(prisma, {
      companyId: company.id,
      provider: "META",
      externalId: "meta_123",
      email: "different@example.com" // Provider ID should override email mismatch here (it's the exact same identity)
    });
    if (res2.status !== "MATCHED" || res2.contactId !== res1.contactId) throw new Error("Provider match failed");
    console.log("✅ Exact Provider match passed");

    // 4. Exact Email Match
    const res3 = await resolveContactIdentity(prisma, {
      companyId: company.id,
      provider: "WEBSITE",
      externalId: "web_456",
      email: "NEW@example.com"
    });
    if (res3.status !== "MATCHED" || res3.contactId !== res1.contactId) throw new Error("Email match failed");
    console.log("✅ Email match passed");

    // 5. Cross-tenant isolation
    const res4 = await resolveContactIdentity(prisma, {
      companyId: company2.id,
      provider: "META",
      externalId: "meta_123",
      email: "new@example.com"
    });
    if (res4.status !== "CREATED") throw new Error("Cross-tenant isolation failed");
    console.log("✅ Cross-tenant isolation passed");

    // 6. Conflict Detection
    // Create another contact manually
    const contactB = await prisma.contact.create({
      data: {
        companyId: company.id,
        name: "Contact B",
        email: "contactb@example.com",
        normalizedEmail: "contactb@example.com",
        phone: "+999999999",
        normalizedPhone: "+999999999"
      }
    });

    const res5 = await resolveContactIdentity(prisma, {
      companyId: company.id,
      provider: "API",
      externalId: "api_789",
      email: "new@example.com", // Matches Contact A
      phone: "+999999999"       // Matches Contact B
    });

    if (res5.status !== "CONFLICT") throw new Error("Conflict detection failed");
    console.log("✅ Conflict detection passed");

  } finally {
    // Cleanup
    await prisma.contactIdentity.deleteMany({ where: { companyId: { in: [company.id, company2.id] } } });
    await prisma.contact.deleteMany({ where: { companyId: { in: [company.id, company2.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [company.id, company2.id] } } });
    await prisma.$disconnect();
  }

  console.log("All Identity tests passed successfully.");
}

runTests().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
