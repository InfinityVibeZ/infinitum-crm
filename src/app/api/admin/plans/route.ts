import { NextResponse } from "next/server";
import { PlanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuthenticatedUser,
  requireRole,
} from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);

    if (roleError) {
      return roleError;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: {
      status?: PlanStatus;
    } = {};

    if (status && status !== "ALL") {
      if (Object.values(PlanStatus).includes(status as PlanStatus)) {
        where.status = status as PlanStatus;
      }
    }

    const plans = await prisma.plan.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("GET /api/admin/plans error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch plans",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const roleError = requireRole(payload.role, ["SUPER_ADMIN"]);

    if (roleError) {
      return roleError;
    }

    const body = await request.json();

    console.log(
      "POST /api/admin/plans body:",
      JSON.stringify(body, null, 2)
    );

    const {
      code,
      name,
      description,
      status,
      isPublic,
      isDefault,
      prices,
      features,
    } = body;

    const trimmedCode = (code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    const trimmedName = (name || "").trim();

    if (!trimmedCode || !trimmedName) {
      return NextResponse.json(
        {
          error: "Code and name are required",
        },
        {
          status: 400,
        }
      );
    }

    const existingPlan = await prisma.plan.findUnique({
      where: {
        code: trimmedCode,
      },
    });

    if (existingPlan) {
      return NextResponse.json(
        {
          error: "A plan with this code already exists",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Return the created plan from the transaction instead of
     * assigning to an outer `let plan` variable.
     *
     * This allows TypeScript to infer the exact Prisma Plan type.
     */
    const plan = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.plan.updateMany({
          data: {
            isDefault: false,
          },
        });
      }

      // -------------------------------------------------------
      // Create plan
      // -------------------------------------------------------
      const createdPlan = await tx.plan.create({
        data: {
          code: trimmedCode,
          name: trimmedName,
          description,
          status: status || "ACTIVE",
          planType: "STANDARD",
          basePrice: 0,
          billingInterval: "MONTH",
          currency: "INR",
          isPublic: isPublic !== undefined ? isPublic : true,
          isDefault: isDefault || false,
        },
      });

      // -------------------------------------------------------
      // Create pricing rows
      // -------------------------------------------------------
      if (Array.isArray(prices) && prices.length > 0) {
        const priceCreates = prices.map((p: any) =>
          tx.planPrice.create({
            data: {
              planId: createdPlan.id,
              code: `${trimmedCode}_${p.billingInterval}_v1`,
              billingInterval: p.billingInterval,
              currency: p.currency,
              amount: p.amount,
              originalAmount:
                p.originalAmount ?? undefined,
              trailingDays: p.trailingDays || 0,
              isActive: p.isActive ?? true,
              isDefault: p.isDefault ?? false,
              version: 1,
            },
          })
        );

        await Promise.all(priceCreates);
      }

      // -------------------------------------------------------
      // Create feature rows
      // -------------------------------------------------------
      if (Array.isArray(features) && features.length > 0) {
        const featureCreates = features.map((f: any) =>
          tx.planFeature.create({
            data: {
              planId: createdPlan.id,
              featureId: f.featureId,
              enabled: f.enabled,
              limitType: f.limitType ?? undefined,
              limitValue: f.limitValue ?? undefined,
              configuration:
                f.configuration ?? undefined,
            },
          })
        );

        await Promise.all(featureCreates);
      }

      return createdPlan;
    });

    // ---------------------------------------------------------
    // Audit
    // ---------------------------------------------------------
    await logAuditEvent({
      action: "PLAN_CREATED",
      category: "Platform Management",
      severity: "SUCCESS",
      actorName: payload.name || payload.email,
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: plan.name,
      summary: `Created platform plan: ${plan.code}`,
    });

    return NextResponse.json(
      {
        success: true,
        plan,
      },
      {
        status: 201,
      }
    );
  } catch (error: unknown) {
    console.error("POST /api/admin/plans error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create plan";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}