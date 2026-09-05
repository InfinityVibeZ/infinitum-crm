import { prisma } from "@/lib/prisma";

export interface LogAuditOptions {
  action: string;
  category?: string;
  severity?: "INFO" | "SUCCESS" | "WARNING" | "DANGER";
  actorName: string;
  actorEmail: string;
  actorRole?: string;
  targetName?: string;
  summary: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Extracts the real client IP address from request headers.
 * Checks x-forwarded-for, x-real-ip, then falls back to 127.0.0.1.
 */
export function getIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function logAuditEvent(options: LogAuditOptions) {
  try {
    return await prisma.auditLog.create({
      data: {
        action: options.action,
        metadata: {
          category: options.category || "User Management",
          severity: options.severity || "INFO",
          actorName: options.actorName,
          actorEmail: options.actorEmail,
          actorRole: options.actorRole || "SUPER_ADMIN",
          targetName: options.targetName || null,
          summary: options.summary,
          details: options.details ? options.details : undefined,
        },
        ipAddress: options.ipAddress || "127.0.0.1",
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    return null;
  }
}
