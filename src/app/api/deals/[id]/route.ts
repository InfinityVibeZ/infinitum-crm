import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantWhereClause,
  requireAuthenticatedUser,
} from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;

    const { payload } = auth;
    const tenantFilter = getTenantWhereClause(payload);

    const deal = await prisma.deal.findFirst({
      where: {
        id: resolvedParams.id,
        ...tenantFilter,
      },
      include: {
        lead: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        activities: true,
        finances: true,
      },
    });

    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(deal);
  } catch (error) {
    console.error("GET /api/deals/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to fetch deal" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;

    const { payload } = auth;
    const tenantFilter = getTenantWhereClause(payload);

    const body = await request.json();

    const {
      name,
      description,
      stage,
      value,
      probability,
      serviceType,
      dealSource,
      expectedCloseDate,
      leadId,
      userId,
      notes,
    } = body;

    const currentDeal = await prisma.deal.findFirst({
      where: {
        id: resolvedParams.id,
        ...tenantFilter,
      },
    });

    if (!currentDeal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    const newValue =
      value !== undefined
        ? parseFloat(value || "0")
        : Number(currentDeal.value);

    const newProb =
      probability !== undefined
        ? parseInt(probability || "0", 10)
        : (currentDeal.probability ?? 0);

    // Deal model does not have a weightedValue column.
    // Calculate it only when needed for derived/response data.
    const weightedValue = (newValue * newProb) / 100;

    const updatedDeal = await prisma.deal.update({
      where: {
        id: resolvedParams.id,
      },
      data: {
        ...(name !== undefined && { name }),

        // Deal.description does not exist in Prisma.
        // Preserve incoming description by storing it in notes
        // only when notes was not explicitly supplied.
        ...(description !== undefined &&
          notes === undefined && {
            notes: description,
          }),

        ...(stage !== undefined && { stage }),

        ...(value !== undefined && {
          value: newValue,
        }),

        ...(probability !== undefined && {
          probability: newProb,
        }),

        // No weightedValue here — it is not a DB column.

        ...(serviceType !== undefined && {
          serviceType,
        }),

        ...(dealSource !== undefined && {
          dealSource,
        }),

        ...(expectedCloseDate !== undefined && {
          expectedCloseDate: expectedCloseDate
            ? new Date(expectedCloseDate)
            : null,
        }),

        ...(leadId !== undefined && {
          leadId: leadId || null,
        }),

        ...(userId !== undefined && {
          userId,
        }),

        ...(notes !== undefined && {
          notes,
        }),
      },
      include: {
        lead: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const stageChanged =
      stage !== undefined && currentDeal.stage !== stage
        ? ` Stage: ${currentDeal.stage} → ${stage}.`
        : "";

    await logAuditEvent({
      action: "DEAL_UPDATED",
      category: "Sales CRM",
      severity: stageChanged ? "SUCCESS" : "INFO",
      actorName: payload.name || payload.email,
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: updatedDeal.name,
      summary: `Updated deal: "${updatedDeal.name}".${stageChanged}`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json({
      ...updatedDeal,

      // Derived value; not persisted because Deal has no
      // weightedValue database column.
      weightedValue,
    });
  } catch (error: any) {
    console.error("PUT /api/deals/[id] error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Failed to update deal",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;

    const { payload } = auth;
    const tenantFilter = getTenantWhereClause(payload);

    const existingDeal = await prisma.deal.findFirst({
      where: {
        id: resolvedParams.id,
        ...tenantFilter,
      },
    });

    if (!existingDeal) {
      return NextResponse.json(
        { error: "Deal not found or unauthorized" },
        { status: 404 }
      );
    }

    await prisma.deal.delete({
      where: {
        id: resolvedParams.id,
      },
    });

    await logAuditEvent({
      action: "DEAL_DELETED",
      category: "Sales CRM",
      severity: "DANGER",
      actorName: payload.name || payload.email,
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: existingDeal.name,
      summary: `Permanently deleted deal: "${existingDeal.name}" (was at stage ${existingDeal.stage})`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/deals/[id] error:", error);

    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 }
    );
  }
}