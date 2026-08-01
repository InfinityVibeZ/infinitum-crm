const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const deal = await prisma.deal.findFirst({ where: { name: "Test Deal" } });
  if (!deal) {
    console.log("Test Deal not found");
    return;
  }

  console.log(`Initial stage for Test Deal: ${deal.stage}`);

  // Simulate drag and drop to PROPOSAL_SENT
  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: { stage: "PROPOSAL_SENT" },
  });

  console.log(`Updated stage for Test Deal: ${updated.stage}`);

  // Revert back to DISCOVERY_SCHEDULED
  await prisma.deal.update({
    where: { id: deal.id },
    data: { stage: "DISCOVERY_SCHEDULED" },
  });
  console.log(`Reverted stage back to: DISCOVERY_SCHEDULED`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
