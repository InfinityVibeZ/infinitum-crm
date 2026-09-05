import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { DEFAULT_PAGE_PERMISSIONS as DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { hasFeature } from "@/lib/subscription";

/** GET /api/settings/permissions — Fetch dynamic role permissions */
export async function GET(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const config = await prisma.systemConfig.findUnique({
      where: { key: "ROLE_PERMISSIONS" }
    });

    if (!config) {
      // Seed default permissions
      const newConfig = await prisma.systemConfig.create({
        data: {
          key: "ROLE_PERMISSIONS",
          value: JSON.stringify(DEFAULT_PERMISSIONS),
          label: "Dynamic Role Permissions Matrix",
          category: "SYSTEM"
        }
      });
      return NextResponse.json(JSON.parse(newConfig.value));
    }

    const currentPerms = JSON.parse(config.value);
    
    // Merge existing DB permissions config with DEFAULT_PERMISSIONS to support newly added paths
    const mergedPerms = { ...DEFAULT_PERMISSIONS, ...currentPerms };
    return NextResponse.json(mergedPerms);
  } catch (error) {
    console.error("GET /api/settings/permissions error:", error);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}

/** POST /api/settings/permissions — Update role permissions matrix (Super Admin only) */
export async function POST(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    if (!(await hasFeature(payload.companyId, "ADVANCED_PERMISSIONS"))) {
      return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "ADVANCED_PERMISSIONS" }, { status: 403 });
    }

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);
    if (roleError) return roleError;

    const body = await request.json();
    const { permissions } = body;

    if (!permissions) {
      return NextResponse.json({ error: "Permissions payload is required" }, { status: 400 });
    }

    const updated = await prisma.systemConfig.upsert({
      where: { key: "ROLE_PERMISSIONS" },
      update: {
        value: JSON.stringify(permissions)
      },
      create: {
        key: "ROLE_PERMISSIONS",
        value: JSON.stringify(permissions),
        label: "Dynamic Role Permissions Matrix",
        category: "SYSTEM"
      }
    });

    await logAuditEvent({
      action: "PERMISSIONS_UPDATED",
      category: "Security",
      severity: "WARNING",
      actorName: payload.email.split("@")[0],
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: "Role Permissions Configuration",
      summary: `Updated role permissions matrix dynamically`,
    });

    return NextResponse.json(JSON.parse(updated.value));
  } catch (error) {
    console.error("POST /api/settings/permissions error:", error);
    return NextResponse.json({ error: "Failed to save permissions" }, { status: 500 });
  }
}
