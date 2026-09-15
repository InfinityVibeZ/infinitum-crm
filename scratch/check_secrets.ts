import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.platformMetaConfiguration.findFirst();
  console.log("META CONFIG:");
  console.log("appId:", config?.appId);
  console.log("instagramAppId:", config?.instagramAppId);
  console.log("encryptedAppSecret length:", config?.encryptedAppSecret?.length);
  console.log("encryptedInstagramAppSecret length:", config?.encryptedInstagramAppSecret?.length);
}

main().finally(() => prisma.$disconnect());
