const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.$queryRawUnsafe('SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = \'active_sessions\';');
  console.log(result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
