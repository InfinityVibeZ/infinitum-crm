import { prisma } from "@/lib/prisma";

/** Max distinct users allowed to be active at the same time. */
export const MAX_CONCURRENT_USERS = 100;

/** A user with no heartbeat in this window no longer counts as "active". */
const ACTIVE_WINDOW_MINUTES = 15;

/** Skip re-writing the heartbeat row if it was touched more recently than this. */
const HEARTBEAT_THROTTLE_MINUTES = 2;

function activeSinceThreshold() {
  return new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000);
}

/** Number of distinct users active within the last ACTIVE_WINDOW_MINUTES. */
export async function getActiveUserCount(): Promise<number> {
  return prisma.activeSession.count({
    where: { lastSeenAt: { gte: activeSinceThreshold() } },
  });
}

/** True if this user already has a fresh (non-expired) session — re-logins/heartbeats
 * from a user who's already occupying a slot should never be blocked by the cap. */
export async function isUserCurrentlyActive(userId: string): Promise<boolean> {
  const session = await prisma.activeSession.findUnique({ where: { userId } });
  return !!session && session.lastSeenAt >= activeSinceThreshold();
}

/** Record that a user is active right now. Throttled so the frequent /api/auth/me
 * heartbeat doesn't hit the DB on every single poll. */
export async function touchSession(userId: string): Promise<void> {
  const existing = await prisma.activeSession.findUnique({ where: { userId } });
  const throttleThreshold = new Date(Date.now() - HEARTBEAT_THROTTLE_MINUTES * 60 * 1000);
  if (existing && existing.lastSeenAt >= throttleThreshold) return;

  await prisma.activeSession.upsert({
    where: { userId },
    create: { userId },
    update: { lastSeenAt: new Date() },
  });
}

/** Removes a user's active session immediately (called on logout). */
export async function clearSession(userId: string): Promise<void> {
  await prisma.activeSession.deleteMany({ where: { userId } });
}
