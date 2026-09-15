const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();
async function main() {
  const setConfig = async (key, value) => {
    const existing = await prisma.systemConfig.findFirst({ where: { key } });
    if (existing) {
      await prisma.systemConfig.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.systemConfig.create({ data: { id: randomUUID(), key, value } });
    }
  };

  await setConfig('META_APP_ID', '123456789012345');
  await setConfig('META_APP_SECRET', 'dummy_secret');
  await setConfig('META_REDIRECT_URI', 'https://localhost:3000/api/settings/integrations/meta/callback');
  console.log("Config injected");
}
main().catch(console.error).finally(() => prisma.$disconnect());
