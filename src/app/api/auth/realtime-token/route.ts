import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, generateAccessToken } from "@/lib/auth";

/**
 * Realtime token endpoint (Phase 3.8.7.3).
 *
 * The CRM uses HttpOnly cookies for browser authentication, so the browser
 * cannot read its own access token to pass to the WebSocket hub. This endpoint
 * exchanges the EXISTING HttpOnly-cookie session for a SHORT-LIVED (5-minute)
 * access token whose sole purpose is SignalR authentication.
 *
 * Security notes:
 * - Verifies the caller with the same requireAuthenticatedUser guard as every
 *   other API route — no new authentication system.
 * - The token is the SAME JWT_SECRET-signed access-token shape the hub already
 *   verifies (src/realtime/identity.ts) — no second token format.
 * - The returned token is NOT stored anywhere (no cookies, no storage); the
 *   frontend holds it only in memory for the duration of a connection attempt.
 * - Refresh tokens are never exposed.
 */
const REALTIME_TOKEN_TTL_SECONDS = 5 * 60;

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth instanceof Response) {
    return auth;
  }

  const { user } = auth;
  const companyId = user.companyId || user.companyRef?.id;

  if (!companyId) {
    return NextResponse.json(
      { error: "Not tenant-scoped" },
      { status: 403 }
    );
  }

  // Short-lived, purpose-scoped JWT in the exact shape the hub verifies.
  const token = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return NextResponse.json(
    {
      url: process.env.NEXT_PUBLIC_REALTIME_URL || null,
      accessToken: token,
      expiresIn: REALTIME_TOKEN_TTL_SECONDS,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
