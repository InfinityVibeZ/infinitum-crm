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

async function checkLeads() {
  const leads = await prisma.lead.findMany({
    include: { user: true }
  });
  console.log("TOTAL LEADS IN DB:", leads.length);
  leads.forEach((l) => {
    console.log({
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      email: l.email,
      company: l.company,
      isDeleted: l.isDeleted,
      userId: l.userId,
      userEmail: l.user?.email,
      userRole: l.user?.role,
      userCompany: l.user?.company,
      userCompanyId: l.user?.companyId
    });
  });
}
checkLeads().catch(console.error);
