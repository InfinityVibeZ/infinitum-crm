import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PUT /api/companies/[id] — Update company details (Superadmin only) */
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const { id } = await params;
    const body = await request.json();
    const { name, category, status } = body;

    const existing = await (prisma as any).company.findUnique({ where: { id: id } });
    if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const companyStatus = status ? status : existing.status;
    const isActive = companyStatus === "ACTIVE";

    const updated = await (prisma as any).company.update({
      where: { id: id },
      data: {
        ...(name && { name: name.trim() }),
        ...(category !== undefined && { category: category ? category.trim() : null }),
        status: companyStatus,
        isActive,
      },
    });

    if (name && name.trim() !== existing.name) {
      await prisma.user.updateMany({
        where: { companyId: id },
        data: { company: name.trim() },
      });
    }

    await logAuditEvent({
      action: "COMPANY_UPDATED",
      category: "Admin Management",
      severity: "INFO",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: updated.name,
      summary: `Updated company details for ${updated.name}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update company";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** PATCH /api/companies/[id] — Toggle status or restore from archive (Superadmin only) */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    const existing = await (prisma as any).company.findUnique({ where: { id: id } });
    if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    if (action === "restore") {
      const restored = await (prisma as any).company.update({
        where: { id: id },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });

      await logAuditEvent({
        action: "COMPANY_RESTORED",
        category: "Admin Management",
        severity: "SUCCESS",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: restored.name,
        summary: `Restored company ${restored.name} from archive`,
      });

      return NextResponse.json({ message: "Company restored successfully", company: restored });
    }

    // Toggle active status
    const nextActive = !existing.isActive;
    const nextStatus = nextActive ? "ACTIVE" : "INACTIVE";

    const updated = await (prisma as any).company.update({
      where: { id: id },
      data: {
        isActive: nextActive,
        status: nextStatus,
      },
    });

    // If deactivating company, deactivate all associated users and admins
    if (!nextActive) {
      await prisma.user.updateMany({
        where: {
          OR: [
            { companyId: id },
            { company: existing.name },
          ],
        },
        data: {
          isActive: false,
          status: "INACTIVE",
        },
      });
    }
    // If activating company, do NOT activate users/admins automatically per user requirement.

    await logAuditEvent({
      action: "COMPANY_STATUS_TOGGLED",
      category: "Admin Management",
      severity: nextActive ? "SUCCESS" : "WARNING",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: updated.name,
      summary: `${nextActive ? "Activated" : "Deactivated"} company ${updated.name}${
        !nextActive ? " (also deactivated all members)" : " (members remain inactive)"
      }`,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to toggle company status" }, { status: 500 });
  }
}

/** DELETE /api/companies/[id] — Soft-delete or permanently remove company */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const { id } = await params;
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get("hard") === "true";
    const restore = url.searchParams.get("restore") === "true";

    const company = await (prisma as any).company.findUnique({ where: { id: id } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Restore request
    if (restore) {
      const restored = await (prisma as any).company.update({
        where: { id: id },
        data: { isDeleted: false, deletedAt: null },
      });

      await logAuditEvent({
        action: "COMPANY_RESTORED",
        category: "Admin Management",
        severity: "SUCCESS",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: company.name,
        summary: `Restored company ${company.name} from archive`,
      });

      return NextResponse.json({ message: "Company restored", company: restored });
    }

    // A company with any Admin/User accounts still attached cannot be deleted (soft or
    // hard) — reassign or remove those accounts first, otherwise they'd be orphaned or
    // silently unlinked.
    const memberCount = await prisma.user.count({
      where: {
        isDeleted: false,
        OR: [
          { companyId: id },
          { company: { equals: company.name, mode: "insensitive" } },
        ],
      },
    });
    if (memberCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete "${company.name}" — it still has ${memberCount} Admin/User account(s) associated. Remove or reassign them first.`,
        },
        { status: 409 }
      );
    }

    // Permanent hard delete
    if (hardDelete) {
      // Unlink users associated with this company
      await prisma.user.updateMany({
        where: { companyId: id },
        data: { companyId: null, company: null, department: null },
      });
      await prisma.user.updateMany({
        where: { company: company.name },
        data: { companyId: null, company: null, department: null },
      });

      await (prisma as any).company.delete({ where: { id: id } });

      await logAuditEvent({
        action: "COMPANY_DELETED_PERMANENTLY",
        category: "Admin Management",
        severity: "DANGER",
        actorName: payload.email.split("@")[0],
        actorEmail: payload.email,
        actorRole: payload.role,
        targetName: company.name,
        summary: `Permanently deleted company ${company.name}`,
      });

      return NextResponse.json({ message: "Company deleted permanently" });
    }

    // Soft delete
    const softDeleted = await (prisma as any).company.update({
      where: { id: id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await logAuditEvent({
      action: "COMPANY_SOFT_DELETED",
      category: "Admin Management",
      severity: "WARNING",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: company.name,
      summary: `Soft deleted company ${company.name}`,
    });

    return NextResponse.json({ message: "Company moved to archive", company: softDeleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete company";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
