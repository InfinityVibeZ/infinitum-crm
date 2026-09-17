import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAccessToken,
  requireAuthenticatedUser,
} from "@/lib/auth";
import { mergePermissionsForRole } from "@/lib/permissions";

/**
 * POST /api/auth/refresh-permissions
 *
 * Re-issues the caller's access token with freshly calculated
 * permissions from ROLE_PERMISSIONS.
 *
 * The caller's identity and role are taken from the existing
 * authenticated JWT. Client input is never trusted.
 */
export async function POST(request: Request) {
  try {
    const auth =
      await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    /*
     * SystemConfig.key is not unique in the current schema.
     * Therefore use findFirst().
     */
    const config =
      await prisma.systemConfig.findFirst({
        where: {
          key: "ROLE_PERMISSIONS",
        },
      });

    /*
     * SystemConfig.value is Json?.
     */
    let dbPerms:
      | Record<string, Record<string, boolean>>
      | null = null;

    if (
      config?.value !== null &&
      config?.value !== undefined
    ) {
      if (typeof config.value === "string") {
        try {
          dbPerms = JSON.parse(
            config.value
          ) as Record<
            string,
            Record<string, boolean>
          >;
        } catch {
          dbPerms = null;
        }
      } else if (
        typeof config.value === "object" &&
        !Array.isArray(config.value)
      ) {
        dbPerms =
          config.value as Record<
            string,
            Record<string, boolean>
          >;
      }
    }

    const permissions =
      mergePermissionsForRole(
        payload.role,
        dbPerms
      );

    /*
     * Generate a fresh 15-minute access token.
     *
     * Do not generate or expose a separate legacy
     * "nexus-token".
     */
    const newToken =
      generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        name: payload.name,
        permissions,
      });

    const response = NextResponse.json({
      success: true,
    });

    /*
     * Keep the current authentication architecture:
     *
     * nexus-access-token
     * nexus-refresh-token
     */
    response.cookies.set(
      "nexus-access-token",
      newToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60,
        path: "/",
      }
    );

    /*
     * Cosmetic permissions cookie only.
     * Authorization still relies on the signed JWT.
     */
    if (Object.keys(permissions).length > 0) {
      response.cookies.set(
        "nexus-role-permissions",
        JSON.stringify(permissions),
        {
          secure:
            process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        }
      );
    }

    return response;
  } catch (error) {
    console.error(
      "Refresh permissions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to refresh permissions",
      },
      { status: 500 }
    );
  }
}