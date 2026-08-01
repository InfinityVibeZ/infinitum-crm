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

async function checkUsersAndLeads() {
  const users = await prisma.user.findMany();
  console.log("=== USERS IN DB ===");
  users.forEach((u) => {
    console.log({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      company: u.company,
      companyId: u.companyId,
      createdBy: u.createdBy,
    });
  });

  const leads = await prisma.lead.findMany({
    include: { user: true }
  });
  console.log("\n=== LEADS IN DB ===");
  leads.forEach((l) => {
    console.log({
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      email: l.email,
      company: l.company,
      assignedUser: l.user?.name,
      assignedUserEmail: l.user?.email,
      assignedUserRole: l.user?.role,
      assignedUserCompany: l.user?.company,
      assignedUserCompanyId: l.user?.companyId,
      assignedUserCreatedBy: l.user?.createdBy,
      isDeleted: l.isDeleted,
    });
  });
}

checkUsersAndLeads().catch(console.error);
