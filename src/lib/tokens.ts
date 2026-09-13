import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Helper to safely resolve the InvitationToken Prisma model accessor
 */
function getInvitationTokenModel() {
  const p = prisma as any;
  if (p.invitationToken || p.InvitationToken) {
    return p.invitationToken || p.InvitationToken;
  }
  try {
    const { PrismaClient } = require("@prisma/client");
    const fresh = new PrismaClient();
    return (fresh as any).invitationToken || (fresh as any).InvitationToken || null;
  } catch (_) {
    return null;
  }
}

/**
 * Helper to safely resolve the PasswordResetToken Prisma model accessor (if existing)
 */
function getPasswordResetTokenModel() {
  const p = prisma as any;
  return p.passwordResetToken || p.PasswordResetToken || null;
}

/**
 * Generate a cryptographically secure 64-character random token string (32 bytes hex)
 */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Calculate SHA-256 hash of a raw token for secure database storage/lookup
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Issue a new ACCOUNT_SETUP invitation token for an Admin or User.
 * Revokes any existing PENDING invitations for this user to prevent state conflicts.
 * Expiration: 24 Hours.
 */
export async function createAccountSetupToken({
  userId,
  companyId,
  role,
  createdBy,
}: {
  userId: string;
  companyId?: string | null;
  role: Role;
  createdBy?: string | null;
}) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const model = getInvitationTokenModel();

  if (model) {
    try {
      // Revoke any previous PENDING setup invitations for this user
      // Revoke any previous setup invitations for this user by deleting them
      await model.deleteMany({
        where: { userId },
      });
    } catch (e) {
      console.warn("[createAccountSetupToken] Delete warning:", e);
    }

    try {
      // Get user email
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user) throw new Error("User not found");

      // Store token hash in DB
      const tokenRecord = await model.create({
        data: {
          tokenHash,
          email: user.email,
          userId,
          companyId: companyId || undefined,
          expiresAt,
        },
      });
      return { rawToken, tokenRecord };
    } catch (e) {
      console.error("[createAccountSetupToken] Create error:", e);
      throw e;
    }
  }

  return { rawToken, tokenRecord: null };
}

/**
 * Issue a new PASSWORD_RESET token for an Active user.
 * Revokes any existing unused password reset tokens for this user.
 * Expiration: 30 minutes.
 */
export async function createPasswordResetToken({
  userId,
}: {
  userId: string;
}) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  // Delete all previous reset tokens for this user
  try {
    await prisma.passwordResetToken.deleteMany({
      where: { user_id: userId },
    });
  } catch (e) {
    console.warn("[createPasswordResetToken] Delete warning:", e);
  }

  // Create new reset token
  try {
    const tokenRecord = await prisma.passwordResetToken.create({
      data: {
        token_hash: tokenHash,
        user_id: userId,
        expiresAt,
      },
    });
    return { rawToken, tokenRecord };
  } catch (e) {
    console.error("[createPasswordResetToken] Create error:", e);
  }

  return { rawToken, tokenRecord: null };
}

/**
 * Validate an incoming raw token string for a specific purpose (ACCOUNT_SETUP | PASSWORD_RESET).
 * Performs hash lookup, expiration check, status check, and single-use validation.
 */
export type TokenInvalidCode = "USED" | "REVOKED" | "EXPIRED" | "INVALID";

export async function validateToken(rawToken: string, expectedPurpose: "ACCOUNT_SETUP" | "PASSWORD_RESET") {
  if (!rawToken || typeof rawToken !== "string") {
    return { valid: false, reason: "Token is required", code: "INVALID" as TokenInvalidCode, record: null, user: null };
  }

  const tokenHash = hashToken(rawToken);
  if (expectedPurpose === "PASSWORD_RESET") {
    try {
      const resetRecord = await prisma.passwordResetToken.findFirst({
        where: { token_hash: tokenHash },
      });

      if (!resetRecord) {
        return { valid: false, reason: "This password reset link is invalid.", code: "INVALID" as TokenInvalidCode, record: null, user: null };
      }

      if (resetRecord.used_at) {
        return { valid: false, reason: "This password reset link has already been used.", code: "USED" as TokenInvalidCode, record: null, user: null };
      }

      if (resetRecord.expiresAt < new Date()) {
        return { valid: false, reason: "This password reset link has expired (30-minute limit).", code: "EXPIRED" as TokenInvalidCode, record: null, user: null };
      }

      if (!resetRecord.user_id) {
        return { valid: false, reason: "Invalid reset token association.", code: "INVALID" as TokenInvalidCode, record: null, user: null };
      }

      const user = await prisma.user.findUnique({
        where: { id: resetRecord.user_id },
        include: { companyRef: true },
      });

      if (!user) {
        return { valid: false, reason: "The user associated with this token no longer exists.", code: "INVALID" as TokenInvalidCode, record: null, user: null };
      }

      return { valid: true, reason: null, code: null, record: resetRecord, user };
    } catch (err) {
      console.warn("[validateToken PASSWORD_RESET] Error:", err);
      return { valid: false, reason: "Internal server error during validation.", code: "INVALID" as TokenInvalidCode, record: null, user: null };
    }
  }

  const model = getInvitationTokenModel();

  if (model && expectedPurpose === "ACCOUNT_SETUP") {
    try {
      // Try lookup in invitation_tokens table (by tokenHash or rawToken)
      let tokenRecord = await model.findFirst({
        where: {
          OR: [
            { tokenHash },
            { tokenHash: rawToken },
          ],
        }
      });

      if (tokenRecord) {
        // Fetch user manually because InvitationToken model has no explicit user relation
        const user = tokenRecord.userId ? await prisma.user.findUnique({
          where: { id: tokenRecord.userId },
          include: { companyRef: true }
        }) : null;

        if (tokenRecord.usedAt) {
          return { valid: false, reason: "This invitation link has already been used", code: "USED" as TokenInvalidCode, record: null, user: null };
        }

        if (tokenRecord.expiresAt < new Date()) {
          return { valid: false, reason: "This link has expired (24-hour limit)", code: "EXPIRED" as TokenInvalidCode, record: null, user: null };
        }

        return { valid: true, reason: null, code: null, record: tokenRecord, user };
      }
    } catch (err) {
      console.warn("[validateToken] Warning/skipped:", err);
    }
  }

  return { valid: false, reason: "This link has expired or is no longer valid.", code: "INVALID" as TokenInvalidCode, record: null, user: null };
}
