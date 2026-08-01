const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

const prisma = new PrismaClient();

async function main() {
  console.log("Adding plain_password column to public.users table if not exists...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public."users" ADD COLUMN IF NOT EXISTS "plain_password" TEXT;
  `);
  console.log("✓ Column added.");

  console.log("Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("✅ Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
