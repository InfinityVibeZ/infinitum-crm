import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, getTenantWhereClause } from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = getTenantWhereClause(payload);

    const deal = await prisma.deal.findFirst({
      where: { id: params.id, ...tenantFilter },
      include: {
        lead: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        activities: true,
        finances: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
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
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

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
      where: { id: params.id, ...tenantFilter },
    });

    if (!currentDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const newValue = value !== undefined ? parseFloat(value || "0") : Number(currentDeal.value);
    const newProb = probability !== undefined ? parseInt(probability || "0", 10) : currentDeal.probability;
    const weightedValue = (newValue * newProb) / 100;

    const updatedDeal = await prisma.deal.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(stage !== undefined && { stage }),
        ...(value !== undefined && { value: newValue }),
        ...(probability !== undefined && { probability: newProb }),
        weightedValue,
        ...(serviceType !== undefined && { serviceType }),
        ...(dealSource !== undefined && { dealSource }),
        ...(expectedCloseDate !== undefined && {
          expectedCloseDate: expectedCloseDate
            ? new Date(expectedCloseDate)
            : null,
        }),
        ...(leadId !== undefined && { leadId: leadId || null }),
        ...(userId !== undefined && { userId }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        lead: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Audit log — track stage changes prominently
    const stageChanged = stage !== undefined && currentDeal.stage !== stage
      ? ` Stage: ${currentDeal.stage} → ${stage}.` : "";
    await logAuditEvent({
      action:    "DEAL_UPDATED",
      category:  "Sales CRM",
      severity:  stageChanged ? "SUCCESS" : "INFO",
      actorName:  payload.name || payload.email,
      actorEmail: payload.email,
      actorRole:  payload.role,
      targetName: updatedDeal.name,
      summary:   `Updated deal: "${updatedDeal.name}".${stageChanged}`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(updatedDeal);
  } catch (error: any) {
    console.error("PUT /api/deals/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update deal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = getTenantWhereClause(payload);

    const existingDeal = await prisma.deal.findFirst({
      where: { id: params.id, ...tenantFilter },
    });
    
    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found or unauthorized" }, { status: 404 });
    }

    await prisma.deal.delete({
      where: { id: params.id },
    });

    // Audit log
    await logAuditEvent({
      action:    "DEAL_DELETED",
      category:  "Sales CRM",
      severity:  "DANGER",
      actorName:  payload.name || payload.email,
      actorEmail: payload.email,
      actorRole:  payload.role,
      targetName: existingDeal.name,
      summary:   `Permanently deleted deal: "${existingDeal.name}" (was at stage ${existingDeal.stage})`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/deals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 }
    );
  }
}
