import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

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
      await model.updateMany({
        where: {
          userId,
          purpose: "ACCOUNT_SETUP",
          status: "PENDING",
        },
        data: {
          status: "REVOKED",
        },
      });
    } catch (e) {
      console.warn("[createAccountSetupToken] Revoke warning:", e);
    }

    try {
      // Store token hash in DB
      const tokenRecord = await model.create({
        data: {
          tokenHash,
          userId,
          companyId: companyId || undefined,
          role,
          purpose: "ACCOUNT_SETUP",
          status: "PENDING",
          expiresAt,
          createdBy,
        },
      });
      return { rawToken, tokenRecord };
    } catch (e) {
      console.warn("[createAccountSetupToken] Create warning:", e);
    }
  }

  return { rawToken, tokenRecord: null };
}

/**
 * Issue a new PASSWORD_RESET token for an Active user.
 * Revokes any existing PENDING password reset tokens for this user.
 * Expiration: 24 Hours (matches ACCOUNT_SETUP for a consistent link-lifetime/messaging experience).
 */
export async function createPasswordResetToken({
  userId,
  companyId,
  role,
}: {
  userId: string;
  companyId?: string | null;
  role: Role;
}) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const model = getInvitationTokenModel();

  if (model) {
    try {
      // Revoke any previous PENDING reset tokens for this user
      await model.updateMany({
        where: {
          userId,
          purpose: "PASSWORD_RESET",
          status: "PENDING",
        },
        data: {
          status: "REVOKED",
        },
      });
    } catch (e) {
      console.warn("[createPasswordResetToken] Revoke warning:", e);
    }

    const resetModel = getPasswordResetTokenModel();
    if (resetModel) {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user?.email) {
          await resetModel.deleteMany({ where: { email: user.email } });
        }
      } catch (_) {}
    }

    try {
      const tokenRecord = await model.create({
        data: {
          tokenHash,
          userId,
          companyId: companyId || undefined,
          role,
          purpose: "PASSWORD_RESET",
          status: "PENDING",
          expiresAt,
        },
      });
      return { rawToken, tokenRecord };
    } catch (e) {
      console.warn("[createPasswordResetToken] Create warning:", e);
    }
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
  const model = getInvitationTokenModel();

  if (model) {
    try {
      // 1. Try lookup in invitation_tokens table (by tokenHash or rawToken)
      let tokenRecord = await model.findFirst({
        where: {
          OR: [
            { tokenHash },
            { tokenHash: rawToken },
          ],
        },
        include: {
          user: {
            include: { companyRef: true },
          },
        },
      });

      if (tokenRecord) {
        console.log(`[validateToken] Found tokenRecord: id=${tokenRecord.id}, status=${tokenRecord.status}, expiresAt=${tokenRecord.expiresAt}, purpose=${tokenRecord.purpose}`);
        if (tokenRecord.purpose !== expectedPurpose) {
          console.log(`[validateToken] Mismatch purpose: expected ${expectedPurpose}, got ${tokenRecord.purpose}`);
          return { valid: false, reason: "Invalid token purpose", code: "INVALID" as TokenInvalidCode, record: null, user: null };
        }

        if (tokenRecord.status === "USED") {
          console.log(`[validateToken] Status is USED`);
          return { valid: false, reason: "This token has already been used", code: "USED" as TokenInvalidCode, record: null, user: null };
        }

        if (tokenRecord.status === "REVOKED") {
          console.log(`[validateToken] Status is REVOKED`);
          return { valid: false, reason: "This invitation link has been revoked", code: "REVOKED" as TokenInvalidCode, record: null, user: null };
        }

        if (tokenRecord.expiresAt < new Date()) {
          console.log(`[validateToken] Token is EXPIRED: expiresAt ${tokenRecord.expiresAt} < now ${new Date()}`);
          // Mark as expired in DB
          try {
            await model.update({
              where: { id: tokenRecord.id },
              data: { status: "EXPIRED" },
            });
          } catch (_) {}
          return { valid: false, reason: "This link has expired (24-hour limit)", code: "EXPIRED" as TokenInvalidCode, record: null, user: null };
        }

        if (tokenRecord.status !== "PENDING") {
          console.log(`[validateToken] Status is not PENDING: ${tokenRecord.status}`);
          return { valid: false, reason: "This token is no longer valid", code: "INVALID" as TokenInvalidCode, record: null, user: null };
        }

        return { valid: true, reason: null, code: null, record: tokenRecord, user: tokenRecord.user };
      } else {
        console.log(`[validateToken] No tokenRecord found for rawToken or tokenHash`);
      }
    } catch (err) {
      console.warn("[validateToken] Warning/skipped:", err);
    }
  }

  // 2. Legacy fallback check for PasswordResetToken table if purpose is PASSWORD_RESET
  const resetModel = getPasswordResetTokenModel();
  if (expectedPurpose === "PASSWORD_RESET" && resetModel) {
    try {
      const legacyReset = await resetModel.findUnique({
        where: { token: rawToken },
      });
      if (legacyReset) {
        if (legacyReset.expiresAt < new Date()) {
          try { await resetModel.delete({ where: { id: legacyReset.id } }); } catch (_) {}
          return { valid: false, reason: "Password reset link has expired", code: "EXPIRED" as TokenInvalidCode, record: null, user: null };
        }
        const user = await prisma.user.findUnique({
          where: { email: legacyReset.email },
          include: { companyRef: true },
        });
        if (user) {
          return { valid: true, reason: null, code: null, record: null, legacyReset, user };
        }
      }
    } catch (_) {}
  }

  return { valid: false, reason: "This link has expired or is no longer valid.", code: "INVALID" as TokenInvalidCode, record: null, user: null };
}
