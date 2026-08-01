import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Completing role migration on public.users table...\n");

  // Check our specific Prisma table columns
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log("public.users columns:", JSON.stringify(cols.map(c => c.column_name)));

  const hasRole = cols.some(c => c.column_name === 'role');
  const hasRoleNew = cols.some(c => c.column_name === 'role_new');

  console.log("has 'role' column:", hasRole, "| has 'role_new' column:", hasRoleNew);

  if (hasRole && hasRoleNew) {
    // Map old values from role -> role_new
    await prisma.$executeRawUnsafe(`UPDATE public."users" SET "role_new" = 'SUPER_ADMIN' WHERE "role"::text = 'ADMIN'`);
    await prisma.$executeRawUnsafe(`UPDATE public."users" SET "role_new" = 'ADMIN' WHERE "role"::text = 'MANAGER'`);
    await prisma.$executeRawUnsafe(`UPDATE public."users" SET "role_new" = 'USER' WHERE "role"::text IN ('SETTER','CLOSER','EMPLOYEE')`);
    console.log("✓ Mapped role values");

    await prisma.$executeRawUnsafe(`ALTER TABLE public."users" DROP COLUMN "role"`);
    console.log("✓ Dropped old role column");
  }

  if (hasRoleNew) {
    await prisma.$executeRawUnsafe(`ALTER TABLE public."users" RENAME COLUMN "role_new" TO "role"`);
    console.log("✓ Renamed role_new -> role");
  }

  // Rename enum
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role_new" RENAME TO "Role"`);
    console.log("✓ Renamed Role_new -> Role");
  } catch (e) {
    console.log("- Rename skipped:", e.meta?.message);
  }

  // Final verification
  const finalCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, udt_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log("\nFinal public.users columns:", JSON.stringify(finalCols.map(c => `${c.column_name}(${c.udt_name})`)));

  const sample = await prisma.$queryRawUnsafe(`SELECT id, name, role FROM public."users" LIMIT 5`);
  console.log("\nSample users:", JSON.stringify(sample));

  console.log("\n✅ Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
