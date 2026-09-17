import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole, requireAuthenticatedUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/** GET /api/companies — Fetch active/all companies or archived companies */
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

    // Company directory (names, admin/user emails per company) is Admin/Super Admin only —
    // a regular USER has no legitimate need to browse other companies' rosters.
    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";
    const archived = searchParams.get("archived") === "true";

    // Build filter
    const whereClause: any = {
      isDeleted: archived ? true : false,
    };
    if (activeOnly) {
      whereClause.isActive = true;
      whereClause.status = "ACTIVE";
    }

    let adminCompId: string | undefined;
    let adminCompName: string | undefined;

    if (payload.role !== "SUPER_ADMIN") {
      const adminUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { companyId: true, company: true, department: true }
      });
      adminCompId = (payload as any).companyId || adminUser?.companyId;
      adminCompName = (payload as any).company || adminUser?.company || adminUser?.department;
      
      const orConditions: any[] = [];
      if (adminCompId) orConditions.push({ id: adminCompId });
      if (adminCompName) orConditions.push({ name: { equals: adminCompName, mode: "insensitive" } });
      
      if (orConditions.length > 0) {
        whereClause.OR = orConditions;
      } else {
        // Fallback: match nothing if they have no company
        whereClause.id = "invalid-no-company"; 
      }
    }

    // Fetch companies from database
    const companies = await (prisma as any).company.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
    });

    const usersWhereClause: any = { isDeleted: false };
    if (payload.role !== "SUPER_ADMIN") {
      const userOrConditions: any[] = [];
      if (adminCompId) userOrConditions.push({ companyId: adminCompId });
      if (adminCompName) {
        userOrConditions.push({ company: { equals: adminCompName, mode: "insensitive" } });
        userOrConditions.push({ department: { equals: adminCompName, mode: "insensitive" } });
      }
      if (userOrConditions.length > 0) {
        usersWhereClause.OR = userOrConditions;
      } else {
        usersWhereClause.id = "invalid-no-company";
      }
    }

    // Fetch all active users to compute accurate company counts
    const allUsers = await prisma.user.findMany({
      where: usersWhereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isActive: true,
        company: true,
        companyId: true,
        department: true,
      },
    });

    // Map companies with user/admin metrics
    const enrichedCompanies = companies.map((c: any) => {
      const companyUsers = allUsers.filter(
        (u) =>
          u.companyId === c.id ||
          (u.company && u.company.toLowerCase() === c.name.toLowerCase()) ||
          (u.department && u.department.toLowerCase() === c.name.toLowerCase())
      );
      const admins = companyUsers.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN");
      const users = companyUsers.filter((u) => u.role === "USER");

      return {
        ...c,
        adminCount: admins.length,
        userCount: users.length,
        totalMembers: companyUsers.length,
        admins: admins.map((a) => ({ id: a.id, name: a.name, email: a.email, status: a.status, isActive: a.isActive })),
        users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, status: u.status, isActive: u.isActive })),
      };
    });

    return NextResponse.json(enrichedCompanies);
  } catch (error) {
    console.error("GET /api/companies error:", error);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}


