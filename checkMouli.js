const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'mouli@gmail.com' } });
  if (user) {
    console.log("User exists:", user.id, user.email, user.role);
  } else {
    console.log("User does not exist.");
  }
}
main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
