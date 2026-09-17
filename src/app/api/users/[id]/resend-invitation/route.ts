import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, requireRole, requireAuthenticatedUser } from "@/lib/auth";
import { createAccountSetupToken } from "@/lib/tokens";
import bcrypt from "bcryptjs";
import { sendAdminInvitationEmail, sendUserInvitationEmail } from "@/lib/mail";
import { logAuditEvent } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;
    const { payload, user: authUser } = auth;

    const roleErr = requireRole(payload.role, ["SUPER_ADMIN", "ADMIN"]);
    if (roleErr) return roleErr;

    const targetUserId = resolvedParams.id;
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { companyRef: true },
    });

    if (!targetUser || targetUser.isDeleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limit: prevent double-click/spam resends from generating a flood of tokens/emails
    const RATE_LIMIT_WINDOW_MS = 60 * 1000;
    const lastInvitation = await prisma.invitationToken.findFirst({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastInvitation && Date.now() - lastInvitation.createdAt.getTime() < RATE_LIMIT_WINDOW_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (Date.now() - lastInvitation.createdAt.getTime())) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds}s before resending another invitation to this address.` },
        { status: 429 }
      );
    }

    // Company boundary authorization check for ADMIN role
    if (payload.role === "ADMIN") {
      const adminUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { companyId: true, company: true, department: true },
      });
      const adminCompId = adminUser?.companyId;
      const adminCompName = adminUser?.company || adminUser?.department;

      const isSameCompany =
        (adminCompId && targetUser.companyId === adminCompId) ||
        (adminCompName && targetUser.company?.toLowerCase() === adminCompName.toLowerCase()) ||
        targetUser.createdBy === payload.userId;

      if (!isSameCompany) {
        return NextResponse.json({ error: "Forbidden: Cannot manage user from another company" }, { status: 403 });
      }
    }

    // 1. Issue NEW 24-hour ACCOUNT_SETUP token (which automatically revokes previous pending tokens for this user)
    const { rawToken } = await createAccountSetupToken({
      userId: targetUser.id,
      companyId: targetUser.companyId,
      role: targetUser.role,
      createdBy: payload.userId,
    });

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${protocol}://${host}`;
    const setupLink = `${baseUrl}/account/setup?token=${rawToken}`;
    const targetCompanyName = targetUser.company || targetUser.companyRef?.name || targetUser.department || "Infinity Vibez";

    // 2. Dispatch email based on role
    let mailResult: { success: boolean; setupUrl: string; error?: any };
    
    // Generate new temporary password and update user
    const newTempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(newTempPassword, 12);
    await prisma.user.update({ where: { id: targetUser.id }, data: { passwordHash: hashedPassword } });

    if (targetUser.role === "ADMIN" || targetUser.role === "SUPER_ADMIN") {
      mailResult = await sendAdminInvitationEmail({
        adminName: targetUser.name,
        adminEmail: targetUser.email,
        companyName: targetCompanyName,
        rawToken,
        baseUrl,
        temporaryPassword: newTempPassword,
      });
    } else {
      mailResult = await sendUserInvitationEmail({
        userName: targetUser.name,
        userEmail: targetUser.email,
        companyName: targetCompanyName,
        rawToken,
        baseUrl,
        temporaryPassword: newTempPassword,
      });
    }

    if (!mailResult.success) {
      const errDetail = mailResult.error instanceof Error ? mailResult.error.message : String(mailResult.error || "SMTP error");
      console.error("[RESEND INVITATION ERROR]:", errDetail);
      return NextResponse.json(
        { error: `Email delivery failed for ${targetUser.email}: ${errDetail}` },
        { status: 500 }
      );
    }

    // 3. Log Audit Log
    await logAuditEvent({
      action: "INVITATION_RESENT",
      category: targetUser.role === "ADMIN" ? "Admin Management" : "User Management",
      severity: "INFO",
      actorName: payload.name || payload.email,
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: `${targetUser.name} (${targetUser.email})`,
      summary: `Resent account setup invitation link to ${targetUser.email}`,
    });

    return NextResponse.json({
      message: `Activation link resent successfully to ${targetUser.email}.`,
      setupLink,
      targetEmail: targetUser.email,
    });
  } catch (error) {
    console.error("POST /api/users/[id]/resend-invitation error:", error);
    return NextResponse.json({ error: "Failed to resend invitation", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
