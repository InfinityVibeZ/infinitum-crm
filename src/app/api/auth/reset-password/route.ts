import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateToken } from "@/lib/tokens";
import { logAuditEvent } from "@/lib/audit";
import { validatePassword } from "@/lib/passwordPolicy";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/auth/reset-password?token=...
 * Pre-validates the PASSWORD_RESET token before the page shows the New Password form —
 * same pattern as GET /api/auth/setup-account, for a consistent expired/used/invalid experience.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const { valid, reason, code, user } = await validateToken(token, "PASSWORD_RESET");

    if (!valid || !user) {
      return NextResponse.json(
        { error: reason || "This password reset link has expired or is no longer valid.", code: code || "INVALID" },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true, user: { name: user.name, email: user.email } });
  } catch (error) {
    console.error("Reset password GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    // Password Policy Enforcement (same shared rules as Account Setup / Change Password)
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // Validate token hash & purpose (PASSWORD_RESET)
    const { valid, reason, record, user, legacyReset } = await validateToken(token, "PASSWORD_RESET");

    if (!valid || !user) {
      return NextResponse.json({ error: reason || "This password reset link has expired or is no longer valid." }, { status: 400 });
    }

    // Hash the new password securely
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password and ensure status is active
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        plainPassword: null,
        status: "ACTIVE",
        isActive: true,
      },
    });

    // Mark token as USED
    if (record) {
      await prisma.invitationToken.update({
        where: { id: record.id },
        data: {
          status: "USED",
          usedAt: new Date(),
        },
      });
    }

    // Delete legacy tokens for email if any
    if (legacyReset) {
      await prisma.passwordResetToken.deleteMany({
        where: { email: user.email },
      }).catch(() => {});
    }

    // Log audit log
    await logAuditEvent({
      action: "PASSWORD_RESET",
      category: "Security",
      severity: "WARNING",
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetName: `${user.name} (${user.email})`,
      summary: `User successfully reset their password via token link`,
    });

    return NextResponse.json({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
