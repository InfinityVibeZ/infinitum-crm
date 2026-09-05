import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTokenFromRequest, getTokenPayload, getTenantWhereClauseAsync, getUserTenantWhereClauseAsync } from "@/lib/auth";
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

export async function GET(request: Request) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = getTokenPayload(token);
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const source = searchParams.get("source");

    // Apply Tenant RLS (Company-wide for ADMIN)
    const tenantFilter = await getTenantWhereClauseAsync(payload);
    const where: any = { ...tenantFilter };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { jobTitle: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { interestedProduct: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
      
      // If tenantFilter already has an OR (like ADMIN does), we must use AND to combine them
      if (tenantFilter.OR) {
        where.AND = [
          { OR: tenantFilter.OR },
          { OR: where.OR }
        ];
        delete where.OR; // Remove the top-level ORs to avoid overwrite
        delete where.userId; // Just in case, clean up
      }
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (priority && priority !== "ALL") {
      where.priority = priority;
    }

    if (source && source !== "ALL") {
      where.leadSource = source;
    }

    const trash = searchParams.get("trash");
    if (trash === "true") {
      where.isDeleted = true;
    } else {
      where.NOT = { isDeleted: true };
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, company: true, department: true, companyId: true },
        },
        deals: {
          select: { id: true, name: true, stage: true, value: true },
        },
        followUps: {
          orderBy: { dueDate: "asc" },
        },
        payments: {
          where: { status: "PAID" },
          orderBy: { paymentDate: "desc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { changedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
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
      probability,
      expectedCloseDate,
      leadCreatedDate,
    } = body;

    const finalFirstName = firstName || "";
    const finalLastName = lastName || "";

    const cleanPhone = phone ? phone.replace(/[^0-9+\-\s()]/g, "").slice(0, 15) : "";

    if (!finalFirstName.trim() || !cleanPhone) {
      return NextResponse.json(
        { error: "Name and Phone are required" },
        { status: 400 }
      );
    }

    const emailValue = (email && email.trim() !== "") ? email.trim() : null;

    let assignedUserId = userId;
    if (!assignedUserId) {
      assignedUserId = payload.userId;
    } else if (assignedUserId !== payload.userId) {
      // Only allow assigning a lead to someone within the caller's own tenant —
      // prevents planting leads against a user in another company.
      const userTenantFilter = await getUserTenantWhereClauseAsync(payload);
      const targetUser = await prisma.user.findFirst({ where: { id: assignedUserId, ...userTenantFilter } });
      if (!targetUser) {
        return NextResponse.json({ error: "Cannot assign lead to a user outside your organization" }, { status: 403 });
      }
    }

    const initialStatus = status || "NEW";

    const newLead = await prisma.lead.create({
      data: {
        firstName: finalFirstName,
        lastName: finalLastName,
        email: emailValue,
        phone: cleanPhone,
        company,
        jobTitle,
        category,
        location,
        interestedProduct,
        linkedinUrl,
        companyWebsite,
        status: initialStatus,
        priority: priority || "MEDIUM",
        leadSource: toPrismaLeadSource(leadSource),
        leadType: leadType || null,
        probability: probability ? parseInt(probability) : 0,
        leadCreatedDate: leadCreatedDate ? new Date(leadCreatedDate) : new Date(),
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        revenueGenerated: revenueGenerated ? parseFloat(revenueGenerated) : 0,
        cashCollected: cashCollected ? parseFloat(cashCollected) : 0,
        notes: notes || null,
        milestones: milestones || [],
        userId: assignedUserId,
        companyId: payload.companyId as string,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: initialStatus,
            userId: payload.userId,
            changedAt: new Date(),
            reason: "Lead Created",
            companyId: payload.companyId as string,
          },
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, company: true, department: true, companyId: true },
        },
        followUps: true,
        statusHistory: true,
      },
    });

    // Audit log
    await logAuditEvent({
      action:    "LEAD_CREATED",
      category:  "Leads CRM",
      severity:  "SUCCESS",
      actorName:  payload.name || payload.email,
      actorEmail: payload.email,
      actorRole:  payload.role,
      targetName: `${firstName} ${lastName}${company ? ` (${company})` : ""}`,
      summary:   `Created new lead: ${firstName} ${lastName}${company ? ` from ${company}` : ""}`,
      ipAddress: getIpFromRequest(request),
    });

    return NextResponse.json(newLead, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/leads error:", error);
    const message = error?.message || "Failed to create lead";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
