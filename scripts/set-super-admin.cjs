const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ 
    select: { id: true, name: true, email: true, role: true } 
  });
  console.log('Current users:', JSON.stringify(users, null, 2));

  if (users.length > 0) {
    const updated = await prisma.user.update({ 
      where: { id: users[0].id }, 
      data: { role: 'SUPER_ADMIN' }, 
      select: { id: true, name: true, email: true, role: true } 
    });
    console.log('\nUpgraded to SUPER_ADMIN:', JSON.stringify(updated));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
