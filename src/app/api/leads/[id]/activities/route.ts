import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, getTenantWhereClauseAsync } from "@/lib/auth";
import { ActivityType, LeadStatus } from "@prisma/client";
import { recordLeadStatusTransition } from "@/lib/leads";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const lead = await prisma.lead.findFirst({
      where: { id: params.id, ...tenantFilter },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        status: true,
        revenueGenerated: true,
        createdAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const [activities, statusHistory, payments] = await Promise.all([
      prisma.activity.findMany({
        where: { leadId: params.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leadStatusHistory.findMany({
        where: { leadId: params.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { changedAt: "desc" },
      }),
      prisma.leadPayment.findMany({
        where: { leadId: params.id, status: "PAID" },
        orderBy: { paymentDate: "desc" },
      }),
    ]);

    return NextResponse.json({
      lead,
      activities,
      statusHistory,
      payments,
    });
  } catch (error) {
    console.error("GET activities error:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const lead = await prisma.lead.findFirst({ where: { id: params.id, ...tenantFilter }, select: { id: true } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const {
      type,
      visitDate,
      outcome,
      followUpDate,
      nextFollowUpTime,
      nextFollowUpType,
      reminder,
      summary,
      related,
      customType,
      newStatus, // e.g. "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "NO_CHANGE"
    } = body;

    if (!type) {
      return NextResponse.json({ error: "Activity type is required" }, { status: 400 });
    }

    let schemaType: ActivityType = ActivityType.NOTE;
    const typeUpper = type.toUpperCase();
    if (typeUpper === "CALL") schemaType = ActivityType.CALL;
    else if (typeUpper === "MEETING") schemaType = ActivityType.MEETING;
    else if (typeUpper === "SITE VISIT" || typeUpper === "SITE_VISIT") schemaType = ActivityType.TASK;
    else if (typeUpper === "EMAIL") schemaType = ActivityType.EMAIL;

    const descriptionJson = JSON.stringify({
      visitDate,
      outcome,
      followUpDate,
      nextFollowUpTime,
      nextFollowUpType,
      reminder,
      summary,
      related,
      customType,
      newStatus: newStatus || "NO_CHANGE",
    });

    const actDate = visitDate ? new Date(visitDate) : new Date();
    const fupDate = followUpDate ? new Date(followUpDate) : null;

    const newActivity = await prisma.activity.create({
      data: {
        type: schemaType,
        description: descriptionJson,
        outcome: outcome || null,
        activityDate: actDate,
        nextFollowUpDate: fupDate,
        nextFollowUpTime: nextFollowUpTime || null,
        nextFollowUpType: nextFollowUpType || null,
        reminder: reminder || null,
        leadId: params.id,
        userId: payload.userId,
      },
    });

    // Update Lead lastActivity
    await prisma.lead.update({
      where: { id: params.id },
      data: { lastActivity: actDate },
    });

    // Check if salesperson explicitly requested a status transition
    if (newStatus && newStatus !== "NO_CHANGE") {
      const validStatuses: LeadStatus[] = [
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
        "HOLD",
      ];
      if (validStatuses.includes(newStatus as LeadStatus)) {
        await recordLeadStatusTransition({
          leadId: params.id,
          toStatus: newStatus as LeadStatus,
          userId: payload.userId,
          activityId: newActivity.id,
          reason: `Activity (${type}): ${outcome || summary || "Status Updated"}`,
        });
      }
    }

    return NextResponse.json(newActivity);
  } catch (error) {
    console.error("POST activity error:", error);
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const lead = await prisma.lead.findFirst({ where: { id: params.id, ...tenantFilter }, select: { id: true } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const {
      activityId,
      type,
      visitDate,
      outcome,
      followUpDate,
      nextFollowUpTime,
      nextFollowUpType,
      reminder,
      summary,
      related,
      customType,
      newStatus,
    } = body;

    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    // Ensure the activity being edited actually belongs to this (tenant-verified) lead
    const existingActivity = await prisma.activity.findFirst({
      where: { id: activityId, leadId: params.id },
      select: { id: true },
    });
    if (!existingActivity) {
      return NextResponse.json({ error: "Activity not found or unauthorized" }, { status: 404 });
    }

    let schemaType: ActivityType = ActivityType.NOTE;
    const typeUpper = type.toUpperCase();
    if (typeUpper === "CALL") schemaType = ActivityType.CALL;
    else if (typeUpper === "MEETING") schemaType = ActivityType.MEETING;
    else if (typeUpper === "SITE VISIT" || typeUpper === "SITE_VISIT") schemaType = ActivityType.TASK;
    else if (typeUpper === "EMAIL") schemaType = ActivityType.EMAIL;

    const descriptionJson = JSON.stringify({
      visitDate,
      outcome,
      followUpDate,
      nextFollowUpTime,
      nextFollowUpType,
      reminder,
      summary,
      related,
      customType,
      newStatus: newStatus || "NO_CHANGE",
    });

    const actDate = visitDate ? new Date(visitDate) : new Date();
    const fupDate = followUpDate ? new Date(followUpDate) : null;

    const updatedActivity = await prisma.activity.update({
      where: { id: activityId },
      data: {
        type: schemaType,
        description: descriptionJson,
        outcome: outcome || null,
        activityDate: actDate,
        nextFollowUpDate: fupDate,
        nextFollowUpTime: nextFollowUpTime || null,
        nextFollowUpType: nextFollowUpType || null,
        reminder: reminder || null,
      },
    });

    if (newStatus && newStatus !== "NO_CHANGE") {
      const validStatuses: LeadStatus[] = [
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
        "HOLD",
      ];
      if (validStatuses.includes(newStatus as LeadStatus)) {
        await recordLeadStatusTransition({
          leadId: params.id,
          toStatus: newStatus as LeadStatus,
          userId: payload.userId,
          activityId: updatedActivity.id,
          reason: `Activity Edit (${type}): ${outcome || summary || "Status Updated"}`,
        });
      }
    }

    return NextResponse.json(updatedActivity);
  } catch (error) {
    console.error("PUT activity error:", error);
    return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const lead = await prisma.lead.findFirst({ where: { id: params.id, ...tenantFilter }, select: { id: true } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get("activityId");

    if (!activityId) {
      return NextResponse.json({ error: "Activity ID is required" }, { status: 400 });
    }

    const existingActivity = await prisma.activity.findFirst({
      where: { id: activityId, leadId: params.id },
      select: { id: true },
    });
    if (!existingActivity) {
      return NextResponse.json({ error: "Activity not found or unauthorized" }, { status: 404 });
    }

    await prisma.activity.delete({
      where: { id: activityId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE activity error:", error);
    return NextResponse.json({ error: "Failed to delete activity" }, { status: 500 });
  }
}
