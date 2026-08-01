const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deals = await prisma.deal.findMany({ include: { lead: true, user: true } });
  console.log('Deals count:', deals.length);
  console.log(JSON.stringify(deals, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
