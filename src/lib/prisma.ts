import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse the same PrismaClient (and its DB connection pool) across warm
// serverless invocations. Without this, every request in production would
// open a brand new connection to Supabase — the connection handshake alone
// can take longer than the actual query, which is why "only 2-3 records"
// still felt slow.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

globalForPrisma.prisma = prisma;
