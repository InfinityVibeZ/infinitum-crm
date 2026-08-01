import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole } from "@/lib/auth";
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

    // Fetch companies from database
    const companies = await (prisma as any).company.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
    });

    // Fetch all active users to compute accurate company counts
    const allUsers = await prisma.user.findMany({
      where: { isDeleted: false },
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

/** POST /api/companies — Create a new company (Superadmin only) */
export async function POST(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const payload = getTokenPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const body = await request.json();
    const { name, category, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check duplicate
    const existing = await (prisma as any).company.findFirst({
      where: { name: { equals: trimmedName, mode: "insensitive" }, isDeleted: false },
    });
    if (existing) {
      return NextResponse.json({ error: `Company "${trimmedName}" already exists` }, { status: 400 });
    }

    const company = await (prisma as any).company.create({
      data: {
        name: trimmedName,
        category: category || "Technology & Software",
        status: status || "ACTIVE",
        isActive: status ? status === "ACTIVE" : true,
        isDeleted: false,
      },
    });

    await logAuditEvent({
      action: "COMPANY_CREATED",
      category: "Company Management",
      severity: "SUCCESS",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: company.name,
      summary: `Created company ${company.name} (${company.id})`,
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error("POST /api/companies error:", error);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}
