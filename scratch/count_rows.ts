import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.platformMetaConfiguration.findMany();
  console.log("Total rows:", configs.length);
  console.log("Rows:", configs.map(c => ({ id: c.id, instagramAppId: c.instagramAppId, hasInstaSecret: !!c.encryptedInstagramAppSecret })));
}

main().finally(() => prisma.$disconnect());
