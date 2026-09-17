import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Helper to safely resolve the InvitationToken Prisma model accessor.
 *
 * This is retained for compatibility with the existing invitation
 * implementation.
 */
function getInvitationTokenModel() {
  const p = prisma as any;

  if (
    p.invitationToken ||
    p.InvitationToken
  ) {
    return (
      p.invitationToken ||
      p.InvitationToken
    );
  }

  try {
    const {
      PrismaClient,
    } = require("@prisma/client");

    const fresh =
      new PrismaClient();

    return (
      (fresh as any)
        .invitationToken ||
      (fresh as any)
        .InvitationToken ||
      null
    );
  } catch (_) {
    return null;
  }
}

/**
 * Helper to safely resolve PasswordResetToken.
 */
function getPasswordResetTokenModel() {
  const p = prisma as any;

  return (
    p.passwordResetToken ||
    p.PasswordResetToken ||
    null
  );
}

/**
 * Generate a cryptographically secure
 * 64-character random token.
 *
 * 32 bytes = 64 hexadecimal characters.
 */
export function generateRawToken(): string {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

/**
 * SHA-256 hash a raw token before database storage.
 */
export function hashToken(
  rawToken: string
): string {
  return crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
}

/**
 * Issue a new ACCOUNT_SETUP invitation token.
 *
 * Expiration: 24 hours.
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
  /*
   * Keep these arguments for compatibility with
   * existing callers.
   */
  void role;
  void createdBy;

  const rawToken =
    generateRawToken();

  const tokenHash =
    hashToken(rawToken);

  const expiresAt =
    new Date(
      Date.now() +
        24 * 60 * 60 * 1000
    );

  const model =
    getInvitationTokenModel();

  if (model) {
    try {
      /*
       * Remove previous invitation/setup
       * records for this user.
       */
      await model.deleteMany({
        where: {
          userId,
        },
      });
    } catch (e) {
      console.warn(
        "[createAccountSetupToken] Delete warning:",
        e
      );
    }

    try {
      const user =
        await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            email: true,
          },
        });

      if (!user) {
        throw new Error(
          "User not found"
        );
      }

      const tokenRecord =
        await model.create({
          data: {
            tokenHash,
            email: user.email,
            userId,
            companyId:
              companyId ||
              undefined,
            expiresAt,
          },
        });

      return {
        rawToken,
        tokenRecord,
      };
    } catch (e) {
      console.error(
        "[createAccountSetupToken] Create error:",
        e
      );

      throw e;
    }
  }

  return {
    rawToken,
    tokenRecord: null,
  };
}

/**
 * Issue a new PASSWORD_RESET token.
 *
 * Existing reset tokens for the user are removed.
 *
 * Expiration: 30 minutes.
 */
export async function createPasswordResetToken({
  userId,
}: {
  userId: string;
}) {
  const rawToken =
    generateRawToken();

  const tokenHash =
    hashToken(rawToken);

  const expiresAt =
    new Date(
      Date.now() +
        30 * 60 * 1000
    );

  /*
   * Delete previous reset tokens.
   */
  try {
    await prisma.passwordResetToken.deleteMany(
      {
        where: {
          user_id: userId,
        },
      }
    );
  } catch (e) {
    console.warn(
      "[createPasswordResetToken] Delete warning:",
      e
    );
  }

  /*
   * Create the new reset token.
   */
  try {
    const tokenRecord =
      await prisma.passwordResetToken.create(
        {
          data: {
            token_hash:
              tokenHash,
            user_id:
              userId,
            expiresAt,
          },
        }
      );

    return {
      rawToken,
      tokenRecord,
    };
  } catch (e) {
    console.error(
      "[createPasswordResetToken] Create error:",
      e
    );

    throw e;
  }
}

/**
 * Token validation codes.
 */
export type TokenInvalidCode =
  | "USED"
  | "REVOKED"
  | "EXPIRED"
  | "INVALID";

/**
 * Validate a raw token.
 *
 * Supported purposes:
 *
 * ACCOUNT_SETUP
 * PASSWORD_RESET
 */
