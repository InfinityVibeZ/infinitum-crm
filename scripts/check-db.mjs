import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check current state of users table
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, udt_name, column_default
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log("Current users columns:");
  console.log(JSON.stringify(cols, null, 2));

  // Check existing enums
  const enums = await prisma.$queryRawUnsafe(`
    SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname
  `);
  console.log("\nExisting enums:", JSON.stringify(enums));
}

main().catch(console.error).finally(() => prisma.$disconnect());
