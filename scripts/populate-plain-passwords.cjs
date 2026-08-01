const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const USER_PASSWORDS = [
  { email: "raju@gmail.com", plain: "Raju@123" },
  { email: "builtby.rajum@gmail.com", plain: "SuperAdmin@123" },
  { email: "mouli@gmail.com", plain: "Mouli@123" },
  { email: "mouli123@gmail.com", plain: "Mouli@123" },
  { email: "user@nexus.com", plain: "User@123" },
  { email: "admin@example.com", plain: "Admin@123" },
  { email: "user@company.com", plain: "User@123" },
];

async function main() {
  for (const item of USER_PASSWORDS) {
    const user = await prisma.user.findUnique({ where: { email: item.email } });
    if (user) {
      const hash = await bcrypt.hash(item.plain, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hash,
          plainPassword: item.plain,
        },
      });
      console.log(`Updated plainPassword for: ${user.email} -> ${item.plain}`);
    }
  }

  // Also update any remaining users without plainPassword
  const remaining = await prisma.user.findMany({ where: { plainPassword: null } });
  for (const u of remaining) {
    const defaultPw = "Nexus@2026";
    const hash = await bcrypt.hash(defaultPw, 12);
    await prisma.user.update({
      where: { id: u.id },
      data: {
        passwordHash: hash,
        plainPassword: defaultPw,
      },
    });
    console.log(`Updated default plainPassword for: ${u.email} -> ${defaultPw}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
