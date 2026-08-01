const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({});
  console.log('Total users:', users.length);
  console.log('All Users:', JSON.stringify(users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    isActive: u.isActive,
    plainPassword: u.plainPassword
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
