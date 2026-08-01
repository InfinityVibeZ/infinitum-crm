import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";
import type { Role, UserStatus } from "@prisma/client";

interface RouteContext {
  params: { id: string };
}

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

/** GET /api/users/[id] — Get a specific user */
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        department: true, category: true, company: true, companyId: true, phone: true, avatarUrl: true,
        modules: true, createdBy: true, lastLogin: true, createdAt: true, isActive: true, isDeleted: true, deletedAt: true,
        companyRef: { select: { id: true, name: true, category: true, status: true, isActive: true } },
      },
    });

    if (payload.role === "ADMIN" && user && user.createdBy !== payload.userId) {
      return NextResponse.json({ error: "Unauthorized access to this user" }, { status: 403 });
    }

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

/** PUT /api/users/[id] — Update a user */
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    const body = await request.json();
    const { name, phone, department, category, company, companyId, role, status, modules, isActive } = body;

    let updateRole: Role | undefined;
    if (role) {
      if (payload.role === "ADMIN" && role === "SUPER_ADMIN") {
        return NextResponse.json({ error: "Insufficient permissions to assign SUPER_ADMIN role" }, { status: 403 });
      }
      updateRole = role as Role;
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: params.id }
    });
    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (payload.role === "ADMIN" && currentUser.createdBy !== payload.userId) {
      return NextResponse.json({ error: "Unauthorized access to update this user" }, { status: 403 });
    }

    if (payload.role === "ADMIN") {
      const requestingAdmin = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!requestingAdmin || !requestingAdmin.isActive || requestingAdmin.status === "INACTIVE") {
        return NextResponse.json(
          { error: "Your Admin account is inactive. Super Admin must activate your admin access first." },
          { status: 403 }
        );
      }
    }

    let resolvedCompanyId: string | null = companyId || currentUser.companyId;
    let resolvedCompanyName: string | null = company || department || currentUser.company;

    if (companyId) {
      const comp = await (prisma as any).company.findUnique({ where: { id: companyId } });
      if (comp) resolvedCompanyName = comp.name;
    } else if (company) {
      const comp = await (prisma as any).company.findFirst({
        where: { name: { equals: company.trim(), mode: "insensitive" } },
      });
      if (comp) {
        resolvedCompanyId = comp.id;
        resolvedCompanyName = comp.name;
      }
    }

    const targetIsActive = isActive !== undefined ? isActive : status ? status === "ACTIVE" : currentUser.isActive;
    const targetStatus: UserStatus = status ? (status as UserStatus) : targetIsActive ? "ACTIVE" : "INACTIVE";

    if (targetIsActive) {
      if (currentUser.createdBy) {
        const creatorAdmin = await prisma.user.findUnique({ where: { id: currentUser.createdBy } });
        if (creatorAdmin && (!creatorAdmin.isActive || creatorAdmin.status === "INACTIVE")) {
          return NextResponse.json(
            { error: "Parent Admin account is inactive. Super Admin must activate the admin access first." },
            { status: 400 }
          );
        }
      }
      if (resolvedCompanyId) {
        const comp = await (prisma as any).company.findUnique({ where: { id: resolvedCompanyId } });
        if (comp && (!comp.isActive || comp.status === "INACTIVE")) {
          return NextResponse.json(
            { error: "Company is inactive. Activate company first." },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone: phone ? phone.replace(/[^0-9+\-\s()]/g, "").slice(0, 15) : null }),
        ...(department !== undefined && { department }),
        ...(category !== undefined && { category }),
        ...(resolvedCompanyName !== undefined && { company: resolvedCompanyName }),
        ...(resolvedCompanyId !== undefined && { companyId: resolvedCompanyId }),
        ...(updateRole && { role: updateRole }),
        status: targetStatus,
        isActive: targetIsActive,
        ...(modules !== undefined && { modules }),
      },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        department: true, category: true, company: true, companyId: true, phone: true, isActive: true, updatedAt: true,
      },
    });

    const isTargetAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
    const isDeactivatingAdmin = isTargetAdmin && currentUser.isActive && !targetIsActive;
    const isActivatingAdmin = isTargetAdmin && !currentUser.isActive && targetIsActive;

    if (isDeactivatingAdmin) {
      await prisma.user.updateMany({
        where: {
          OR: [
            { createdBy: params.id },
            ...(resolvedCompanyId ? [{ companyId: resolvedCompanyId, role: "USER" as Role }] : []),
          ],
        },
        data: { isActive: false, status: "INACTIVE" },
      });
    } else if (isActivatingAdmin) {
      await prisma.user.updateMany({
        where: {
          OR: [
            { createdBy: params.id },
            ...(resolvedCompanyId ? [{ companyId: resolvedCompanyId, role: "USER" as Role }] : []),
          ],
          isDeleted: false,
        },
        data: { isActive: true, status: "ACTIVE" },
      });
    }

    await syncCompanyStatus(resolvedCompanyId, resolvedCompanyName);
    if (currentUser.companyId !== resolvedCompanyId || currentUser.company !== resolvedCompanyName) {
      await syncCompanyStatus(currentUser.companyId, currentUser.company);
    }

    return NextResponse.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** DELETE /api/users/[id] — Soft-delete, restore, or permanently remove a user */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    if (params.id === payload.userId) {
      return NextResponse.json({ error: "Cannot remove your own account" }, { status: 400 });
    }

    const url = new URL(request.url);
    const hardDelete = url.searchParams.get("hard") === "true";
    const restore = url.searchParams.get("restore") === "true";

    const targetUser = await prisma.user.findUnique({ where: { id: params.id } });
    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (payload.role === "ADMIN" && targetUser.createdBy !== payload.userId) {
      return NextResponse.json({ error: "Unauthorized access to this user" }, { status: 403 });
    }

    // An Admin who still has Users under them cannot be deleted (soft or hard) — their
    // Users would otherwise become orphaned. Reassign or remove those Users first.
    if (!restore && targetUser.role === "ADMIN") {
      const managedUserCount = await prisma.user.count({
        where: { createdBy: targetUser.id, isDeleted: false },
      });
      if (managedUserCount > 0) {
        return NextResponse.json(
          {
            error: `Cannot delete "${targetUser.name}" — they still manage ${managedUserCount} user account(s). Remove or reassign those users first.`,
          },
          { status: 409 }
        );
      }
    }

    // Restore soft-deleted user
    if (restore) {
      const restored = await prisma.user.update({
        where: { id: params.id },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, status: true, companyId: true, company: true },
      });

      await syncCompanyStatus(restored.companyId, restored.company);

      await logAuditEvent({
        action: "USER_RESTORED",
        category: restored.role === "ADMIN" ? "Admin Management" : "User Management",
        severity: "SUCCESS",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: `${restored.name} (${restored.email})`,
        summary: `Restored ${restored.name} from archive / trash`,
      });

      return NextResponse.json({ message: "User restored from archive", user: restored });
    }

    // Permanent hard delete
    if (hardDelete) {
      if (payload.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Only Super Admins can permanently delete accounts" }, { status: 403 });
      }

      await prisma.user.delete({ where: { id: params.id } });

      await logAuditEvent({
        action: "USER_DELETED_PERMANENTLY",
        category: targetUser.role === "ADMIN" ? "Admin Management" : "User Management",
        severity: "DANGER",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: `${targetUser.name} (${targetUser.email})`,
        summary: `Permanently deleted account ${targetUser.email}`,
      });

      return NextResponse.json({ message: "User permanently deleted from database" });
    }

    // Default: Soft Delete (Move to archive / trash)
    const softDeleted = await prisma.user.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        status: "INACTIVE",
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, status: true, isDeleted: true, companyId: true, company: true },
    });

    await logAuditEvent({
      action: "USER_ARCHIVED",
      category: softDeleted.role === "ADMIN" ? "Admin Management" : "User Management",
      severity: "WARNING",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: `${softDeleted.name} (${softDeleted.email})`,
      summary: `Moved ${softDeleted.name} to archive / trash`,
    });

    return NextResponse.json({ message: "User moved to archive", user: softDeleted });
  } catch {
    return NextResponse.json({ error: "Failed to process user deletion" }, { status: 500 });
  }
}

