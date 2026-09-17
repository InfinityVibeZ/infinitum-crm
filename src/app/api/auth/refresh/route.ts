import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    /*
     * Read refresh token from HttpOnly cookie.
     */
    const cookieHeader =
      request.headers.get("cookie");

    let currentRefreshToken:
      | string
      | null = null;

    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader
          .split("; ")
          .map((cookie) => {
            const separatorIndex =
              cookie.indexOf("=");

            if (separatorIndex === -1) {
              return [cookie, ""];
            }

            const key =
              cookie.substring(
                0,
                separatorIndex
              );

            const value =
              cookie.substring(
                separatorIndex + 1
              );

            return [
              key,
              decodeURIComponent(value),
            ];
          })
      );

      currentRefreshToken =
        cookies["nexus-refresh-token"] ||
        null;
    }

    if (!currentRefreshToken) {
      return NextResponse.json(
        {
          error:
            "No refresh token provided",
        },
        { status: 401 }
      );
    }

    /*
     * Verify refresh-token JWT signature.
     */
    let payload;

    try {
      payload =
        verifyToken(currentRefreshToken);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid refresh token",
        },
        { status: 401 }
      );
    }

    if (!payload || !payload.userId) {
      return NextResponse.json(
        {
          error:
            "Invalid refresh token payload",
        },
        { status: 401 }
      );
    }

    /*
     * Load authoritative user.
     */
    const user =
      await prisma.user.findUnique({
        where: {
          id: payload.userId,
        },
        include: {
          companyRef: true,
        },
      });

    if (
      !user ||
      user.status === "INACTIVE" ||
      !user.isActive
    ) {
      return NextResponse.json(
        {
          error:
            "User deactivated",
        },
        { status: 401 }
      );
    }

    /*
     * Validate company status for customer users.
     */
    if (user.role !== "SUPER_ADMIN") {
      const compId =
        user.companyId ||
        user.companyRef?.id;

      const compName =
        user.company ||
        user.department;

      let isCompDeactivated =
        false;

      if (user.companyRef) {
        if (
          !user.companyRef.isActive ||
          user.companyRef.status ===
          "INACTIVE"
        ) {
          isCompDeactivated = true;
        }
      } else if (
        compId ||
        compName
      ) {
        /*
         * Do not include undefined values in Prisma OR.
         */
        const conditions = [];

        if (compId) {
          conditions.push({
            id: compId,
          });
        }

        if (compName) {
          conditions.push({
            name: {
              equals: compName,
              mode: "insensitive" as const,
            },
          });
        }

        if (conditions.length > 0) {
          const company =
            await prisma.company.findFirst({
              where: {
                OR: conditions,
              },
            });

          if (
            company &&
            (!company.isActive ||
              company.status === "INACTIVE")
          ) {
            isCompDeactivated = true;
          }
        }
      }

      if (isCompDeactivated) {
        return NextResponse.json(
          {
            error:
              "Company deactivated",
          },
          { status: 401 }
        );
      }
    }

    /*
     * Find the session whose bcrypt hash matches
     * the supplied refresh token.
     */
    const activeSessions =
      await prisma.session.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    let matchedSession:
      | (typeof activeSessions)[number]
      | null = null;

    for (const session of activeSessions) {
      const isMatch =
        await bcrypt.compare(
          currentRefreshToken,
          session.refreshTokenHash
        );

      if (isMatch) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      /*
       * Refresh-token reuse / revoked session detection.
       *
       * Revoke all sessions for this user.
       */
      await prisma.session.updateMany({
        where: {
          userId: user.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          error:
            "Session invalid or revoked",
        },
        { status: 401 }
      );
    }

    /*
     * Absolute session timeout.
     *
     * Maximum session lifetime = 24 hours.
     */
    const MAX_SESSION_DURATION_MS =
      24 * 60 * 60 * 1000;

    if (
      Date.now() -
      matchedSession.createdAt.getTime() >
      MAX_SESSION_DURATION_MS
    ) {
      await prisma.session.update({
        where: {
          id: matchedSession.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          error:
            "Absolute session timeout reached",
        },
        { status: 401 }
      );
    }

    /*
     * Prepare new token payload.
     */
    const newPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name:
        user.name ||
        user.email,
    };

    /*
     * Recalculate permissions for the new access token.
     */
    let rolePermissions: Record<
      string,
      boolean
    > = {};

    if (user.role) {
      const {
        getDefaultPermissionsForRole,
        mergePermissionsForRole,
      } = await import(
        "@/lib/permissions"
      );

      rolePermissions =
        getDefaultPermissionsForRole(
          user.role
        );

      try {
        const config =
          await prisma.systemConfig.findFirst({
            where: {
              key: "ROLE_PERMISSIONS",
            },
          });

        let dbPerms:
          | Record<
            string,
            Record<string, boolean>
          >
          | null = null;

        if (
          config?.value !== null &&
          config?.value !== undefined
        ) {
          if (
            typeof config.value === "string"
          ) {
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

        rolePermissions =
          mergePermissionsForRole(
            user.role,
            dbPerms
          );
      } catch (err) {
        console.error(
          "Failed to load role permissions during refresh:",
          err
        );
      }
    }

    /*
     * Generate rotated tokens.
     */
    const newAccessToken =
      generateAccessToken({
        ...newPayload,
        permissions:
          rolePermissions,
      });

    const newRefreshToken =
      generateRefreshToken(
        newPayload
      );

    /*
     * Store only the bcrypt hash of the
     * refresh token.
     */
    const newRefreshTokenHash =
      await bcrypt.hash(
        newRefreshToken,
        10
      );

    /*
     * Rotate the existing session hash.
     */
    await prisma.session.update({
      where: {
        id: matchedSession.id,
      },
      data: {
        refreshTokenHash:
          newRefreshTokenHash,
      },
    });

    const response =
      NextResponse.json({
        success: true,
      });

    /*
     * New access token.
     */
    response.cookies.set(
      "nexus-access-token",
      newAccessToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        maxAge: 15 * 60,
        path: "/",
      }
    );

    /*
     * New refresh token.
     */
    response.cookies.set(
      "nexus-refresh-token",
      newRefreshToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        maxAge:
          60 * 60 * 24 * 7,
        path: "/",
      }
    );

    /*
     * Cosmetic permissions cookie.
     */
    if (
      Object.keys(
        rolePermissions
      ).length > 0
    ) {
      response.cookies.set(
        "nexus-role-permissions",
        JSON.stringify(
          rolePermissions
        ),
        {
          secure:
            process.env.NODE_ENV ===
            "production",
          sameSite: "lax",
          maxAge:
            60 * 60 * 24 * 7,
          path: "/",
        }
      );
    }

    return response;
  } catch (error) {
    console.error(
      "Refresh error:",
      error
    );

    return NextResponse.json(
      {
        error: "Refresh failed",
      },
      { status: 500 }
    );
  }
}