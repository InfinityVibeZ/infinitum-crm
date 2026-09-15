import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`PRAGMA table_info(PlatformMetaConfiguration);`;
  console.log(result);
}

main().finally(() => prisma.$disconnect());
