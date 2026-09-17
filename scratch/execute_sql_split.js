const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync('prisma/migrations/20260915_init_unified_inbox/migration.sql', 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      console.log('Executed:', statement.substring(0, 50) + '...');
    } catch (e) {
      console.error('Failed:', statement.substring(0, 50) + '...', e.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
