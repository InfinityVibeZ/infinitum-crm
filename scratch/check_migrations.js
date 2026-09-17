const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$queryRawUnsafe('SELECT migration_name FROM _prisma_migrations')
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
