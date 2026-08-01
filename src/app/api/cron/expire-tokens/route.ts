import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getInvitationTokenModel() {
  const p = prisma as any;
  return p.invitationToken || p.InvitationToken || null;
}

/**
 * GET /api/cron/expire-tokens
 *
 * Scheduled cron endpoint that:
 * 1. Marks PENDING invitation tokens as EXPIRED when their 24-hour lifetime has passed.
 * 2. Sets the corresponding User's status to "EXPIRED" if they are still PENDING
 *    (i.e., never completed account setup within 24 hours).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must never mean "no auth required."
  if (process.env.NODE_ENV === "production" && !secret) {
    console.error("[CRON] expire-tokens: CRON_SECRET is not configured in production");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const model = getInvitationTokenModel();

    if (!model) {
      return NextResponse.json({
        message: "No invitation token table active.",
        expiredCount: 0,
        usersMarked: 0,
      });
    }

    // 1. Find all PENDING ACCOUNT_SETUP tokens past 24h
    const expiredTokens = await model.findMany({
      where: {
        purpose: "ACCOUNT_SETUP",
        status: "PENDING",
        expiresAt: { lt: now },
      },
      select: { id: true, userId: true },
    });

    if (!expiredTokens || expiredTokens.length === 0) {
      return NextResponse.json({
        message: "No tokens to expire.",
        expiredCount: 0,
        usersMarked: 0,
      });
    }

    const tokenIds = expiredTokens.map((t: any) => t.id);
    const userIds = Array.from(new Set(expiredTokens.map((t: any) => t.userId).filter(Boolean))) as string[];

    // 2. Mark those tokens as EXPIRED
    const { count: expiredCount } = await model.updateMany({
      where: { id: { in: tokenIds } },
      data: { status: "EXPIRED" },
    });

    // 3. Mark corresponding Users as EXPIRED (if still PENDING)
    let usersMarked = 0;
    if (userIds.length > 0) {
      const result = await prisma.user.updateMany({
        where: {
          id: { in: userIds },
          status: "PENDING" as any,
        },
        data: { status: "EXPIRED" as any },
      });
      usersMarked = result.count;
    }

    console.log(
      `[CRON] expire-tokens: ${expiredCount} tokens expired, ${usersMarked} users marked EXPIRED at ${now.toISOString()}`
    );

    return NextResponse.json({
      message: `Expired ${expiredCount} invitation tokens and marked ${usersMarked} users as EXPIRED.`,
      expiredCount,
      usersMarked,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] expire-tokens error:", error);
    return NextResponse.json(
      { error: "Failed to expire tokens", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
