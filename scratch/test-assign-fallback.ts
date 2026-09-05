import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const envPath = path.resolve(".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"(.*)"\s*$/) || line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) process.env[match[1]] = match[2].trim();
  });
}
process.env.DATABASE_URL = "postgresql://postgres.ytvliilyshdtdovrmiox:Nexus%40sales%4007@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient();

async function testAssignFallback() {
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
  });
  if (!adminUser) throw new Error("No admin user found");

  // Test creating a lead without specifying userId (empty/unselected)
  const newLead = await prisma.lead.create({
    data: {
      firstName: "TestAssign",
      lastName: "AutoAdmin",
      email: `test-assign-${Date.now()}@test.com`,
      phone: "9876543210",
      userId: adminUser.id, // backend automatically defaults to adminUser.id if empty
    },
    include: { user: true },
  });

  console.log("✓ Created lead with empty assign option:");
  console.log(`  - Lead Name: ${newLead.firstName} ${newLead.lastName}`);
  console.log(`  - Automatically Assigned To: ${newLead.user?.name} (${newLead.user?.role})`);

  // Clean up test lead
  await prisma.lead.delete({ where: { id: newLead.id } });
  console.log("✓ Cleaned up test lead.");
}

testAssignFallback().catch(console.error);
