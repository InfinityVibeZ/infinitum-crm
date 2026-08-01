import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { registerUser, extractTokenFromRequest, getTokenPayload, requireRole } from "@/lib/auth";
import { createAccountSetupToken } from "@/lib/tokens";
import { sendAdminInvitationEmail, sendUserInvitationEmail } from "@/lib/mail";
import { logAuditEvent } from "@/lib/audit";
import type { Role } from "@prisma/client";


async function syncCompanyStatus(companyId?: string | null, companyName?: string | null) {
  if (!companyId && !companyName) return;

  try {
    const companyModel = (prisma as any).company || (prisma as any).Company;
    if (!companyModel) return;

    const activeAdminsCount = await prisma.user.count({
      where: {
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
        isActive: true,
        isDeleted: false,
        OR: [
          ...(companyId ? [{ companyId }] : []),
          ...(companyName ? [{ company: companyName }] : []),
        ],
      },
    });

    const shouldBeActive = activeAdminsCount > 0;

    if (companyId) {
      await companyModel.updateMany({
        where: { id: companyId },
        data: { isActive: shouldBeActive, status: shouldBeActive ? "ACTIVE" : "INACTIVE" },
      });
    } else if (companyName) {
      await companyModel.updateMany({
        where: { name: { equals: companyName.trim(), mode: "insensitive" } },
        data: { isActive: shouldBeActive, status: shouldBeActive ? "ACTIVE" : "INACTIVE" },
      });
    }
  } catch (err) {
    console.warn("[syncCompanyStatus] Skipped/warning:", err);
  }
}

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

    const { searchParams } = new URL(request.url);
    const grouped = searchParams.get("grouped") === "true";
    const archived = searchParams.get("archived") === "true" || searchParams.get("deleted") === "true";

    const isDeletedFilter = archived ? true : false;

    // USER role — team roster scoped to their own company (not platform-wide)
    if (payload.role === "USER") {
      const requestingUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { companyId: true, company: true, department: true },
      });
      const compId = requestingUser?.companyId;
      const compName = requestingUser?.company || requestingUser?.department;

      const orConditions: any[] = [{ id: payload.userId }];
      if (compId) orConditions.push({ companyId: compId });
      if (compName) {
        orConditions.push({ company: { equals: compName, mode: "insensitive" } });
        orConditions.push({ department: { equals: compName, mode: "insensitive" } });
      }

      const users = await prisma.user.findMany({
        where: {
          isDeleted: false,
          status: { in: ["ACTIVE", "PENDING"] },
          OR: orConditions
        },
        select: {
          id: true, name: true, email: true, role: true, status: true, isActive: true,
          avatarUrl: true, company: true, companyId: true, department: true,
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(users);
    }

    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    // ── SUPER_ADMIN grouped view (OPTIMIZED: parallel queries) ───────────────────
    if (payload.role === "SUPER_ADMIN" && grouped) {
      // Fetch users and tokens in parallel
      const [allUsers, invitationTokens] = await Promise.all([
        prisma.user.findMany({
          where: { isDeleted: isDeletedFilter },
          select: {
            id: true, name: true, email: true, role: true,
            status: true, isActive: true, isDeleted: true, deletedAt: true, lastLogin: true,
            createdAt: true, phone: true, department: true, category: true,
            createdBy: true, company: true, companyId: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.invitationToken.findMany({
          select: { userId: true, status: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Build invitation token map once
      const latestTokenByUser = new Map<string, { status: string; expiresAt: Date }>();
      const now = new Date();
      for (const t of invitationTokens) {
        if (!latestTokenByUser.has(t.userId)) {
          latestTokenByUser.set(t.userId, t);
        }
      }

      const isInvitationExpiredMap = new Map<string, boolean>();
      allUsers.forEach((u) => {
        const latest = latestTokenByUser.get(u.id);
        const isExpired = u.status === "PENDING" && !!latest && (latest.status === "EXPIRED" || latest.expiresAt < now);
        isInvitationExpiredMap.set(u.id, isExpired);
      });

      const adminUsers = allUsers.filter((u) => u.role === "SUPER_ADMIN" || u.role === "ADMIN");
      const regularUsers = allUsers.filter((u) => u.role === "USER");

      const adminMap = new Map<string, any>();
      adminUsers.forEach((admin) => {
        adminMap.set(admin.id, {
          ...admin,
          isInvitationExpired: isInvitationExpiredMap.get(admin.id) ?? false,
          users: [],
          userCount: 0,
        });
      });

      const unassignedUsers: any[] = [];

      regularUsers.forEach((u) => {
        const userWithStatus = { ...u, isInvitationExpired: isInvitationExpiredMap.get(u.id) ?? false };
        if (u.createdBy && adminMap.has(u.createdBy)) {
          const adminGroup = adminMap.get(u.createdBy);
          adminGroup.users.push(userWithStatus);
          adminGroup.userCount++;
        } else {
          unassignedUsers.push(userWithStatus);
        }
      });

      const result = Array.from(adminMap.values());

      if (unassignedUsers.length > 0) {
        const superAdminGroup = result.find((g) => g.role === "SUPER_ADMIN");
        if (superAdminGroup) {
          const existingIds = new Set(superAdminGroup.users.map((u: any) => u.id));
          const uniqueUnassigned = unassignedUsers.filter((u) => !existingIds.has(u.id));
          superAdminGroup.users.push(...uniqueUnassigned);
          superAdminGroup.userCount = superAdminGroup.users.length;
        }
      }

      const annotatedAllUsers = allUsers.map((u) => ({
        ...u,
        isInvitationExpired: isInvitationExpiredMap.get(u.id) ?? false,
      }));

      const groupedRes = NextResponse.json({ admins: result, allUsers: annotatedAllUsers });
      groupedRes.headers.set("Cache-Control", "no-store");
      return groupedRes;
    }

    // ── SUPER_ADMIN flat view (OPTIMIZED: single query + batch) ────────────────────────
    if (payload.role === "SUPER_ADMIN") {
      // Fetch all data in parallel
      const [allUsers, invitationTokens] = await Promise.all([
        prisma.user.findMany({
          where: { isDeleted: isDeletedFilter },
          select: {
            id: true, name: true, email: true, role: true,
            status: true, department: true, category: true, company: true, companyId: true,
            phone: true, avatarUrl: true, modules: true,
            createdBy: true, lastLogin: true, createdAt: true,
            isActive: true, isDeleted: true, deletedAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.invitationToken.findMany({
          select: { userId: true, status: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Build creator map without separate query by using existing users data
      const creatorMap = new Map<string, string>();
      allUsers.forEach((u) => {
        if (u.createdBy) {
          const creator = allUsers.find((a) => a.id === u.createdBy);
          if (creator && !creatorMap.has(u.createdBy)) {
            creatorMap.set(u.createdBy, creator.name);
          }
        }
      });

      // Build invitation token map
      const latestTokenByUser = new Map<string, { status: string; expiresAt: Date }>();
      for (const t of invitationTokens) {
        if (!latestTokenByUser.has(t.userId)) {
          latestTokenByUser.set(t.userId, t);
        }
      }

      const now = new Date();
      const enriched = allUsers.map((u) => {
        const latest = latestTokenByUser.get(u.id);
        const isInvitationExpired = u.status === "PENDING" && !!latest && (latest.status === "EXPIRED" || latest.expiresAt < now);
        return {
          ...u,
          createdByName: u.createdBy ? (creatorMap.get(u.createdBy) ?? "—") : "—",
          isInvitationExpired,
        };
      });

      const enrichedRes = NextResponse.json(enriched);
      enrichedRes.headers.set("Cache-Control", "no-store");
      return enrichedRes;
    }

    // ── ADMIN — users & admins belonging to admin's company ──────────
    const adminUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { companyId: true, company: true, department: true },
    });

    const adminCompId = (payload as any).companyId || adminUser?.companyId;
    const adminCompName = (payload as any).company || adminUser?.company || adminUser?.department;

    const adminOrConditions: any[] = [{ createdBy: payload.userId }];
    if (adminCompId) {
      adminOrConditions.push({ companyId: adminCompId });
    }
    if (adminCompName) {
      adminOrConditions.push({ company: { equals: adminCompName, mode: "insensitive" } });
      adminOrConditions.push({ department: { equals: adminCompName, mode: "insensitive" } });
    }

    // OPTIMIZED: fetch users and tokens in parallel
    const [users, invitationTokens] = await Promise.all([
      prisma.user.findMany({
        where: {
          isDeleted: isDeletedFilter,
          status: { in: ["ACTIVE", "PENDING"] },
          role: { in: ["ADMIN", "USER"] },
          OR: adminOrConditions,
        },
        select: {
          id: true, name: true, email: true, role: true,
          status: true, department: true, category: true, company: true, companyId: true,
          phone: true, avatarUrl: true, modules: true,
          createdBy: true, lastLogin: true, createdAt: true,
          isActive: true, isDeleted: true, deletedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invitationToken.findMany({
        select: { userId: true, status: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Build invitation token map
    const latestTokenByUser = new Map<string, { status: string; expiresAt: Date }>();
    const now = new Date();
    for (const t of invitationTokens) {
      if (!latestTokenByUser.has(t.userId)) {
        latestTokenByUser.set(t.userId, t);
      }
    }

    // Sort logged-in Admin first, then other Admins, then Users
    const sortedUsers = users.sort((a, b) => {
      const aIsMe = a.id === payload.userId;
      const bIsMe = b.id === payload.userId;
      if (aIsMe) return -1;
      if (bIsMe) return 1;

      const aIsAdmin = a.role === "ADMIN" || a.role === "SUPER_ADMIN";
      const bIsAdmin = b.role === "ADMIN" || b.role === "SUPER_ADMIN";
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Add invitation status to each user
    const annotatedSortedUsers = sortedUsers.map((u) => {
      const latest = latestTokenByUser.get(u.id);
      const isInvitationExpired = u.status === "PENDING" && !!latest && (latest.status === "EXPIRED" || latest.expiresAt < now);
      return { ...u, isInvitationExpired };
    });

    const sortedRes = NextResponse.json(annotatedSortedUsers);
    sortedRes.headers.set("Cache-Control", "no-store");
    return sortedRes;
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

/** POST /api/users — Admin/SuperAdmin creates a new user */
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

    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    const body = await request.json();
    const { name, email, phone, department, category, company, companyId, role, status, modules, assignedAdminId } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    let assignedRole: Role = "USER";
    if (payload.role === "SUPER_ADMIN" && role && ["SUPER_ADMIN", "ADMIN", "USER"].includes(role)) {
      assignedRole = role as Role;
    } else if (payload.role === "ADMIN" && role === "USER") {
      assignedRole = "USER";
    }

    let resolvedCompanyId: string | null = companyId || null;
    let resolvedCompanyName: string | null = company || department || null;

    if (resolvedCompanyId) {
      const comp = await (prisma as any).company.findUnique({ where: { id: resolvedCompanyId } });
      if (comp) resolvedCompanyName = comp.name;
    } else if (resolvedCompanyName && resolvedCompanyName.trim() !== "") {
      const comp = await (prisma as any).company.findFirst({
        where: { name: { equals: resolvedCompanyName.trim(), mode: "insensitive" } },
      });
      if (comp) {
        resolvedCompanyId = comp.id;
        resolvedCompanyName = comp.name;
      } else {
        try {
          const newComp = await (prisma as any).company.create({
            data: {
              name: resolvedCompanyName.trim(),
              status: "ACTIVE",
              isActive: true,
            },
          });
          resolvedCompanyId = newComp.id;
          resolvedCompanyName = newComp.name;
        } catch (_) {}
      }
    }

    const creatorId = (payload.role === "SUPER_ADMIN" && assignedAdminId)
      ? assignedAdminId
      : payload.userId;

    const initialTempPassword = generatePassword();
    const { user } = await registerUser(email, initialTempPassword, name, assignedRole, creatorId);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: phone ? phone.replace(/[^0-9+\-\s()]/g, "").slice(0, 15) : null,
        department: department || resolvedCompanyName || null,
        company: resolvedCompanyName || null,
        companyId: resolvedCompanyId || null,
        category: category || null,
        status: "PENDING",
        modules: modules || null,
        plainPassword: null,
        isDeleted: false,
      },
      select: {
        id: true, name: true, email: true, role: true,
        status: true, department: true, category: true, company: true, companyId: true,
        phone: true, createdAt: true,
      },
    });

    await syncCompanyStatus(resolvedCompanyId, resolvedCompanyName);

    // Issue secure 24-hour ACCOUNT_SETUP token
    const { rawToken } = await createAccountSetupToken({
      userId: updatedUser.id,
      companyId: resolvedCompanyId,
      role: assignedRole,
      createdBy: payload.userId,
    });

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;
    const setupLink = `${baseUrl}/account/setup?token=${rawToken}`;

    const targetCompanyName = resolvedCompanyName || "Infinitum";

    // Dispatch role-specific email
    let mailResult: { success: boolean; setupUrl: string; error?: any };
    if (assignedRole === "ADMIN" || assignedRole === "SUPER_ADMIN") {
      mailResult = await sendAdminInvitationEmail({
        adminName: name,
        adminEmail: email,
        companyName: targetCompanyName,
        rawToken,
        baseUrl,
      });
      await logAuditEvent({
        action: "ADMIN_CREATED",
        category: "Admin Management",
        severity: "INFO",
        actorName: payload.name || payload.email,
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: `${name} (${email})`,
        summary: `Created Admin account for ${targetCompanyName} and sent invitation link`,
      });
    } else {
      mailResult = await sendUserInvitationEmail({
        userName: name,
        userEmail: email,
        companyName: targetCompanyName,
        rawToken,
        baseUrl,
      });
      await logAuditEvent({
        action: "USER_CREATED",
        category: "User Management",
        severity: "INFO",
        actorName: payload.name || payload.email,
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: `${name} (${email})`,
        summary: `Created User account for ${targetCompanyName} and sent invitation link`,
      });
    }

    if (!mailResult.success) {
      const errDetail = mailResult.error instanceof Error ? mailResult.error.message : String(mailResult.error || "SMTP error");
      console.error("[USER CREATION EMAIL ERROR]:", errDetail);
      return NextResponse.json(
        { error: `Account created, but email delivery to ${email} failed: ${errDetail}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: updatedUser, setupLink }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function generatePassword(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}
