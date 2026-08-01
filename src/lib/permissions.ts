/**
 * Single source of truth for the default per-role page permission matrix.
 * Used by: login (to embed permissions in the JWT), GET /api/settings/permissions
 * (to merge with Super Admin customizations), and middleware (as a safe fallback
 * when a token has no embedded permissions). No Node/Prisma imports — this file
 * must stay Edge-runtime safe since middleware.ts imports it.
 */

export type AppRole = "SUPER_ADMIN" | "ADMIN" | "USER";

export const DEFAULT_PAGE_PERMISSIONS: Record<string, Record<AppRole, boolean>> = {
  "/leads/crm": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/leads/metrics": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/leads/activities": { SUPER_ADMIN: true, ADMIN: true, USER: true },

  "/sales/pipeline": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/sales/crm": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/sales/metrics": { SUPER_ADMIN: true, ADMIN: true, USER: false },

  "/offer/creation": { SUPER_ADMIN: true, ADMIN: true, USER: false },
  "/offer/revenue-generator": { SUPER_ADMIN: true, ADMIN: true, USER: false },
  "/offer/ideas-backlog": { SUPER_ADMIN: true, ADMIN: true, USER: false },

  "/documents/proposals": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/documents/contracts": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/documents/invoices": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/documents/templates": { SUPER_ADMIN: true, ADMIN: true, USER: false },

  "/finances/dashboard": { SUPER_ADMIN: true, ADMIN: true, USER: false },
  "/finances/cash-in": { SUPER_ADMIN: true, ADMIN: true, USER: false },
  "/finances/cash-out": { SUPER_ADMIN: true, ADMIN: true, USER: false },
  "/finances/receivables": { SUPER_ADMIN: true, ADMIN: true, USER: false },

  "/operations/onboarding": { SUPER_ADMIN: true, ADMIN: true, USER: false },
  "/operations/fulfillment": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/operations/custom-reports": { SUPER_ADMIN: true, ADMIN: true, USER: false },

  "/ai-tools/content-companion": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/ai-tools/email-assistant": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/ai-tools/lead-scoring": { SUPER_ADMIN: true, ADMIN: true, USER: false },

  "/admin/admin-management": { SUPER_ADMIN: true, ADMIN: false, USER: false },
  "/admin/user-management": { SUPER_ADMIN: true, ADMIN: true, USER: false },
  "/admin/archive": { SUPER_ADMIN: true, ADMIN: false, USER: false },
  "/admin/audit-logs": { SUPER_ADMIN: true, ADMIN: true, USER: false },

  "/settings/security": { SUPER_ADMIN: true, ADMIN: true, USER: true },
  "/admin/permissions": { SUPER_ADMIN: true, ADMIN: false, USER: false },
  "/settings/api-keys": { SUPER_ADMIN: true, ADMIN: false, USER: false },
};

/** Flattens the path->role->bool matrix down to a single role's path->bool map. */
export function getDefaultPermissionsForRole(role: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const [path, roles] of Object.entries(DEFAULT_PAGE_PERMISSIONS)) {
    result[path] = (roles as Record<string, boolean>)[role] ?? false;
  }
  return result;
}

/**
 * Merges Super-Admin-customized permissions (from SystemConfig "ROLE_PERMISSIONS", already
 * JSON-parsed) over the hardcoded defaults, then flattens to the given role's path->bool map.
 * This is the authoritative "effective permissions" computation — used at login time to embed
 * into the signed JWT, and by GET /api/settings/permissions for the admin UI.
 */
export function mergePermissionsForRole(
  role: string,
  dbPermissions?: Record<string, Record<string, boolean>> | null
): Record<string, boolean> {
  const merged: Record<string, Record<string, boolean>> = { ...DEFAULT_PAGE_PERMISSIONS, ...(dbPermissions || {}) };
  const result: Record<string, boolean> = {};
  for (const [path, roles] of Object.entries(merged)) {
    result[path] = roles?.[role] ?? false;
  }
  result["/settings/security"] = true;
  return result;
}
