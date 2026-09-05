const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.update({
  where: { id: '173eda97-8d4a-44fb-9398-bb4c88205c49' },
  data: { isDeleted: false, deletedAt: null }
}).then(() => {
  console.log('Restored Lokesh');
  return prisma.$disconnect();
});
