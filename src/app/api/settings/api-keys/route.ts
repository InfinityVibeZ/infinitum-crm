import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuthenticatedUser,
  requireRole,
} from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

/*
 * SystemConfig does not have category or label fields.
 *
 * Keep the standard API-key identifiers here so this endpoint
 * can still provide a clean API-key management screen without
 * changing the database schema.
 */
const API_KEY_NAMES = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "SENDGRID_API_KEY",
  "STRIPE_API_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
];

/**
 * GET /api/settings/api-keys
 *
 * Super Admin only.
 */
export async function GET(
  request: Request
) {
  try {
    const auth =
      await requireAuthenticatedUser(
        request
      );

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const roleError =
      requireRole(
        payload.role,
        ["SUPER_ADMIN"]
      );

    if (roleError) {
      return roleError;
    }

    /*
     * SystemConfig has no category column.
     * Filter using the known API-key names.
     */
    let configs =
      await prisma.systemConfig.findMany({
        where: {
          key: {
            in: API_KEY_NAMES,
          },
        },
        orderBy: {
          key: "asc",
        },
      });

    /*
     * Seed standard API-key configuration records
     * when none exist.
     */
    if (configs.length === 0) {
      const defaults = [
        {
          id: crypto.randomUUID(),
          key: "GEMINI_API_KEY",
          value: "nexus_gemini_sk_mock_key_value",
        },
        {
          id: crypto.randomUUID(),
          key: "OPENAI_API_KEY",
          value: "nexus_openai_sk_mock_key_value",
        },
        {
          id: crypto.randomUUID(),
          key: "SENDGRID_API_KEY",
          value: "nexus_sendgrid_sk_mock_key_value",
        },
        {
          id: crypto.randomUUID(),
          key: "STRIPE_API_KEY",
          value: "nexus_stripe_sk_mock_key_value",
        },
        {
          id: crypto.randomUUID(),
          key: "SMTP_HOST",
          value: "smtp.gmail.com",
        },
        {
          id: crypto.randomUUID(),
          key: "SMTP_PORT",
          value: "587",
        },
        {
          id: crypto.randomUUID(),
          key: "SMTP_USER",
          value: "builtby.rajum@gmail.com",
        },
        {
          id: crypto.randomUUID(),
          key: "SMTP_PASS",
          value: "",
        },
      ];

      await prisma.systemConfig.createMany({
        data: defaults,
      });

      configs =
        await prisma.systemConfig.findMany({
          where: {
            key: {
              in: API_KEY_NAMES,
            },
          },
          orderBy: {
            key: "asc",
          },
        });
    }

    return NextResponse.json(
      configs
    );
  } catch (error) {
    console.error(
      "GET /api/settings/api-keys error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch settings",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/api-keys
 *
 * Create or update an API key.
 *
 * SystemConfig.key is not unique in the current schema,
 * therefore we use findFirst() followed by update/create.
 */
export async function POST(
  request: Request
) {
  try {
    const auth =
      await requireAuthenticatedUser(
        request
      );

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const roleError =
      requireRole(
        payload.role,
        ["SUPER_ADMIN"]
      );

    if (roleError) {
      return roleError;
    }

    const body =
      await request.json();

    const {
      key,
      value,
    } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        {
          error:
            "Key identifier and value are required",
        },
        { status: 400 }
      );
    }

    const formattedKey =
      String(key)
        .toUpperCase()
        .replace(/\s+/g, "_");

    /*
     * Because key is not unique, find the existing
     * record first.
     */
    const existing =
      await prisma.systemConfig.findFirst({
        where: {
          key: formattedKey,
        },
      });

    let updated;

    if (existing) {
      updated =
        await prisma.systemConfig.update({
          where: {
            id: existing.id,
          },
          data: {
            value,
          },
        });
    } else {
      updated =
        await prisma.systemConfig.create({
          data: {
            id: crypto.randomUUID(),
            key: formattedKey,
            value,
          },
        });
    }

    await logAuditEvent({
      action: "API_KEY_UPDATED",
      category: "System",
      severity: "WARNING",
      actorName:
        payload.email.split("@")[0],
      actorEmail:
        payload.email,
      actorRole:
        payload.role,
      targetName:
        formattedKey,
      summary:
        `Updated API key: ${formattedKey}`,
    });

    return NextResponse.json(
      updated
    );
  } catch (error) {
    console.error(
      "POST /api/settings/api-keys error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to save API key",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/api-keys
 *
 * Super Admin only.
 */
export async function DELETE(
  request: Request
) {
  try {
    const auth =
      await requireAuthenticatedUser(
        request
      );

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const roleError =
      requireRole(
        payload.role,
        ["SUPER_ADMIN"]
      );

    if (roleError) {
      return roleError;
    }

    const url =
      new URL(request.url);

    const key =
      url.searchParams.get(
        "key"
      );

    if (!key) {
      return NextResponse.json(
        {
          error:
            "Key parameter is required",
        },
        { status: 400 }
      );
    }

    /*
     * key is not unique, so resolve the actual
     * SystemConfig record first.
     */
    const existing =
      await prisma.systemConfig.findFirst({
        where: {
          key,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "API key not found",
        },
        { status: 404 }
      );
    }

    await prisma.systemConfig.delete({
      where: {
        id: existing.id,
      },
    });

    await logAuditEvent({
      action: "API_KEY_DELETED",
      category: "System",
      severity: "DANGER",
      actorName:
        payload.email.split("@")[0],
      actorEmail:
        payload.email,
      actorRole:
        payload.role,
      targetName:
        key,
      summary:
        `Deleted API key: ${key}`,
    });

    return NextResponse.json({
      message:
        "API key deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE /api/settings/api-keys error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete API key",
      },
      { status: 500 }
    );
  }
}