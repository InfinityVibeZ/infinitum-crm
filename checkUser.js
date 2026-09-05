const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'rajum@gmail.com';
  const password = 'Raju@superadmin@7';

  console.log(`Checking user: ${email}`);
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.log('User not found in DB!');
    return;
  }
  
  console.log('User found:', user.id, user.email, user.role, user.status);
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  console.log('Password valid?', isValid);
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
