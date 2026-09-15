const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, company: true, department: true, companyId: true } },
        deals: { select: { id: true, name: true, stage: true, value: true } },
        follow_ups: { orderBy: { scheduled_at: "asc" } },
        payments: { orderBy: { paymentDate: "desc" } },
        activities: { orderBy: { createdAt: "desc" } },
        statusHistory: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    console.log("Success GET leads, count:", leads.length);
  } catch (error) {
    console.error("Prisma error:", error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
