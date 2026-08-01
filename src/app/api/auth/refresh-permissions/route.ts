import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, generateToken } from "@/lib/auth";
import { mergePermissionsForRole } from "@/lib/permissions";

/**
 * POST /api/auth/refresh-permissions
 * Re-issues the caller's JWT with a freshly computed `permissions` claim (from the
 * current ROLE_PERMISSIONS config), so a Super Admin who just edited the permissions
 * matrix sees the change take effect in their own session immediately, without
 * needing to sign out/in. Anyone can call this for their own token — it never trusts
 * client input, it only re-derives permissions for the authenticated caller's own role.
 */
export async function POST(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const config = await prisma.systemConfig.findUnique({ where: { key: "ROLE_PERMISSIONS" } });
    const dbPerms = config ? JSON.parse(config.value) : null;
    const permissions = mergePermissionsForRole(payload.role, dbPerms);

    const newToken = generateToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      permissions,
    });

    const response = NextResponse.json({ token: newToken });
    response.cookies.set("nexus-token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Refresh permissions error:", error);
    return NextResponse.json({ error: "Failed to refresh permissions" }, { status: 500 });
  }
}
