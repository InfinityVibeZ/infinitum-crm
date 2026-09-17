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

    if (!user || user.isDeleted || !user.isActive || user.status === "INACTIVE") {
      // User enumeration protection: pretend we sent it
      return NextResponse.json({ message: "If an account exists for this email, a secure password reset link has been sent." });
    }

    // Generate secure 30-minute PASSWORD_RESET token
    const { rawToken } = await createPasswordResetToken({
      userId: user.id,
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

    return NextResponse.json({ message: "If an account exists for this email, a secure password reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
