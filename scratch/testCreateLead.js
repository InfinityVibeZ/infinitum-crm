const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const newLead = await prisma.lead.create({
      data: {
        name: "test data",
        email: null,
        phone: "889890909987",
        company: "",
        status: "NEW",
        priority: "MEDIUM",
        source: null,
        value: null,
        notes: null,
        userId: "65d4b510-7e5b-410f-9a57-118f22e2ee51",
        companyId: "920bf1bd-4b8d-46e5-ac3b-4c3faefc5f92",
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: "NEW",
            userId: "65d4b510-7e5b-410f-9a57-118f22e2ee51",
            notes: "Lead Created",
            companyId: "920bf1bd-4b8d-46e5-ac3b-4c3faefc5f92",
          },
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, company: true, department: true, companyId: true },
        },
        follow_ups: true, // wait, is it follow_ups or followUps in the include?
        statusHistory: true,
      },
    });
    console.log("Success:", newLead.id);
  } catch (error) {
    console.error("Prisma error:", error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
