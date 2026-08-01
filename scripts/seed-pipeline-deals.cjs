const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const superAdmin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!superAdmin) {
    console.log("No super admin found");
    return;
  }

  // Create leads first
  const lead1 = await prisma.lead.upsert({
    where: { email: "sokkurmia1949@gmail.com" },
    update: {},
    create: {
      firstName: "Zawad",
      lastName: "Uzzaman",
      email: "sokkurmia1949@gmail.com",
      company: "Lmnopq, Corp.",
      leadSource: "OTHER",
      userId: superAdmin.id,
    },
  });

  const lead2 = await prisma.lead.upsert({
    where: { email: "mani@growthcreators.ai" },
    update: {},
    create: {
      firstName: "Mani",
      lastName: "Kanasani",
      email: "mani@growthcreators.ai",
      company: "AI Growth Partners Inc.",
      phone: "7762880303",
      leadSource: "OTHER",
      userId: superAdmin.id,
    },
  });

  const lead3 = await prisma.lead.upsert({
    where: { email: "wore.revamp-8i@icloud.com" },
    update: {},
    create: {
      firstName: "Jay",
      lastName: "Dee",
      email: "wore.revamp-8i@icloud.com",
      company: "XYZ Inc.",
      leadSource: "COLD_EMAIL",
      userId: superAdmin.id,
    },
  });

  const lead4 = await prisma.lead.upsert({
    where: { email: "abc@corpsystems.com" },
    update: {},
    create: {
      firstName: "Mani",
      lastName: "Kanasani",
      email: "abc@corpsystems.com",
      company: "ABC Corp Systems",
      leadSource: "REFERRAL",
      userId: superAdmin.id,
    },
  });

  // Create Deals
  const dealsData = [
    {
      name: "Lmnopq, Corp.",
      stage: "NEW_OPPORTUNITY",
      value: 3000,
      probability: 50,
      serviceType: "AIGC Systems",
      dealSource: "Facebook",
      expectedCloseDate: new Date("2026-07-17"),
      createdAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000), // 55 days ago
      leadId: lead1.id,
      userId: superAdmin.id,
    },
    {
      name: "Test Deal",
      stage: "DISCOVERY_SCHEDULED",
      value: 25000,
      probability: 60,
      serviceType: "AIGC Systems",
      dealSource: "Skool Group",
      expectedCloseDate: new Date("2026-07-30"),
      createdAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), // 13 days ago
      leadId: lead2.id,
      userId: superAdmin.id,
    },
    {
      name: "XYZ Inc.",
      stage: "PROPOSAL_PREP",
      value: 0,
      probability: 50,
      serviceType: "Ongoing Support",
      dealSource: "Cold Outreach",
      expectedCloseDate: new Date("2026-07-09"),
      createdAt: new Date(Date.now() - 64 * 24 * 60 * 60 * 1000), // 64 days ago
      leadId: lead3.id,
      userId: superAdmin.id,
    },
    {
      name: "ABC Corp Systems",
      stage: "PROPOSAL_PREP",
      value: 15000,
      probability: 50,
      serviceType: "Custom Projects",
      dealSource: "Referral",
      expectedCloseDate: new Date("2026-08-15"),
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      leadId: lead4.id,
      userId: superAdmin.id,
    },
  ];

  for (const d of dealsData) {
    const existing = await prisma.deal.findFirst({ where: { name: d.name } });
    if (!existing) {
      await prisma.deal.create({ data: d });
    }
  }

  console.log("Seeded deals successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
