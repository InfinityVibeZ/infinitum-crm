const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE active_sessions DROP COLUMN IF EXISTS token_hash, DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS created_at;');
  console.log('Dropped unused columns from active_sessions');
}
main().catch(console.error).finally(() => prisma.$disconnect());
