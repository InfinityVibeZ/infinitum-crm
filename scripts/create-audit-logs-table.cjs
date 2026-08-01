const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

const prisma = new PrismaClient();

async function main() {
  console.log("Creating public.audit_logs table if not exists...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public."audit_logs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "action" VARCHAR(255) NOT NULL,
      "category" VARCHAR(100) NOT NULL DEFAULT 'User Management',
      "severity" VARCHAR(50) NOT NULL DEFAULT 'INFO',
      "actor_name" VARCHAR(255) NOT NULL,
      "actor_email" VARCHAR(255) NOT NULL,
      "actor_role" VARCHAR(50),
      "target_name" VARCHAR(255),
      "summary" TEXT NOT NULL,
      "details" JSONB,
      "ip_address" VARCHAR(50),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✓ Table created.");

  console.log("Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("✅ Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
