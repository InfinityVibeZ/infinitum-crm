const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminCompId = "920bf1bd-4b8d-46e5-ac3b-4c3faefc5f92"
  const adminCompName = "Deloitte"

  const whereClause = {
    isDeleted: false,
    isActive: true,
    status: "ACTIVE"
  }

  const orConditions = [];
  if (adminCompId) orConditions.push({ id: adminCompId });
  if (adminCompName) orConditions.push({ name: { equals: adminCompName, mode: "insensitive" } });
  
  if (orConditions.length > 0) {
    whereClause.OR = orConditions;
  }

  const companies = await prisma.company.findMany({
    where: whereClause,
  });

  console.log("COMPANIES RESULT:")
  console.log(JSON.stringify(companies, null, 2))
}

main().finally(() => prisma.$disconnect());
