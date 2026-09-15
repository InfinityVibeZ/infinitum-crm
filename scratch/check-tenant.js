const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const events = await prisma.integrationWebhookEvent.findMany({
    where: { provider: 'INSTAGRAM', externalEventId: { startsWith: 'test_' } },
    orderBy: { receivedAt: 'desc' },
    take: 3,
    include: { integration: { select: { id: true, companyId: true, provider: true, status: true } } },
  });
  for (const e of events) {
    console.log('eventId:', e.externalEventId);
    console.log('status:', e.status);
    console.log('integrationId:', e.integrationId);
    console.log('event integration companyId:', e.integration ? e.integration.companyId : 'NULL (no integration linked)');
    console.log('---');
  }
  const ig = await prisma.integration.findFirst({ where: { provider: 'INSTAGRAM', status: 'CONNECTED' }, select: { id: true, companyId: true } });
  console.log('findFirst INSTAGRAM CONNECTED:', ig ? JSON.stringify(ig) : 'not found');
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
