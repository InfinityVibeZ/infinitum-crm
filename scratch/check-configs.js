const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkConfigs() {
  const configs = await prisma.platformMetaConfiguration.findMany();
  console.log("Configs count:", configs.length);
  configs.forEach(c => {
     console.log(`ID: ${c.id}, Enabled: ${c.enabled}, AppId: ${c.appId}`);
  });
}
checkConfigs().finally(() => prisma.$disconnect());
