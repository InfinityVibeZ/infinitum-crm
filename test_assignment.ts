import { prisma } from "./src/lib/prisma";
import { assignLead } from "./src/lib/integrations/assignment-service";
import { AssignmentStrategy, AssignmentTrigger } from "@prisma/client";

async function runTests() {
  console.log("Starting Assignment Engine Tests...");

  const company = await prisma.company.create({
    data: { name: `AssignTest_Company_${Date.now()}` }
  });

  const admin = await prisma.user.create({
    data: {
      email: `admin_${Date.now()}@example.com`,
      name: "Test Admin",
      passwordHash: "x",
      role: "ADMIN",
      companyId: company.id,
      isActive: true,
      isDeleted: false
    }
  });

  const rep1 = await prisma.user.create({
    data: {
      email: `rep1_${Date.now()}@example.com`,
      name: "Rep 1",
      passwordHash: "x",
      role: "USER",
      companyId: company.id,
      isActive: true,
      isDeleted: false
    }
  });

  const rep2 = await prisma.user.create({
    data: {
      email: `rep2_${Date.now()}@example.com`,
      name: "Rep 2",
      passwordHash: "x",
      role: "USER",
      companyId: company.id,
      isActive: true,
      isDeleted: false
    }
  });

  const rep3 = await prisma.user.create({
    data: {
      email: `rep3_${Date.now()}@example.com`,
      name: "Rep 3",
      passwordHash: "x",
      role: "USER",
      companyId: company.id,
      isActive: true,
      isDeleted: false
    }
  });

  const team = await prisma.team.create({
    data: {
      companyId: company.id,
      name: "Sales Team",
      isActive: true
    }
  });

  await prisma.userTeam.createMany({
    data: [
      { userId: rep1.id, teamId: team.id, companyId: company.id },
      { userId: rep2.id, teamId: team.id, companyId: company.id },
      { userId: rep3.id, teamId: team.id, companyId: company.id }
    ]
  });

  try {
    // Test 1: Fallback (no rules)
    const lead1 = await prisma.lead.create({
      data: {
        companyId: company.id,
        name: "Lead 1",
        userId: admin.id // dummy
      }
    });

    const res1 = await assignLead(prisma, {
      companyId: company.id,
      leadId: lead1.id,
      trigger: "LEAD_CREATED"
    });

    if (res1.assignedUserId !== admin.id || res1.strategy !== "FALLBACK") throw new Error("Fallback failed");
    console.log("✅ Fallback assignment passed");

    // Test 2: Specific User Rule
    const rule1 = await prisma.leadAssignmentRule.create({
      data: {
        companyId: company.id,
        name: "Give to Rep 1",
        priority: 10,
        strategy: "SPECIFIC_USER",
        targetUserId: rep1.id
      }
    });

    const lead2 = await prisma.lead.create({
      data: {
        companyId: company.id,
        name: "Lead 2",
        userId: admin.id
      }
    });

    const res2 = await assignLead(prisma, {
      companyId: company.id,
      leadId: lead2.id,
      trigger: "LEAD_CREATED"
    });

    if (res2.assignedUserId !== rep1.id || res2.strategy !== "SPECIFIC_USER") throw new Error("Specific user assignment failed");
    console.log("✅ Specific User assignment passed");

    // Test 3: TEAM Rule
    await prisma.leadAssignmentRule.update({ where: { id: rule1.id }, data: { enabled: false } });

    const ruleTeam = await prisma.leadAssignmentRule.create({
      data: {
        companyId: company.id,
        name: "Assign to Team",
        priority: 15,
        strategy: "TEAM",
        targetTeamId: team.id
      }
    });

    const lead3 = await prisma.lead.create({
      data: {
        companyId: company.id,
        name: "Lead 3",
        userId: admin.id
      }
    });

    const res3 = await assignLead(prisma, {
      companyId: company.id,
      leadId: lead3.id,
      trigger: "LEAD_CREATED"
    });

    if (res3.assignedTeamId !== team.id || res3.strategy !== "TEAM") throw new Error("TEAM assignment failed");
    console.log("✅ TEAM assignment passed");

    // Test 4: Round Robin Rule
    await prisma.leadAssignmentRule.update({ where: { id: ruleTeam.id }, data: { enabled: false } });

    const rule2 = await prisma.leadAssignmentRule.create({
      data: {
        companyId: company.id,
        name: "RR Sales Team",
        priority: 20,
        strategy: "ROUND_ROBIN",
        targetTeamId: team.id
      }
    });

    const leads = await Promise.all([
      prisma.lead.create({ data: { companyId: company.id, name: "RR 1", userId: admin.id } }),
      prisma.lead.create({ data: { companyId: company.id, name: "RR 2", userId: admin.id } }),
      prisma.lead.create({ data: { companyId: company.id, name: "RR 3", userId: admin.id } }),
      prisma.lead.create({ data: { companyId: company.id, name: "RR 4", userId: admin.id } })
    ]);

    // We do them serially here, but atomic cursor prevents race in concurrency
    const resRR1 = await assignLead(prisma, { companyId: company.id, leadId: leads[0].id, trigger: "LEAD_CREATED" });
    const resRR2 = await assignLead(prisma, { companyId: company.id, leadId: leads[1].id, trigger: "LEAD_CREATED" });
    const resRR3 = await assignLead(prisma, { companyId: company.id, leadId: leads[2].id, trigger: "LEAD_CREATED" });
    const resRR4 = await assignLead(prisma, { companyId: company.id, leadId: leads[3].id, trigger: "LEAD_CREATED" });

    const assignedIds = [resRR1.assignedUserId, resRR2.assignedUserId, resRR3.assignedUserId];
    const uniqueAssigned = new Set(assignedIds);
    if (uniqueAssigned.size !== 3) throw new Error("Round robin did not distribute evenly");
    if (resRR4.assignedUserId !== resRR1.assignedUserId) throw new Error("Round robin did not wrap correctly");
    console.log("✅ Round Robin assignment passed");

    // Test 4: Idempotency
    const resRR1_dup = await assignLead(prisma, { companyId: company.id, leadId: leads[0].id, trigger: "LEAD_CREATED" });
    if (resRR1_dup.assignedUserId !== resRR1.assignedUserId || resRR1_dup.reason !== "Idempotent return of existing assignment") {
      throw new Error("Idempotency failed");
    }
    console.log("✅ Idempotency passed");

  } finally {
    await prisma.leadAssignment.deleteMany({ where: { companyId: company.id } });
    await prisma.leadAssignmentRule.deleteMany({ where: { companyId: company.id } });
    await prisma.lead.deleteMany({ where: { companyId: company.id } });
    await prisma.userTeam.deleteMany({ where: { companyId: company.id } });
    await prisma.team.deleteMany({ where: { companyId: company.id } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
    await prisma.$disconnect();
  }

  console.log("All Assignment tests passed successfully.");
}

runTests().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
