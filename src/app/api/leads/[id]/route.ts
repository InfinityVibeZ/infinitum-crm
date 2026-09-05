import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, getTenantWhereClauseAsync } from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";
import { LeadSource } from "@prisma/client";

function toPrismaLeadSource(val: any): LeadSource | null {
  if (!val || typeof val !== "string") return null;
  const normalized = val.trim().toUpperCase().replace(/\s+/g, "_");
  
  if (Object.values(LeadSource).includes(normalized as LeadSource)) {
    return normalized as LeadSource;
  }

  if (normalized === "GOOGLE_ADS" || normalized === "FACEBOOK" || normalized === "INSTAGRAM" || normalized === "ADVERTISING") {
    return LeadSource.ADVERTISING;
  }
  if (normalized === "COLD_CALL") {
    return LeadSource.COLD_CALL;
  }
  if (normalized === "COLD_EMAIL") {
    return LeadSource.COLD_EMAIL;
  }

  return LeadSource.OTHER;
}


  const resolvedParams = await params;
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = await getTenantWhereClauseAsync(payload);

    const lead = await prisma.lead.findFirst({
      where: { id: resolvedParams.id, ...tenantFilter },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        deals: true,
        activities: {
          orderBy: { createdAt: "desc" },
        },
        followUps: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("GET /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}


  const resolvedParams = await params;
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const tenantFilter = await getTenantWhereClauseAsync(payload);
    
    // Verify access before updating
    const existingLead = await prisma.lead.findFirst({
      where: { id: resolvedParams.id, ...tenantFilter },
    });
    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      category,
      location,
      interestedProduct,
      linkedinUrl,
      companyWebsite,
      status,
      priority,
      leadSource,
      leadType,
      revenueGenerated,
      cashCollected,
      notes,
      milestones,
      userId,
      followUps,
      probability,
      leadCreatedDate,
      expectedCloseDate,
      isDeleted,
    } = body;

    // Handle follow-ups updates if provided
    if (followUps !== undefined && Array.isArray(followUps)) {
      if (!(await hasFeature(payload.companyId, "FOLLOW_UPS"))) {
        return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "FOLLOW_UPS" }, { status: 403 });
      }
      for (const fu of followUps) {
        const existing = await prisma.followUp.findFirst({
          where: { leadId: resolvedParams.id, number: fu.number },
        });

        if (existing) {
          await prisma.followUp.update({
            where: { id: existing.id },
            data: {
              completed: fu.completed,
              completedAt: fu.completed ? new Date() : null,
              status: fu.completed ? "COMPLETED" : "PENDING",
            },
          });
        } else {
          await prisma.followUp.create({
            data: {
              leadId: resolvedParams.id,
              number: fu.number,
              completed: fu.completed,
              completedAt: fu.completed ? new Date() : null,
              dueDate: new Date(),
              followUpType: "OTHER",
              status: fu.completed ? "COMPLETED" : "PENDING",
              companyId: payload.companyId as string,
            },
          });
        }
      }
    }

    const isStatusChanged = status !== undefined && status !== existingLead.status;

    const updatedLead = await prisma.lead.update({
      where: { id: resolvedParams.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { 
          email: (email && email.trim() !== "") ? email.trim() : null 
        }),
        ...(phone !== undefined && { phone: phone ? phone.replace(/[^0-9+\-\s()]/g, "").slice(0, 15) : null }),
        ...(company !== undefined && { company }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(category !== undefined && { category }),
        ...(location !== undefined && { location }),
        ...(interestedProduct !== undefined && { interestedProduct }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(companyWebsite !== undefined && { companyWebsite }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(leadSource !== undefined && { leadSource: toPrismaLeadSource(leadSource) }),
        ...(leadType !== undefined && { leadType }),
        ...(revenueGenerated !== undefined && {
          revenueGenerated: parseFloat(revenueGenerated || "0"),
        }),
        ...(cashCollected !== undefined && {
          cashCollected: parseFloat(cashCollected || "0"),
        }),
        ...(notes !== undefined && { notes }),
        ...(milestones !== undefined && { milestones }),
        ...(userId !== undefined && { userId: userId || payload.userId }),
        ...(probability !== undefined && { probability: parseInt(probability || "0") }),
        ...(leadCreatedDate !== undefined && { leadCreatedDate: leadCreatedDate ? new Date(leadCreatedDate) : null }),
        ...(expectedCloseDate !== undefined && { expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null }),
        ...(isDeleted !== undefined && { isDeleted, deletedAt: isDeleted ? new Date() : null }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        followUps: {
          orderBy: { number: "asc" },
        },
        statusHistory: {
          orderBy: { changedAt: "desc" },
        },
      },
    });

    if (isStatusChanged) {
      await prisma.leadStatusHistory.create({
        data: {
          leadId: resolvedParams.id,
          fromStatus: existingLead.status,
          toStatus: status,
          userId: payload.userId,
          changedAt: new Date(),
          reason: body.reason || "Manual Status Update",
          lostReason: body.lostReason || null,
          companyId: payload.companyId as string,
        },
      });
    }

    // Audit log
    const leadName = `${updatedLead.firstName} ${updatedLead.lastName}`;
    const statusChanged = isStatusChanged
      ? ` Status: ${existingLead.status} → ${updatedLead.status}.` : "";
    await logAuditEvent({
      action:    "LEAD_UPDATED",
      category:  "Leads CRM",
      severity:  "INFO",
      actorName:  payload.name || payload.email,
      actorEmail: payload.email,
      actorRole:  payload.role,
      targetName: leadName,
      summary:   `Updated lead: ${leadName}.${statusChanged}`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(updatedLead);
  } catch (error: any) {
    console.error("PUT /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update lead" },
      { status: 500 }
    );
  }
}


  const resolvedParams = await params;
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    if (payload.role !== "SUPER_ADMIN" && payload.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Admins can delete leads" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";
    const validateOnly = searchParams.get("validate") === "true";

    const tenantFilter = await getTenantWhereClauseAsync(payload);

    // Verify access before deleting
    const existingLead = await prisma.lead.findFirst({
      where: { id: resolvedParams.id, ...tenantFilter },
    });
    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found or unauthorized" }, { status: 404 });
    }

    // Check for related payments, follow-ups, and activities
    const [paymentsCount, followUpsCount, activitiesCount] = await Promise.all([
      prisma.leadPayment.count({ where: { leadId: resolvedParams.id } }),
      prisma.followUp.count({ where: { leadId: resolvedParams.id } }),
      prisma.activity.count({ where: { leadId: resolvedParams.id } }),
    ]);

    const hasRelatedData = paymentsCount > 0 || followUpsCount > 0 || activitiesCount > 0;

    // Prevent soft delete if there's related data; allow permanent delete only for Super Admin
    if (hasRelatedData && !permanent) {
      return NextResponse.json(
        {
          error: "Cannot delete lead with associated payments, follow-ups, or activities.",
          details: {
            payments: paymentsCount,
            followUps: followUpsCount,
            activities: activitiesCount,
          },
        },
        { status: 400 }
      );
    }

    // If validation-only request, return success if no related data
    if (validateOnly) {
      return NextResponse.json({ success: true, hasRelatedData: false });
    }

    if (permanent && payload.role === "SUPER_ADMIN") {
      await prisma.lead.delete({
        where: { id: resolvedParams.id },
      });
    } else {
      await prisma.lead.update({
        where: { id: resolvedParams.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }

    // Audit log
    await logAuditEvent({
      action:    "LEAD_DELETED",
      category:  "Leads CRM",
      severity:  "DANGER",
      actorName:  payload.name || payload.email,
      actorEmail: payload.email,
      actorRole:  payload.role,
      targetName: `${existingLead.firstName} ${existingLead.lastName}`,
      summary:   `Permanently deleted lead: ${existingLead.firstName} ${existingLead.lastName}${existingLead.company ? ` (${existingLead.company})` : ""}`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
