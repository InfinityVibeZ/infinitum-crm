import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractTokenFromRequest,
  getTokenPayload,
  requireRole,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // ---------------------------------------------------------
    // Authentication
    // ---------------------------------------------------------
    const token = extractTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const payload = getTokenPayload(token);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // Platform usage is SUPER_ADMIN only
    // ---------------------------------------------------------
    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);

    if (roleError) {
      return roleError;
    }

    // ---------------------------------------------------------
    // Fetch usage counters
    //
    // IMPORTANT:
    // The generated Prisma client currently exposes featureId
    // but does not expose UsageCounter.feature as a relation.
    // Therefore we resolve Feature records separately.
    // ---------------------------------------------------------
    const usageCounters = await prisma.usageCounter.findMany({
      orderBy: {
        periodEnd: "desc",
      },
    });

    // ---------------------------------------------------------
    // Resolve feature IDs in one query
    // Avoid N+1 queries.
    // ---------------------------------------------------------
    const featureIds = [
      ...new Set(
        usageCounters
          .map((usage) => usage.featureId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const features =
      featureIds.length > 0
        ? await prisma.feature.findMany({
            where: {
              id: {
                in: featureIds,
              },
            },
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              isMetered: true,
              isVisible: true,
            },
          })
        : [];

    const featureMap = new Map(
      features.map((feature) => [feature.id, feature])
    );

    // ---------------------------------------------------------
    // Serialize BigInt values safely
    // ---------------------------------------------------------
    const data = usageCounters.map((usage) => {
      const feature = featureMap.get(usage.featureId);

      return {
        id: usage.id,
        companyId: usage.companyId,
        subscriptionId: usage.subscriptionId,
        featureId: usage.featureId,

        feature: feature
          ? {
              id: feature.id,
              code: feature.code,
              name: feature.name,
              status: feature.status,
              isMetered: feature.isMetered,
              isVisible: feature.isVisible,
            }
          : null,

        featureCode: feature?.code ?? usage.featureId,
        featureName: feature?.name ?? "Unknown Feature",

        usageValue: Number(usage.usageValue),
        limitValue:
          usage.limitValue === null
            ? null
            : Number(usage.limitValue),

        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,

        version: Number(usage.version),

        createdAt: usage.createdAt,
        updatedAt: usage.updatedAt,
      };
    });

    // ---------------------------------------------------------
    // Response
    // ---------------------------------------------------------
    const response = NextResponse.json({
      usage: data,
      total: data.length,
    });

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("GET /api/admin/usage error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch usage data",
      },
      {
        status: 500,
      }
    );
  }
}