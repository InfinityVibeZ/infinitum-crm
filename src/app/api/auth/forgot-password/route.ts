import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { companyRef: true },
    });

    if (!user || user.isDeleted) {
      return NextResponse.json(
        { error: "You don't have an account with this email address." },
        { status: 404 }
      );
    }

    if (!user.isActive || user.status === "INACTIVE") {
      return NextResponse.json(
        { error: "This account is inactive. Please contact your team admin." },
        { status: 403 }
      );
    }

    // Generate secure 24-hour PASSWORD_RESET token
    const companyId = user.companyId || user.companyRef?.id;
    const { rawToken } = await createPasswordResetToken({
      userId: user.id,
      companyId,
      role: user.role,
    });

    // Determine base URL
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;

    // Send Password Reset Email
    const mailResult = await sendPasswordResetEmail({
      name: user.name,
      email: user.email,
      rawToken,
      baseUrl,
    });

    if (!mailResult.success) {
      return NextResponse.json(
        { error: `Failed to send reset link to ${user.email}. Please try again.` },
        { status: 500 }
      );
    }

    // Log Audit Event
    await logAuditEvent({
      action: "PASSWORD_RESET_REQUESTED",
      category: "Security",
      severity: "INFO",
      actorName: user.name,
      actorEmail: user.email,
      actorRole: user.role,
      targetName: `${user.name} (${user.email})`,
      summary: `Password reset requested for registered email`,
    });

    return NextResponse.json({ message: `A secure password reset link has been sent to ${user.email}.` });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
