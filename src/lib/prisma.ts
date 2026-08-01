import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma && (globalForPrisma.prisma as any).invitationToken
    ? globalForPrisma.prisma
    : new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query"] : [],
      });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
