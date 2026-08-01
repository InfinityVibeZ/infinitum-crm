const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Set a known password for the SUPER_ADMIN user
  const newPassword = 'SuperAdmin@123';
  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updated = await prisma.user.update({
    where: { email: 'builtby.rajum@gmail.com' },
    data: { passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE', isActive: true },
    select: { id: true, name: true, email: true, role: true, status: true }
  });

  console.log('✅ SUPER_ADMIN ready:');
  console.log('  Email   :', updated.email);
  console.log('  Name    :', updated.name);
  console.log('  Role    :', updated.role);
  console.log('  Password: SuperAdmin@123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
