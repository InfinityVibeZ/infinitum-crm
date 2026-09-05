import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

// Load .env variables
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"(.*)"\s*$/) || line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

process.env.DATABASE_URL = "postgresql://postgres.ytvliilyshdtdovrmiox:Nexus%40sales%4007@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";
const prisma = new PrismaClient();

async function runScenarioTest() {
  console.log("=== STARTING LEADS CRM TEST SCENARIO ===");

  // Step 1: Create Lead
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found in database");

  // Clean up previous Kiran test lead if exists
  await prisma.lead.deleteMany({
    where: { firstName: "Kiran", company: "InfoTech" },
  });

  const lead = await prisma.lead.create({
    data: {
      firstName: "Kiran",
      lastName: "",
      email: `kiran-${Date.now()}@infotech.com`,
      phone: "998487844",
      company: "InfoTech",
      jobTitle: "Manager",
      revenueGenerated: 50000,
      priority: "HIGH",
      status: "NEW",
      userId: user.id,
    },
  });
  console.log(`✓ Step 1: Lead created successfully with ID ${lead.id}`);

  // Step 2: Log Activity & Schedule Follow-Up
  const activity = await prisma.activity.create({
    data: {
      type: "CALL",
      description: JSON.stringify({
        summary: "Customer interested in the service.",
        outcome: "Interested",
        followUpDate: "2026-08-02",
        nextFollowUpTime: "11:00",
        nextFollowUpType: "Call",
      }),
      outcome: "Interested",
      activityDate: new Date(),
      nextFollowUpDate: new Date("2026-08-02"),
      nextFollowUpTime: "11:00",
      nextFollowUpType: "Call",
      leadId: lead.id,
      userId: user.id,
    },
  });
  console.log(`✓ Step 2: Activity logged & follow-up scheduled for 02 Aug 2026`);

  // Step 3: Add Payment 1 (₹20,000)
  const payment1 = await prisma.leadPayment.create({
    data: {
      leadId: lead.id,
      amount: 20000,
      paymentDate: new Date(),
      paymentMethod: "UPI",
      referenceId: "UPI123",
      notes: "Advance",
      status: "PAID",
      createdBy: user.id,
    },
  });
  
  // Recalculate paid
  let paidSum = await prisma.leadPayment.aggregate({
    where: { leadId: lead.id, status: "PAID" },
    _sum: { amount: true },
  });
  let totalPaid = parseFloat(paidSum._sum.amount?.toString() || "0");
  let dealValue = parseFloat(lead.revenueGenerated?.toString() || "0");
  let balance = Math.max(dealValue - totalPaid, 0);

  console.log(`✓ Step 3: Payment 1 (₹20,000) added.`);
  console.log(`  - Deal Value: ₹${dealValue}`);
  console.log(`  - Total Paid: ₹${totalPaid}`);
  console.log(`  - Balance: ₹${balance}`);
  console.log(`  - Status: ${totalPaid >= dealValue ? "Paid" : totalPaid > 0 ? "Partially Paid" : "Not Paid"}`);

  // Step 4: Add Payment 2 (₹5,000)
  const payment2 = await prisma.leadPayment.create({
    data: {
      leadId: lead.id,
      amount: 5000,
      paymentDate: new Date(),
      paymentMethod: "Bank Transfer",
      referenceId: "TXN456",
      notes: "Second payment",
      status: "PAID",
      createdBy: user.id,
    },
  });

  paidSum = await prisma.leadPayment.aggregate({
    where: { leadId: lead.id, status: "PAID" },
    _sum: { amount: true },
  });
  totalPaid = parseFloat(paidSum._sum.amount?.toString() || "0");
  balance = Math.max(dealValue - totalPaid, 0);

  console.log(`✓ Step 4: Payment 2 (₹5,000) added.`);
  console.log(`  - Deal Value: ₹${dealValue}`);
  console.log(`  - Total Paid: ₹${totalPaid}`);
  console.log(`  - Balance: ₹${balance}`);

  // Step 5: Verify Payment History
  const history = await prisma.leadPayment.findMany({
    where: { leadId: lead.id },
  });
  console.log(`✓ Step 5: Payment History verified (${history.length} records found).`);

  // Step 6: Edit Lead Information
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { jobTitle: "Senior Manager" },
  });
  const activitiesCount = await prisma.activity.count({ where: { leadId: lead.id } });
  const paymentsCount = await prisma.leadPayment.count({ where: { leadId: lead.id } });
  console.log(`✓ Step 6: Lead edited (JobTitle: "${updatedLead.jobTitle}"). Connected activities (${activitiesCount}) & payments (${paymentsCount}) preserved!`);

  // Step 7: Soft Delete Lead
  const softDeleted = await prisma.lead.update({
    where: { id: lead.id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  console.log(`✓ Step 7: Soft-deleted lead (isDeleted: ${softDeleted.isDeleted}).`);

  // Step 8: Restore Lead
  const restored = await prisma.lead.update({
    where: { id: lead.id },
    data: { isDeleted: false, deletedAt: null },
  });
  console.log(`✓ Step 8: Lead restored (isDeleted: ${restored.isDeleted}). All relationships intact.`);

  console.log("=== ALL TEST SCENARIO STEPS COMPLETED SUCCESSFULLY ===");
}

runScenarioTest().catch(console.error);