/** PATCH /api/users/[id] — Reset password, toggle status, or restore user */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleError) return roleError;

    const body = await request.json();
    const { action } = body;

    if (action === "restore") {
      if (payload.role === "ADMIN") {
        const targetUser = await prisma.user.findUnique({ where: { id: params.id }, select: { createdBy: true } });
        if (!targetUser || targetUser.createdBy !== payload.userId) {
          return NextResponse.json({ error: "Unauthorized access to this user" }, { status: 403 });
        }
      }

      const restored = await prisma.user.update({
        where: { id: params.id },
        data: {
          isDeleted: false,
          deletedAt: null,
          isActive: true,
          status: "ACTIVE",
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, status: true, companyId: true, company: true },
      });

      await syncCompanyStatus(restored.companyId, restored.company);

      await logAuditEvent({
        action: "USER_RESTORED",
        category: restored.role === "ADMIN" ? "Admin Management" : "User Management",
        severity: "SUCCESS",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: `${restored.name} (${restored.email})`,
        summary: `Restored ${restored.name} from archive`,
      });

      return NextResponse.json({ message: "User restored", user: restored });
    }

    if (action === "reset-password") {
      // Admin/Super Admin never creates or sees the user's password.
      // Instead, dispatch a secure 24-hour PASSWORD_RESET link to the user's registered email.
      const targetUser = await prisma.user.findUnique({
        where: { id: params.id },
        select: { id: true, name: true, email: true, role: true, companyId: true, isDeleted: true },
      });
      if (!targetUser || targetUser.isDeleted) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (payload.role === "ADMIN") {
        const currentUser = await prisma.user.findUnique({ where: { id: params.id } });
        if (!currentUser || currentUser.createdBy !== payload.userId) {
          return NextResponse.json({ error: "Unauthorized access to this user" }, { status: 403 });
        }
      }

      const { rawToken } = await createPasswordResetToken({
        userId: targetUser.id,
        companyId: targetUser.companyId,
        role: targetUser.role,
      });

      const host = request.headers.get("host") || "localhost:3000";
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      const baseUrl = `${protocol}://${host}`;

      const mailResult = await sendPasswordResetEmail({
        name: targetUser.name,
        email: targetUser.email,
        rawToken,
        baseUrl,
      });

      if (!mailResult.success) {
        return NextResponse.json({ error: `Failed to send password reset link to ${targetUser.email}` }, { status: 500 });
      }

      await logAuditEvent({
        action: "PASSWORD_RESET_LINK_SENT",
        category: "Security",
        severity: "INFO",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: `${targetUser.name} (${targetUser.email})`,
        summary: `Sent a secure password reset link to ${targetUser.email}`,
      });

      return NextResponse.json({ message: `A password reset link has been sent to ${targetUser.email}.` });
    }

    if (action === "toggle-status") {
      if (payload.role === "ADMIN") {
        const requestingAdmin = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!requestingAdmin || !requestingAdmin.isActive || requestingAdmin.status === "INACTIVE") {
          return NextResponse.json(
            { error: "Your Admin account is inactive. Super Admin must activate your admin access first." },
            { status: 403 }
          );
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: params.id },
        select: { id: true, name: true, email: true, role: true, isActive: true, status: true, companyId: true, company: true, createdBy: true },
      });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      if (payload.role === "ADMIN" && user.createdBy !== payload.userId) {
        return NextResponse.json({ error: "Unauthorized access to this user" }, { status: 403 });
      }

      const nextIsActive = !user.isActive;
      const nextStatus: UserStatus = nextIsActive ? "ACTIVE" : "INACTIVE";

      if (nextIsActive && user.createdBy) {
        const creatorAdmin = await prisma.user.findUnique({ where: { id: user.createdBy } });
        if (creatorAdmin && creatorAdmin.role === "ADMIN" && (!creatorAdmin.isActive || creatorAdmin.status === "INACTIVE")) {
          return NextResponse.json(
            { error: "Parent Admin account is inactive. Super Admin must activate the admin first." },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.user.update({
        where: { id: params.id },
        data: {
          isActive: nextIsActive,
          status: nextStatus,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, status: true, companyId: true, company: true },
      });

      const isTargetAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
      let cascadeCount = 0;

      if (isTargetAdmin && !nextIsActive) {
        const cascadeResult = await prisma.user.updateMany({
          where: {
            OR: [
              { createdBy: params.id },
              ...(updated.companyId ? [{ companyId: updated.companyId, role: "USER" as Role }] : []),
            ],
          },
          data: { isActive: false, status: "INACTIVE" },
        });
        cascadeCount = cascadeResult.count;
      } else if (isTargetAdmin && nextIsActive) {
        const cascadeResult = await prisma.user.updateMany({
          where: {
            OR: [
              { createdBy: params.id },
              ...(updated.companyId ? [{ companyId: updated.companyId, role: "USER" as Role }] : []),
            ],
            isDeleted: false,
          },
          data: { isActive: true, status: "ACTIVE" },
        });
        cascadeCount = cascadeResult.count;
      }

      await syncCompanyStatus(updated.companyId, updated.company);

      await logAuditEvent({
        action: "STATUS_TOGGLED",
        category: isTargetAdmin ? "Admin Management" : "User Management",
        severity: nextIsActive ? "SUCCESS" : "WARNING",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: `${updated.name} (${updated.email})`,
        summary: isTargetAdmin
          ? nextIsActive
            ? `Restored access for Admin ${updated.name} and reactivated ${cascadeCount} users`
            : `Deactivated Admin ${updated.name} and cascade-deactivated ${cascadeCount} users`
          : `${nextIsActive ? "Restored" : "Revoked"} access for ${updated.name}`,
      });

      return NextResponse.json({ ...updated, cascadeCount });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
