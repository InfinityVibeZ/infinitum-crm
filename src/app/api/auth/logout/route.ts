import { NextResponse } from "next/server";
import { extractTokenFromRequest, getTokenPayload } from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";
import { clearSession } from "@/lib/session-limit";

export async function POST(request: Request) {
  const ip = getIpFromRequest(request);

  // Try to identify who is logging out for the audit trail
  try {
    const token = extractTokenFromRequest(request);
    if (token) {
      const payload = getTokenPayload(token);
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
        // Free this user's slot immediately rather than waiting for the idle window to expire.
        await clearSession(payload.userId);
      }
    }
  } catch {
    // Non-critical — don't block logout if audit fails
  }

  const response = NextResponse.json({ success: true });

  // Clear the auth token cookie
  response.cookies.set("nexus-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  response.cookies.set("nexus-role", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  // Also clear the client-side permissions cookie
  response.cookies.set("nexus-role-permissions", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
