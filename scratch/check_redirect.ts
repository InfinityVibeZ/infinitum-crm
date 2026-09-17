import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.systemConfig.findFirst({
    where: { key: 'META_REDIRECT_URI' }
  });
  console.log("META_REDIRECT_URI DB VALUE:", config?.value);
}

main().finally(() => prisma.$disconnect());
