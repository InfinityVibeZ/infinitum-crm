import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireAuthenticatedUser } from "@/lib/auth";

const SMTP_CONFIG_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_FROM_NAME",
  "SMTP_SERVICE",
] as const;

type SmtpConfigKey = (typeof SMTP_CONFIG_KEYS)[number];

async function upsertSystemConfig(
  key: SmtpConfigKey,
  value: string
) {
  const existing = await prisma.systemConfig.findFirst({
    where: { key },
  });

  if (existing) {
    return prisma.systemConfig.update({
      where: { id: existing.id },
      data: { value },
    });
  }

  return prisma.systemConfig.create({
    data: {
      id: crypto.randomUUID(),
      key,
      value,
    },
  });
}

export async function PUT(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // 1. SUPER_ADMIN ONLY
    // ---------------------------------------------------------

    const authResult = await requireAuthenticatedUser(request, ["SUPER_ADMIN"]);
    if (authResult instanceof Response) return authResult;

    // ---------------------------------------------------------
    // 2. READ FORM DATA
    // ---------------------------------------------------------

    const body = await request.json();

    const {
      host,
      port,
      username,
      password,
      fromEmail,
      fromName,
      service,
    } = body;

    // ---------------------------------------------------------
    // 3. VALIDATION
    // ---------------------------------------------------------

    if (!host || typeof host !== "string") {
      return NextResponse.json(
        { message: "SMTP host is required" },
        { status: 400 }
      );
    }

    if (!port || !Number.isInteger(Number(port))) {
      return NextResponse.json(
        { message: "Valid SMTP port is required" },
        { status: 400 }
      );
    }

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { message: "SMTP username is required" },
        { status: 400 }
      );
    }

    if (!fromEmail || typeof fromEmail !== "string") {
      return NextResponse.json(
        { message: "From email is required" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 4. SAVE NON-SENSITIVE SETTINGS
    // ---------------------------------------------------------

    await upsertSystemConfig("SMTP_HOST", host.trim());

    await upsertSystemConfig(
      "SMTP_PORT",
      String(Number(port))
    );

    await upsertSystemConfig(
      "SMTP_USER",
      username.trim()
    );

    await upsertSystemConfig(
      "SMTP_FROM",
      fromEmail.trim()
    );

    if (fromName !== undefined) {
      await upsertSystemConfig(
        "SMTP_FROM_NAME",
        String(fromName).trim()
      );
    }

    if (service !== undefined) {
      await upsertSystemConfig(
        "SMTP_SERVICE",
        String(service).trim()
      );
    }

    // ---------------------------------------------------------
    // 5. ENCRYPT SMTP PASSWORD
    // ---------------------------------------------------------

    // IMPORTANT:
    // Only encrypt/update the password when the administrator
    // actually supplied one.
    //
    // This allows the admin to update host/from/etc. without
    // accidentally deleting the existing SMTP password.

    if (
      password !== undefined &&
      password !== null &&
      String(password).length > 0
    ) {
      const encryptedPassword = await encrypt(
        String(password)
      );

      await upsertSystemConfig(
        "SMTP_PASS",
        encryptedPassword
      );
    }

    // ---------------------------------------------------------
    // 6. NEVER RETURN THE PASSWORD
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      message: "Email configuration saved successfully",
      hasPassword:
        password !== undefined &&
          password !== null &&
          String(password).length > 0
          ? true
          : await hasExistingSmtpPassword(),
    });
  } catch (error) {
    console.error(
      "Failed to save email configuration:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save email configuration",
      },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------------
// GET current SMTP configuration (excluding password) for UI consumption
// ------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(request, ["SUPER_ADMIN"]);
    if (authResult instanceof Response) return authResult;

    const keys = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_FROM",
      "SMTP_FROM_NAME",
      "SMTP_SERVICE",
    ] as const;

    const configRecords = await prisma.systemConfig.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const config: Record<string, string> = {};
    for (const rec of configRecords) {
      config[rec.key] = rec.value;
    }

    const passwordRecord = await prisma.systemConfig.findFirst({
      where: { key: "SMTP_PASS" },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      config: {
        host: config["SMTP_HOST"] ?? "",
        port: config["SMTP_PORT"] ?? "",
        username: config["SMTP_USER"] ?? "",
        fromEmail: config["SMTP_FROM"] ?? "",
        fromName: config["SMTP_FROM_NAME"] ?? "",
        service: config["SMTP_SERVICE"] ?? "",
      },
      hasPassword: Boolean(passwordRecord),
    });
  } catch (error) {
    console.error("GET /api/admin/email-config error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function hasExistingSmtpPassword(): Promise<boolean> {
  const config = await prisma.systemConfig.findFirst({
    where: {
      key: "SMTP_PASS",
    },
    select: {
      id: true,
      value: true,
    },
  });

  return Boolean(config?.value);
}