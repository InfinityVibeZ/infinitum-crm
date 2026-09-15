const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync('prisma/migrations/20260915_init_unified_inbox/migration.sql', 'utf8');
  await prisma.$executeRawUnsafe(sql);
  console.log('SQL executed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
