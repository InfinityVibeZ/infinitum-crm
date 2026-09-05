import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const payload = getTokenPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const search    = searchParams.get("search") || "";
    const category  = searchParams.get("category") || "";
    const severity  = searchParams.get("severity") || "";
    const action    = searchParams.get("action") || "";
    const from      = searchParams.get("from") || "";
    const to        = searchParams.get("to") || "";

    // Build dynamic Prisma where clause
    const where: any = {};

    if (search) {
      where.action = { contains: search, mode: "insensitive" };
    }

    let allowedEmails: string[] | null = null;

    // AuditLog has no companyId column, so an ADMIN's visibility is scoped by intersecting
    // their existing search filter with the set of actor emails belonging to their own
    // company (themselves + users/admins they created or that share their company) — a
    // SUPER_ADMIN sees everything, matching how every other admin-facing list in this app
    // is company-scoped for ADMIN and unrestricted for SUPER_ADMIN.
    if (payload.role === "ADMIN") {
      const adminUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { companyId: true, company: true, department: true },
      });
      const adminCompId = adminUser?.companyId;
      const adminCompName = adminUser?.company || adminUser?.department;

      const orConditions: any[] = [{ createdBy: payload.userId }, { id: payload.userId }];
      if (adminCompId) orConditions.push({ companyId: adminCompId });
      if (adminCompName) {
        orConditions.push({ company: { equals: adminCompName, mode: "insensitive" } });
        orConditions.push({ department: { equals: adminCompName, mode: "insensitive" } });
      }

      const companyUsers = await prisma.user.findMany({
        where: { OR: orConditions },
        select: { email: true },
      });
      allowedEmails = companyUsers.map((u) => u.email);
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        // include the full "to" day
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    // In-memory filtering for metadata fields that were moved out of schema
    let filteredLogs = logs.filter((log) => {
      const meta: any = log.metadata || {};
      
      if (category && meta.category !== category) return false;
      if (severity && meta.severity !== severity) return false;
      
      if (search && !log.action.toLowerCase().includes(search.toLowerCase())) {
        const searchLower = search.toLowerCase();
        const matchesMeta = 
          (meta.actorName && meta.actorName.toLowerCase().includes(searchLower)) ||
          (meta.actorEmail && meta.actorEmail.toLowerCase().includes(searchLower)) ||
          (meta.summary && meta.summary.toLowerCase().includes(searchLower)) ||
          (meta.targetName && meta.targetName.toLowerCase().includes(searchLower));
        
        if (!matchesMeta) return false;
      }

      if (allowedEmails && meta.actorEmail) {
        if (!allowedEmails.includes(meta.actorEmail)) return false;
      } else if (allowedEmails && !meta.actorEmail) {
        return false;
      }

      return true;
    });

    // Remap metadata fields to top level so UI doesn't break
    const finalLogs = filteredLogs.slice(0, 500).map(log => ({
      ...log,
      ...((log.metadata as any) || {})
    }));

    return NextResponse.json(finalLogs);
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
