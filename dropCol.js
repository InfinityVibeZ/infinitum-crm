const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE users DROP COLUMN IF EXISTS plain_password;');
  console.log('Dropped plain_password column');
}
main().catch(console.error).finally(() => prisma.$disconnect());
