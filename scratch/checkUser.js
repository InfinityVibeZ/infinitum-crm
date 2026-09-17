const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ where: { role: 'ADMIN' }, include: { companyRef: true } });
  console.log(JSON.stringify(users.map(u => ({ id: u.id, role: u.role, companyId: u.companyId, ownerUserId: u.companyRef?.ownerUserId })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
