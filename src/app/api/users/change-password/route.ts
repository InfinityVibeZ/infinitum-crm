import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validatePassword } from "@/lib/passwordPolicy";
import bcrypt from "bcryptjs";

/**
 * POST /api/users/change-password — Change Password for the logged-in Super Admin/Admin/User.
 * Requires current password verification. Never stores or returns the plaintext password.
 */
export async function POST(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const payload = getTokenPayload(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    // Enforce the shared application-wide password policy
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    // New password must differ from the current one
    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      return NextResponse.json({ error: "New password must be different from your current password." }, { status: 400 });
    }

    // Hash and store new password securely (never store/return plaintext)
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        plainPassword: null,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: "PASSWORD_CHANGED",
      category: "Security",
      severity: "INFO",
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetName: `${user.name} (${user.email})`,
      summary: `User changed their own password`,
    });

    return NextResponse.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
