import { NextResponse } from "next/server";
import { extractTokenFromRequest, getTokenPayload } from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";
import { clearSession } from "@/lib/session-limit";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const ip = getIpFromRequest(request);

  try {
    const token = extractTokenFromRequest(request);
    let payload = null;
    if (token) {
      payload = getTokenPayload(token);
      if (payload) {
        await logAuditEvent({
          action:    "USER_LOGOUT",
          category:  "Authentication",
          severity:  "INFO",
          actorName:  payload.name || payload.email,
          actorEmail: payload.email,
          actorRole:  payload.role,
          targetName: "Dashboard",
          summary:   `${payload.name || payload.email} logged out of the system`,
          ipAddress: ip,
        });
        await clearSession(payload.userId);
      }
    }

    // Revoke the refresh token in the DB session if possible
    const cookieHeader = request.headers.get("cookie");
    let currentRefreshToken = null;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split("; ").map(c => {
          const [k, v] = c.split("=");
          return [k, decodeURIComponent(v)];
        })
      );
      currentRefreshToken = cookies["nexus-refresh-token"];
    }

    if (currentRefreshToken && payload?.userId) {
      const activeSessions = await prisma.session.findMany({
        where: { userId: payload.userId, revokedAt: null }
      });
      for (const session of activeSessions) {
        const isMatch = await bcrypt.compare(currentRefreshToken, session.refreshTokenHash);
        if (isMatch) {
          await prisma.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() }
          });
          break;
        }
      }
    }
  } catch {
    // Non-critical — don't block logout if audit fails
  }

  const response = NextResponse.json({ success: true });

  // Clear auth cookies using the correct Next.js delete method
  response.cookies.delete("nexus-access-token");
  response.cookies.delete("nexus-refresh-token");
  response.cookies.delete("nexus-token");
  response.cookies.delete("nexus-role");
  response.cookies.delete("nexus-role-permissions");

  return response;
}