export async function validateToken(
  rawToken: string,
  expectedPurpose:
    | "ACCOUNT_SETUP"
    | "PASSWORD_RESET"
) {
  if (
    !rawToken ||
    typeof rawToken !==
      "string"
  ) {
    return {
      valid: false,
      reason:
        "Token is required",
      code:
        "INVALID" as TokenInvalidCode,
      record: null,
      user: null,
    };
  }

  const tokenHash =
    hashToken(rawToken);

  /*
   * PASSWORD RESET
   */
  if (
    expectedPurpose ===
    "PASSWORD_RESET"
  ) {
    try {
      const resetRecord =
        await prisma.passwordResetToken.findFirst(
          {
            where: {
              token_hash:
                tokenHash,
            },
          }
        );

      if (!resetRecord) {
        return {
          valid: false,
          reason:
            "This password reset link is invalid.",
          code:
            "INVALID" as TokenInvalidCode,
          record: null,
          user: null,
        };
      }

      if (
        resetRecord.used_at
      ) {
        return {
          valid: false,
          reason:
            "This password reset link has already been used.",
          code:
            "USED" as TokenInvalidCode,
          record: null,
          user: null,
        };
      }

      if (
        resetRecord.expiresAt <
        new Date()
      ) {
        return {
          valid: false,
          reason:
            "This password reset link has expired (30-minute limit).",
          code:
            "EXPIRED" as TokenInvalidCode,
          record: null,
          user: null,
        };
      }

      if (
        !resetRecord.user_id
      ) {
        return {
          valid: false,
          reason:
            "Invalid reset token association.",
          code:
            "INVALID" as TokenInvalidCode,
          record: null,
          user: null,
        };
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id:
              resetRecord.user_id,
          },
          include: {
            companyRef: true,
          },
        });

      if (!user) {
        return {
          valid: false,
          reason:
            "The user associated with this token no longer exists.",
          code:
            "INVALID" as TokenInvalidCode,
          record: null,
          user: null,
        };
      }

      return {
        valid: true,
        reason: null,
        code: null,
        record: resetRecord,
        user,
      };
    } catch (err) {
      console.warn(
        "[validateToken PASSWORD_RESET] Error:",
        err
      );

      return {
        valid: false,
        reason:
          "Internal server error during validation.",
        code:
          "INVALID" as TokenInvalidCode,
        record: null,
        user: null,
      };
    }
  }

  /*
   * ACCOUNT SETUP
   */
  const model =
    getInvitationTokenModel();

  if (
    model &&
    expectedPurpose ===
      "ACCOUNT_SETUP"
  ) {
    try {
      /*
       * Lookup by hashed token.
       *
       * The raw-token fallback is retained because
       * older invitation records may have stored the
       * token differently.
       */
      const tokenRecord =
        await model.findFirst({
          where: {
            OR: [
              {
                tokenHash,
              },
              {
                tokenHash:
                  rawToken,
              },
            ],
          },
        });

      if (tokenRecord) {
        /*
         * InvitationToken does not have an explicit
         * Prisma user relation in the current implementation.
         */
        const user =
          tokenRecord.userId
            ? await prisma.user.findUnique(
                {
                  where: {
                    id:
                      tokenRecord.userId,
                  },
                  include: {
                    companyRef: true,
                  },
                }
              )
            : null;

        if (
          tokenRecord.usedAt
        ) {
          return {
            valid: false,
            reason:
              "This invitation link has already been used",
            code:
              "USED" as TokenInvalidCode,
            record: null,
            user: null,
          };
        }

        if (
          tokenRecord.expiresAt <
          new Date()
        ) {
          return {
            valid: false,
            reason:
              "This link has expired (24-hour limit)",
            code:
              "EXPIRED" as TokenInvalidCode,
            record: null,
            user: null,
          };
        }

        return {
          valid: true,
          reason: null,
          code: null,
          record: tokenRecord,
          user,
        };
      }
    } catch (err) {
      console.warn(
        "[validateToken] Warning/skipped:",
        err
      );
    }
  }

  return {
    valid: false,
    reason:
      "This link has expired or is no longer valid.",
    code:
      "INVALID" as TokenInvalidCode,
    record: null,
    user: null,
  };
}