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
      where.OR = [
        { actorName:  { contains: search, mode: "insensitive" } },
        { actorEmail: { contains: search, mode: "insensitive" } },
        { summary:    { contains: search, mode: "insensitive" } },
        { action:     { contains: search, mode: "insensitive" } },
        { targetName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (action)   where.action   = action;

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
      const allowedEmails = companyUsers.map((u) => u.email);
      const scopeFilter = { actorEmail: { in: allowedEmails } };

      if (where.OR) {
        // Combine with the free-text search OR via AND so scoping is never bypassed by search
        where.AND = [{ OR: where.OR }, scopeFilter];
        delete where.OR;
      } else {
        Object.assign(where, scopeFilter);
      }
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
      take: 500,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
