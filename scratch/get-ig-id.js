const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const ig = await prisma.integration.findFirst({
    where: { provider: 'INSTAGRAM', status: 'CONNECTED' },
    select: { id: true, companyId: true, externalId: true, displayName: true },
  });
  if (!ig) { console.log('No CONNECTED Instagram integration'); }
  else {
    console.log('id:', ig.id);
    console.log('companyId:', ig.companyId);
    console.log('externalId:', ig.externalId);
    console.log('displayName:', ig.displayName);
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
