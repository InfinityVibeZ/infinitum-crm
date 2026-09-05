const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT;');
  console.log('Added plain_password column');
}
main().catch(console.error).finally(() => prisma.$disconnect());
