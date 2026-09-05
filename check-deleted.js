const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({ where: { id: '173eda97-8d4a-44fb-9398-bb4c88205c49' } }).then(u => {
  console.log(u);
  return prisma.$disconnect();
});
