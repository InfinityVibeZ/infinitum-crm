const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking UserStatus enum values...");
  try {
    const enumValues = await prisma.$queryRawUnsafe(`
      SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'UserStatus';
    `);
    console.log("Existing values:", enumValues);
    
    const labels = enumValues.map(e => e.enumlabel);
    
    if (!labels.includes('PENDING')) {
      console.log("Adding PENDING to UserStatus...");
      await prisma.$executeRawUnsafe(`ALTER TYPE "UserStatus" ADD VALUE 'PENDING';`);
    }
    
    if (!labels.includes('EXPIRED')) {
      console.log("Adding EXPIRED to UserStatus...");
      await prisma.$executeRawUnsafe(`ALTER TYPE "UserStatus" ADD VALUE 'EXPIRED';`);
    }
    
    console.log("Done.");
  } catch (err) {
    console.error("Error:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
