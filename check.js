const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, status: true, isActive: true }
  });
  console.log('Total users:', users.length);
  const pendingUsers = users.filter(u => u.status === 'PENDING');
  console.log('Pending users:', pendingUsers.length);
  console.dir(pendingUsers);
}
check().finally(() => prisma.$disconnect());
