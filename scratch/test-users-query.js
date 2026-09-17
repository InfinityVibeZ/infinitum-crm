const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminCompId = "920bf1bd-4b8d-46e5-ac3b-4c3faefc5f92"
  const adminCompName = "Deloitte"
  const payloadUserId = "65d4b510-7e5b-410f-9a57-118f22e2ee51"

  const adminOrConditions = [{ createdBy: payloadUserId }];
  if (adminCompId) {
    adminOrConditions.push({ companyId: adminCompId });
  }
  if (adminCompName) {
    adminOrConditions.push({
      company: { equals: adminCompName, mode: "insensitive" },
    });
    adminOrConditions.push({
      department: { equals: adminCompName, mode: "insensitive" },
    });
  }

  const users = await prisma.user.findMany({
    where: {
      isDeleted: false,
      role: { in: ["SUPER_ADMIN", "ADMIN", "USER"] },
      OR: adminOrConditions,
    },
    select: {
      name: true,
      role: true,
      company: true,
    }
  });

  console.log("USERS RESULT:")
  console.log(JSON.stringify(users, null, 2))
}

main().finally(() => prisma.$disconnect());
