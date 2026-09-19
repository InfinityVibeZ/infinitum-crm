/**
 * Tenant-scoped SignalR group model.
 *
 * Group names are ALWAYS derived server-side from the authenticated
 * identity — a client can never pass an arbitrary group name. This module
 * is the single source of truth for group naming so publishers and the
 * hub can never drift apart.
 */
import type { RealtimeIdentity } from "./identity";

export function companyGroup(companyId: string): string {
  return `company:${companyId}`;
}

/** Optional per-user group for multi-tab/user synchronization. */
export function userGroup(userId: string): string {
  return `user:${userId}`;
}

export function groupsForIdentity(identity: RealtimeIdentity): string[] {
  const groups = [companyGroup(identity.companyId)];
  if (identity.userId) groups.push(userGroup(identity.userId));
  return groups;
}
