import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, getTenantWhereClauseAsync, getUserTenantWhereClauseAsync } from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const stage = searchParams.get("stage");
    const serviceType = searchParams.get("serviceType");

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const where: any = { ...tenantFilter };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { lead: { firstName: { contains: search, mode: "insensitive" } } },
        { lead: { lastName: { contains: search, mode: "insensitive" } } },
        { lead: { company: { contains: search, mode: "insensitive" } } },
      ];
      
      if (tenantFilter.OR) {
        where.AND = [
          { OR: tenantFilter.OR },
          { OR: where.OR }
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
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            phone: true,
            status: true,
          },
        },
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
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
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

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
      // Only allow assigning a deal to someone within the caller's own tenant.
      const userTenantFilter = await getUserTenantWhereClauseAsync(payload);
      const targetUser = await prisma.user.findFirst({ where: { id: assignedUserId, ...userTenantFilter } });
      if (!targetUser) {
        return NextResponse.json({ error: "Cannot assign deal to a user outside your organization" }, { status: 403 });
      }
    }

    if (leadId) {
      // Only allow linking to a lead within the caller's own tenant.
      const tenantFilter = await getTenantWhereClauseAsync(payload);
      const lead = await prisma.lead.findFirst({ where: { id: leadId, ...tenantFilter }, select: { id: true } });
      if (!lead) {
        return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
      }
    }

    const numValue = value ? parseFloat(value) : 0;
    const numProbability = probability ? parseInt(probability, 10) : 0;
    const weightedValue = (numValue * numProbability) / 100;

    const newDeal = await prisma.deal.create({
      data: {
        name,
        description: description || null,
        stage: stage || "NEW_OPPORTUNITY",
        value: numValue,
        probability: numProbability,
        weightedValue,
        serviceType: serviceType || null,
        dealSource: dealSource || null,
        expectedCloseDate: expectedCloseDate
          ? new Date(expectedCloseDate)
          : null,
        leadId: leadId || null,
        userId: assignedUserId,
        notes: notes || null,
      },
      include: {
        lead: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Audit log
    await logAuditEvent({
      action:    "DEAL_CREATED",
      category:  "Sales CRM",
      severity:  "SUCCESS",
      actorName:  payload.name || payload.email,
      actorEmail: payload.email,
      actorRole:  payload.role,
      targetName: name,
      summary:   `Created new deal: "${name}" at stage ${stage || "NEW_OPPORTUNITY"}${serviceType ? ` (${serviceType})` : ""}`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(newDeal, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/deals error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create deal" },
      { status: 500 }
    );
  }
}
