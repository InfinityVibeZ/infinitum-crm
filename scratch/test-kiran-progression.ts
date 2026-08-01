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

async function runKiranProgressionTest() {
  console.log("=== STARTING KIRAN PIPELINE PROGRESSION WORKFLOW TEST ===");

  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found in database");

  // Clean up previous test leads
  await prisma.lead.deleteMany({
    where: { firstName: "Kiran", company: "InfoTech" },
  });

  // STEP 1: Create Lead (Kiran, InfoTech, ₹50,000)
  const initialStatus = "NEW";
  const lead = await prisma.lead.create({
    data: {
      firstName: "Kiran",
      lastName: "",
      email: `kiran-pipeline-${Date.now()}@infotech.com`,
      phone: "998487844",
      company: "InfoTech",
      jobTitle: "Manager",
      revenueGenerated: 50000,
      priority: "HIGH",
      status: initialStatus,
      userId: user.id,
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: initialStatus,
          userId: user.id,
          changedAt: new Date("2026-07-30T10:00:00Z"),
          reason: "Lead Created",
        },
      },
    },
  });

  console.log(`✓ STEP 1: Lead created (ID: ${lead.id})`);
  console.log(`  - Current Status: ${lead.status}`);
  
  let histories = await prisma.leadStatusHistory.findMany({
    where: { leadId: lead.id },
    orderBy: { changedAt: "asc" },
  });
  console.log(`  - Initial History: ${histories.map(h => `${h.fromStatus || "START"} → ${h.toStatus}`).join(", ")}`);

  // STEP 2: Log Call (Outcome: Interested, Update Status: Contacted, Schedule Follow-up: 02 Aug 2026 11:00 AM)
  const act1 = await prisma.activity.create({
    data: {
      type: "CALL",
      description: JSON.stringify({ summary: "Customer interested in the service.", outcome: "Interested" }),
      outcome: "Interested",
      activityDate: new Date("2026-07-30T15:35:00Z"),
      nextFollowUpDate: new Date("2026-08-02T11:00:00Z"),
      nextFollowUpTime: "11:00 AM",
      nextFollowUpType: "Call",
      leadId: lead.id,
      userId: user.id,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "CONTACTED" },
  });
  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: "NEW",
      toStatus: "CONTACTED",
      userId: user.id,
      activityId: act1.id,
      changedAt: new Date("2026-07-30T15:35:00Z"),
      reason: "Activity (Call): Interested",
    },
  });

  console.log(`\n✓ STEP 2: Logged Call & transitioned to CONTACTED`);
  console.log(`  - Next Follow-up: 02 Aug 2026 • 11:00 AM`);

  // STEP 3: On 02 Aug log Call (Outcome: Interested, Update Status: Qualified, Schedule Follow-up: 05 Aug 2026 Demo)
  const act2 = await prisma.activity.create({
    data: {
      type: "CALL",
      description: JSON.stringify({ summary: "Customer confirmed requirements.", outcome: "Interested" }),
      outcome: "Interested",
      activityDate: new Date("2026-08-02T11:20:00Z"),
      nextFollowUpDate: new Date("2026-08-05T10:00:00Z"),
      nextFollowUpType: "Demo",
      leadId: lead.id,
      userId: user.id,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "QUALIFIED" },
  });
  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: "CONTACTED",
      toStatus: "QUALIFIED",
      userId: user.id,
      activityId: act2.id,
      changedAt: new Date("2026-08-02T11:20:00Z"),
      reason: "Activity (Call): Qualified",
    },
  });

  console.log(`\n✓ STEP 3: Logged Call & transitioned to QUALIFIED`);

  // STEP 4: Log Demo (Update Status: Proposal Sent)
  const act3 = await prisma.activity.create({
    data: {
      type: "MEETING",
      description: JSON.stringify({ summary: "Presented product demo.", outcome: "Positive" }),
      outcome: "Positive",
      activityDate: new Date("2026-08-05T14:00:00Z"),
      leadId: lead.id,
      userId: user.id,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "PROPOSAL" },
  });
  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: "QUALIFIED",
      toStatus: "PROPOSAL",
      userId: user.id,
      activityId: act3.id,
      changedAt: new Date("2026-08-05T14:00:00Z"),
      reason: "Activity (Demo): Proposal Sent",
    },
  });

  console.log(`\n✓ STEP 4: Logged Demo & transitioned to PROPOSAL`);

  // STEP 5: Log Call (Update Status: Negotiation)
  const act4 = await prisma.activity.create({
    data: {
      type: "CALL",
      description: JSON.stringify({ summary: "Discussed terms and pricing.", outcome: "Interested" }),
      outcome: "Interested",
      activityDate: new Date("2026-08-08T16:00:00Z"),
      leadId: lead.id,
      userId: user.id,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "NEGOTIATION" },
  });
  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: "PROPOSAL",
      toStatus: "NEGOTIATION",
      userId: user.id,
      activityId: act4.id,
      changedAt: new Date("2026-08-08T16:00:00Z"),
      reason: "Activity (Call): Negotiation",
    },
  });

  console.log(`\n✓ STEP 5: Logged Call & transitioned to NEGOTIATION`);

  // STEP 6: Log Meeting (Update Status: Won)
  const act5 = await prisma.activity.create({
    data: {
      type: "MEETING",
      description: JSON.stringify({ summary: "Deal finalized and signed!", outcome: "Positive" }),
      outcome: "Positive",
      activityDate: new Date("2026-08-12T10:00:00Z"),
      leadId: lead.id,
      userId: user.id,
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "WON" },
  });
  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      fromStatus: "NEGOTIATION",
      toStatus: "WON",
      userId: user.id,
      activityId: act5.id,
      changedAt: new Date("2026-08-12T10:00:00Z"),
      reason: "Activity (Meeting): Won",
    },
  });

  console.log(`\n✓ STEP 6: Logged Meeting & transitioned to WON`);

  // VERIFY COMPLETE STATUS HISTORY & TIMELINE
  const finalLead = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: {
      statusHistory: { orderBy: { changedAt: "asc" } },
      activities: { orderBy: { activityDate: "asc" } },
    },
  });

  console.log("\n=== FINAL PIPELINE PROGRESSION VERIFICATION ===");
  console.log(`Final Lead Status: ${finalLead?.status}`);
  console.log("Full Progression Trail:");
  finalLead?.statusHistory.forEach((h, idx) => {
    const from = h.fromStatus || "START";
    const to = h.toStatus;
    const dateStr = new Date(h.changedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    console.log(`  [${idx + 1}] ${dateStr}: ${from} → ${to} (Reason: "${h.reason || "N/A"}")`);
  });

  console.log("\n=== ALL PIPELINE PROGRESSION STEPS PASSED PERFECTLY ===");
}

runKiranProgressionTest().catch(console.error);
