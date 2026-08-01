import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { extractTokenFromRequest, getTokenPayload, getTenantWhereClause } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "ALL";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let dateFilter: any = undefined;
    const now = new Date();

    if (range === "TODAY") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: todayStart };
    } else if (range === "YESTERDAY") {
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      dateFilter = { gte: yesterdayStart, lte: yesterdayEnd };
    } else if (range === "LAST_WEEK") {
      const lastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: lastWeekStart };
    } else if (range === "LAST_MONTH") {
      const lastMonthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: lastMonthStart };
    } else if (range === "LAST_2_MONTHS") {
      const last2MonthsStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: last2MonthsStart };
    } else if (range === "LAST_6_MONTHS") {
      const last6MonthsStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: last6MonthsStart };
    } else if (range === "LAST_1_YEAR") {
      const last1YearStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: last1YearStart };
    } else if (range === "CUSTOM") {
      dateFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999`);
    }

    const userFilter = getTenantWhereClause(payload);

    // Combine date filter and tenant filter
    const leadWhere = dateFilter ? { createdAt: dateFilter, ...userFilter } : userFilter;
    const dealWhere = dateFilter ? { createdAt: dateFilter, ...userFilter } : userFilter;

    // Note: Activity model also has userId, so we apply the same filter
    const activityWhere = dateFilter ? { createdAt: dateFilter, ...userFilter } : userFilter;

    // Fetch leads, deals, and recent activities in parallel — none of these
    // queries depend on each other's results.
    const [leads, deals, recentActivities] = await Promise.all([
      // Includes status so total/active lead counts can be derived below
      // instead of running two separate COUNT queries over the same rows.
      prisma.lead.findMany({
        where: leadWhere,
        select: { revenueGenerated: true, cashCollected: true, score: true, status: true },
      }),
      prisma.deal.findMany({
        where: dealWhere,
        select: { id: true, stage: true, value: true, createdAt: true },
      }),
      prisma.activity.findMany({
        where: activityWhere,
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          lead: { select: { firstName: true, lastName: true } },
          deal: { select: { name: true } },
        },
      }),
    ]);

    const totalLeadsCount = leads.length;
    const activeLeadsCount = leads.filter((l) => l.status !== "LOST").length;

    const totalRevenueGenerated = leads.reduce(
      (sum, l) => sum + parseFloat(l.revenueGenerated?.toString() || "0"),
      0
    );

    const totalCashCollected = leads.reduce(
      (sum, l) => sum + parseFloat(l.cashCollected?.toString() || "0"),
      0
    );

    const totalDealsCount = deals.length;
    const activeDeals = deals.filter(
      (d) => d.stage !== "CLOSED_LOST" && d.stage !== "CLOSED_WON" && d.stage !== "CONTRACT_SIGNED"
    );

    const pipelineValue = activeDeals.reduce(
      (sum, d) => sum + parseFloat(d.value?.toString() || "0"),
      0
    );

    const wonDealsCount = deals.filter(
      (d) => d.stage === "CLOSED_WON" || d.stage === "CONTRACT_SIGNED" || d.stage === "PROJECT_KICKOFF"
    ).length;

    const winRate =
      totalDealsCount > 0 ? (wonDealsCount / totalDealsCount) * 100 : 0;

    // 4. Monthly Revenue Trend
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const monthStats = months.map((m, idx) => {
      const monthDeals = deals.filter(
        (d) => new Date(d.createdAt).getMonth() === idx
      );
      const val = monthDeals.reduce(
        (sum, d) => sum + parseFloat(d.value?.toString() || "0"),
        0
      );
      return {
        month: m,
        score: val > 0 ? Math.min(100, Math.round(val / 1000) + 50) : (idx + 1) * 15,
      };
    });

    const avgScore =
      leads.length > 0
        ? Math.round(leads.reduce((sum, l) => sum + (l.score || 75), 0) / leads.length)
        : 87;

    return NextResponse.json({
      totalRevenue: totalCashCollected,
      revenueGenerated: totalRevenueGenerated,
      activeLeads: activeLeadsCount,
      pipelineValue: pipelineValue,
      winRate: winRate > 0 ? winRate.toFixed(1) : "0.0",
      monthStats,
      leadQualityScore: avgScore,
      closeRate: winRate > 0 ? Math.round(winRate) : 0,
      recentActivities,
    });
  } catch (error) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
