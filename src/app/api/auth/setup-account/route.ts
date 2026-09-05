import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateToken } from "@/lib/tokens";
import { logAuditEvent } from "@/lib/audit";
import { validatePassword } from "@/lib/passwordPolicy";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/auth/setup-account?token=...
 * Validates token and returns basic account context for setup page UI.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    console.log(`[API GET /api/auth/setup-account] Received token param: "${token}"`);

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // First check if there's any record for this token (even expired)
    // so we can return role/company for a better expired message
    const { valid, reason, code, user, record } = await validateToken(token, "ACCOUNT_SETUP");
    console.log(`[API GET setup-account] validateResult: valid=${valid}, reason="${reason}", code=${code}, userId=${user?.id}`);

    if (!valid) {
      // Try to retrieve user context even for expired/revoked tokens for better UX
      let expiredContext: { role?: string; company?: string } | null = null;
      try {
        const { hashToken } = await import("@/lib/tokens");
        const tokenHash = hashToken(token);
        const invModel = (prisma as any).invitationToken || (prisma as any).InvitationToken;
        if (invModel) {
          const expiredRecord = await invModel.findFirst({
            where: {
              OR: [{ tokenHash }, { tokenHash: token }],
            },
            include: {
              user: {
                select: { role: true, company: true, department: true, companyRef: { select: { name: true } } },
              },
            },
          });
          if (expiredRecord?.user) {
            expiredContext = {
              role: expiredRecord.user.role,
              company:
                expiredRecord.user.company ||
                expiredRecord.user.companyRef?.name ||
                expiredRecord.user.department ||
                "Infinity Vibez",
            };
          }
        }
      } catch (_) { }

      return NextResponse.json(
        {
          error: reason || "This setup link has expired or is no longer valid.",
          expired: true,
          code: code || "INVALID",
          ...(expiredContext ?? {}),
        },
        { status: 400 }
      );
    }

    const companyName = user!.company || user!.companyRef?.name || user!.department || "Infinity Vibez";

    return NextResponse.json({
      valid: true,
      user: {
        name: user!.name,
        email: user!.email,
        role: user!.role,
        company: companyName,
      },
    });
  } catch (error) {
    console.error("Setup account GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/auth/setup-account
 * Submits new password for account setup & activation.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    // Password Policy Enforcement
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // Validate Token
    const { valid, reason, record, user } = await validateToken(token, "ACCOUNT_SETUP");

    if (!valid || !user || !record) {
      return NextResponse.json({ error: reason || "This setup link has expired or is no longer valid." }, { status: 400 });
    }

    // Securely hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 1. Update User to ACTIVE and set passwordHash
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        plainPassword: null, // Ensure plainPassword is empty/null
        status: "ACTIVE",
        isActive: true,
      },
    });

    // 2. Mark token as USED
    await prisma.invitationToken.update({
      where: { id: record.id },
      data: {
        status: "USED",
        usedAt: new Date(),
      },
    });

    // 3. Log Audit Log Event
    await logAuditEvent({
      action: "ACCOUNT_ACTIVATED",
      category: "User Management",
      severity: "SUCCESS",
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetName: `${user.name} (${user.email})`,
      summary: `${user.role} account activated and password created successfully`,
    });

    return NextResponse.json({
      message: "Your account has been activated successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Setup account POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
