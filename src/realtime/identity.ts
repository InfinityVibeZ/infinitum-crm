/**
 * Server-side identity resolution for realtime connections.
 *
 * Reuses the EXISTING authentication mechanism (the same JWT_SECRET and
 * the same `verifyToken` used by every Next.js API route) — no second
 * auth system, no refresh tokens exposed to the client.
 *
 * The companyId/tenant is resolved ONLY from the server-side verified
 * token payload plus the authoritative User row in the database. Client
 *-supplied companyId values are never accepted as an authorization source.
 */
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export interface RealtimeIdentity {
  userId: string;
  /** Authoritative tenant id, resolved server-side from the User row. */
  companyId: string;
  role: string;
}

/**
 * Verify a realtime access token and resolve the authenticated identity.
 * Returns null for any invalid, expired, or deactivated user/company.
 *
 * Deliberately strict: a user without a resolvable company tenant cannot
 * join company groups at all (they'd only ever be usable for the
 * user-scoped group, which this phase does not need).
 */
export async function resolveRealtimeIdentity(
  token: string
): Promise<RealtimeIdentity | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  let payload: { userId?: string; role?: string };
  try {
    payload = jwt.verify(token, secret) as typeof payload;
  } catch {
    // Invalid signature, expired, or malformed — reject.
    return null;
  }

  if (!payload?.userId) return null;

  // Load the authoritative user row (tenant + active status from DB).
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      role: true,
      companyId: true,
      company: true,
      department: true,
      isActive: true,
      status: true,
      companyRef: { select: { id: true, isActive: true, status: true } },
    },
  });

  if (!user || !user.isActive || user.status === "INACTIVE") return null;

  // Super Admins are platform-level; they are not scoped to one tenant, so
  // they are not admitted to company event groups in this phase.
  const companyId = user.companyId || user.companyRef?.id;
  if (user.role === "SUPER_ADMIN") return null;
  if (!companyId) return null;

  if (
    user.companyRef &&
    (!user.companyRef.isActive || user.companyRef.status === "INACTIVE")
  ) {
    return null;
  }

  return { userId: user.id, companyId, role: user.role };
}
