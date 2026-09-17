import { requireFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantWhereClauseAsync,
  getUserTenantWhereClauseAsync,
  requireAuthenticatedUser,
} from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;

    const { payload } = auth;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const stage = searchParams.get("stage");
    const serviceType = searchParams.get("serviceType");

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const where: any = { ...tenantFilter };

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          notes: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          lead: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          lead: {
            company: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];

      if (tenantFilter.OR) {
        where.AND = [
          { OR: tenantFilter.OR },
          { OR: where.OR },
        ];

        delete where.OR;
        delete where.userId;
      }
    }

    if (stage && stage !== "ALL") {
      where.stage = stage;
    }

    if (serviceType && serviceType !== "ALL") {
      where.serviceType = serviceType;
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            phone: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(deals);
  } catch (error) {
    console.error("GET /api/deals error:", error);

    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (auth instanceof Response) return auth;

    const { payload } = auth;

    const featureError = await requireFeature(
      payload.companyId,
      "CRM_DEALS"
    );

    if (featureError) return featureError;

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

    if (!name) {
      return NextResponse.json(
        { error: "Deal name is required" },
        { status: 400 }
      );
    }

    let assignedUserId = userId;

    if (!assignedUserId) {
      assignedUserId = payload.userId;
    } else if (assignedUserId !== payload.userId) {
      const userTenantFilter =
        await getUserTenantWhereClauseAsync(payload);

      const targetUser = await prisma.user.findFirst({
        where: {
          id: assignedUserId,
          ...userTenantFilter,
        },
      });

      if (!targetUser) {
        return NextResponse.json(
          {
            error:
              "Cannot assign deal to a user outside your organization",
          },
          { status: 403 }
        );
      }
    }

    if (leadId) {
      const tenantFilter =
        await getTenantWhereClauseAsync(payload);

      const lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          ...tenantFilter,
        },
        select: {
          id: true,
        },
      });

      if (!lead) {
        return NextResponse.json(
          {
            error: "Lead not found or unauthorized",
          },
          { status: 404 }
        );
      }
    }

    const numValue = value
      ? parseFloat(value)
      : 0;

    const numProbability = probability
      ? parseInt(probability, 10)
      : 0;

    // Derived value. Deal does not have a weightedValue column.
    const weightedValue =
      (numValue * numProbability) / 100;

    const newDeal = await prisma.deal.create({
      data: {
        name,
        stage: stage || "NEW_OPPORTUNITY",
        value: numValue,
        probability: numProbability,
        leadId: leadId || null,
        userId: assignedUserId,
        notes:
          notes !== undefined
            ? notes || null
            : description || null,
        companyId: payload.companyId as string,
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

    await logAuditEvent({
      action: "DEAL_CREATED",
      category: "Sales CRM",
      severity: "SUCCESS",
      actorName: payload.name || payload.email,
      actorEmail: payload.email,
      actorRole: payload.role,
      targetName: name,
      summary: `Created new deal: "${name}" at stage ${stage || "NEW_OPPORTUNITY"
        }${serviceType ? ` (${serviceType})` : ""}`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(
      {
        ...newDeal,
        weightedValue,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/deals error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Failed to create deal",
      },
      { status: 500 }
    );
  }
}