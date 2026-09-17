import crypto from "crypto";
import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantWhereClauseAsync,
  requireAuthenticatedUser,
} from "@/lib/auth";
import { logAuditEvent, getIpFromRequest } from "@/lib/audit";
import { LeadSource, FollowUpType, FollowUpStatus } from "@prisma/client";

function toPrismaLeadSource(val: unknown): LeadSource | null {
  if (!val || typeof val !== "string") {
    return null;
  }

  const normalized = val
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (
    Object.values(LeadSource).includes(
      normalized as LeadSource
    )
  ) {
    return normalized as LeadSource;
  }

  // Legacy / external source mappings
  if (
    normalized === "GOOGLE_ADS" ||
    normalized === "FACEBOOK" ||
    normalized === "INSTAGRAM" ||
    normalized === "ADVERTISING"
  ) {
    return LeadSource.ADVERTISEMENT;
  }

  if (
    normalized === "COLD_CALL" ||
    normalized === "CALL"
  ) {
    return LeadSource.PHONE;
  }

  if (
    normalized === "COLD_EMAIL" ||
    normalized === "MAIL"
  ) {
    return LeadSource.EMAIL;
  }

  return LeadSource.OTHER;
}

function toFollowUpType(value: unknown): FollowUpType {
  const normalized =
    typeof value === "string"
      ? value.trim().toUpperCase().replace(/\s+/g, "_")
      : "";

  if (
    Object.values(FollowUpType).includes(
      normalized as FollowUpType
    )
  ) {
    return normalized as FollowUpType;
  }

  return "OTHER" as FollowUpType;
}

function toFollowUpStatus(
  completed: unknown
): FollowUpStatus {
  return completed
    ? ("COMPLETED" as FollowUpStatus)
    : ("PENDING" as FollowUpStatus);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth = await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter =
      await getTenantWhereClauseAsync(payload);

    const lead = await prisma.lead.findFirst({
      where: {
        id: resolvedParams.id,
        ...tenantFilter,
      },

      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },

        deals: true,

        activities: {
          orderBy: {
            createdAt: "desc",
          },
        },

        follow_ups: {
          orderBy: {
            scheduled_at: "asc",
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error(
      "GET /api/leads/[id] error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to fetch lead" },
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

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter =
      await getTenantWhereClauseAsync(payload);

    const existingLead =
      await prisma.lead.findFirst({
        where: {
          id: resolvedParams.id,
          ...tenantFilter,
        },
      });

    if (!existingLead) {
      return NextResponse.json(
        {
          error:
            "Lead not found or unauthorized",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      firstName,
      lastName,
      name,
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

    /*
     * ---------------------------------------------------------
     * FOLLOW UPS
     * ---------------------------------------------------------
     */

    if (
      followUps !== undefined &&
      Array.isArray(followUps)
    ) {
      if (
        !(await hasFeature(
          payload.companyId,
          "FOLLOW_UPS"
        ))
      ) {
        return NextResponse.json(
          {
            error: "FEATURE_NOT_AVAILABLE",
            featureCode: "FOLLOW_UPS",
          },
          { status: 403 }
        );
      }

      for (const fu of followUps) {
        if (!fu || typeof fu !== "object") {
          continue;
        }

        /*
         * Find existing follow-up for this lead.
         *
         * The actual Prisma model uses:
         * lead_id
         * scheduled_at
         * completed_at
         */
        const existing =
          await prisma.follow_ups.findFirst({
            where: {
              lead_id: resolvedParams.id,
            },

            orderBy: {
              scheduled_at: "asc",
            },
          });

        const completed =
          Boolean(fu.completed);

        const followUpType =
          toFollowUpType(
            fu.followUpType ??
              fu.type ??
              "OTHER"
          );

        const followUpStatus =
          toFollowUpStatus(completed);

        const scheduledAt =
          fu.scheduledAt ||
          fu.scheduled_at ||
          fu.dueDate;

        const scheduledDate =
          scheduledAt
            ? new Date(scheduledAt)
            : new Date();

        const completedDate =
          completed
            ? new Date()
            : null;

        if (existing) {
          await prisma.follow_ups.update({
            where: {
              id: existing.id,
            },

            data: {
              type: followUpType,
              status: followUpStatus,
              scheduled_at: scheduledDate,
              completed_at: completedDate,
              notes:
                fu.notes !== undefined
                  ? fu.notes
                  : existing.notes,
              user_id:
                fu.userId !== undefined
                  ? fu.userId || null
                  : existing.user_id,
              updated_at: new Date(),
            },
          });
        } else {
          await prisma.follow_ups.create({
            data: {
              id: crypto.randomUUID(),

              company_id:
                payload.companyId as string,

              lead_id:
                resolvedParams.id,

              type: followUpType,

              status: followUpStatus,

              scheduled_at:
                scheduledDate,

              completed_at:
                completedDate,

              notes:
                fu.notes || null,

              user_id:
                fu.userId ||
                payload.userId ||
                null,

              updated_at:
                new Date(),
            },
          });
        }
      }
    }

    /*
     * ---------------------------------------------------------
     * LEAD NAME
     * ---------------------------------------------------------
     */

    const isStatusChanged =
      status !== undefined &&
      status !== existingLead.status;

    let leadName: string | undefined;

    if (name !== undefined) {
      leadName =
        name === null
          ? ""
          : String(name).trim();
    } else if (
      firstName !== undefined ||
      lastName !== undefined
    ) {
      const newFirstName =
        firstName !== undefined
          ? String(firstName).trim()
          : "";

      const newLastName =
        lastName !== undefined
          ? String(lastName).trim()
          : "";

      leadName =
        `${newFirstName} ${newLastName}`.trim();

      if (!leadName) {
        leadName =
          existingLead.name || "";
      }
    }

    /*
     * ---------------------------------------------------------
     * UPDATE LEAD
     * ---------------------------------------------------------
     */

    const updatedLead =
      await prisma.lead.update({
        where: {
          id: resolvedParams.id,
        },

        data: {
          ...(leadName !== undefined && {
            name: leadName,
          }),

          ...(email !== undefined && {
            email:
              email &&
              String(email).trim() !== ""
                ? String(email).trim()
                : null,
          }),

          ...(phone !== undefined && {
            phone: phone
              ? String(phone)
                  .replace(
                    /[^0-9+\-\s()]/g,
                    ""
                  )
                  .slice(0, 15)
              : null,
          }),

          ...(company !== undefined && {
            company,
          }),

          ...(jobTitle !== undefined && {
            jobTitle,
          }),

          ...(category !== undefined && {
            category,
          }),

          ...(location !== undefined && {
            location,
          }),

          ...(interestedProduct !==
            undefined && {
            interestedProduct,
          }),

          ...(linkedinUrl !== undefined && {
            linkedinUrl,
          }),

          ...(companyWebsite !==
            undefined && {
            companyWebsite,
          }),

          ...(status !== undefined && {
            status,
          }),

          ...(priority !== undefined && {
            priority,
          }),

          ...(leadSource !== undefined && {
            leadSource:
              toPrismaLeadSource(
                leadSource
              ),
          }),

          ...(leadType !== undefined && {
            leadType,
          }),

          ...(revenueGenerated !==
            undefined && {
            revenueGenerated:
              parseFloat(
                String(
                  revenueGenerated || "0"
                )
              ),
          }),

          ...(cashCollected !==
            undefined && {
            cashCollected:
              parseFloat(
                String(
                  cashCollected || "0"
                )
              ),
          }),

          ...(notes !== undefined && {
            notes,
          }),

          ...(milestones !== undefined && {
            milestones,
          }),

          ...(userId !== undefined && {
            userId:
              userId ||
              payload.userId,
          }),

          ...(probability !== undefined && {
            probability:
              parseInt(
                String(
                  probability || "0"
                ),
                10
              ),
          }),

          ...(leadCreatedDate !==
            undefined && {
            leadCreatedDate:
              leadCreatedDate
                ? new Date(
                    leadCreatedDate
                  )
                : null,
          }),

          ...(expectedCloseDate !==
            undefined && {
            expectedCloseDate:
              expectedCloseDate
                ? new Date(
                    expectedCloseDate
                  )
                : null,
          }),

          ...(isDeleted !== undefined && {
            isDeleted,

            deletedAt: isDeleted
              ? new Date()
              : null,
          }),
        },

        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },

          follow_ups: {
            orderBy: {
              scheduled_at: "asc",
            },
          },

          statusHistory: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    /*
     * ---------------------------------------------------------
     * STATUS HISTORY
     * ---------------------------------------------------------
     */

    if (isStatusChanged) {
      await prisma.leadStatusHistory.create({
        data: {
          leadId:
            resolvedParams.id,

          fromStatus:
            existingLead.status,

          toStatus:
            status,

          userId:
            payload.userId,

          createdAt:
            new Date(),

          notes:
            body.reason ||
            "Manual Status Update",

          companyId:
            payload.companyId as string,
        },
      });
    }

    /*
     * ---------------------------------------------------------
     * AUDIT
     * ---------------------------------------------------------
     */

    const updatedLeadName =
      updatedLead.name ||
      "Unnamed Lead";

    const statusChanged =
      isStatusChanged
        ? ` Status: ${existingLead.status} → ${updatedLead.status}.`
        : "";

    await logAuditEvent({
      action: "LEAD_UPDATED",
      category: "Leads CRM",
      severity: "INFO",

      actorName:
        payload.name ||
        payload.email,

      actorEmail:
        payload.email,

      actorRole:
        payload.role,

      targetName:
        updatedLeadName,

      summary:
        `Updated lead: ${updatedLeadName}.${statusChanged}`,

      ipAddress:
        getIpFromRequest(request),
    });

    return NextResponse.json(
      updatedLead
    );
  } catch (error: any) {
    console.error(
      "PUT /api/leads/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to update lead",
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
    const auth =
      await requireAuthenticatedUser(
        request
      );

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    if (
      payload.role !== "SUPER_ADMIN" &&
      payload.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only Admins can delete leads",
        },
        { status: 403 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const permanent =
      searchParams.get("permanent") ===
      "true";

    const validateOnly =
      searchParams.get("validate") ===
      "true";

    const tenantFilter =
      await getTenantWhereClauseAsync(
        payload
      );

    const existingLead =
      await prisma.lead.findFirst({
        where: {
          id: resolvedParams.id,
          ...tenantFilter,
        },
      });

    if (!existingLead) {
      return NextResponse.json(
        {
          error:
            "Lead not found or unauthorized",
        },
        { status: 404 }
      );
    }

    const [
      paymentsCount,
      followUpsCount,
      activitiesCount,
    ] = await Promise.all([
      prisma.leadPayment.count({
        where: {
          leadId:
            resolvedParams.id,
        },
      }),

      prisma.follow_ups.count({
        where: {
          lead_id:
            resolvedParams.id,
        },
      }),

      prisma.activity.count({
        where: {
          leadId:
            resolvedParams.id,
        },
      }),
    ]);

    const hasRelatedData =
      paymentsCount > 0 ||
      followUpsCount > 0 ||
      activitiesCount > 0;

    if (
      hasRelatedData &&
      !permanent
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot delete lead with associated payments, follow-ups, or activities.",

          details: {
            payments:
              paymentsCount,

            followUps:
              followUpsCount,

            activities:
              activitiesCount,
          },
        },
        { status: 400 }
      );
    }

    if (validateOnly) {
      return NextResponse.json({
        success: true,
        hasRelatedData,
        details: {
          payments:
            paymentsCount,

          followUps:
            followUpsCount,

          activities:
            activitiesCount,
        },
      });
    }

    if (
      permanent &&
      payload.role ===
        "SUPER_ADMIN"
    ) {
      await prisma.lead.delete({
        where: {
          id:
            resolvedParams.id,
        },
      });
    } else {
      await prisma.lead.update({
        where: {
          id:
            resolvedParams.id,
        },

        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }

    const existingLeadName =
      existingLead.name ||
      "Unnamed Lead";

    await logAuditEvent({
      action: "LEAD_DELETED",
      category: "Leads CRM",
      severity: "DANGER",

      actorName:
        payload.name ||
        payload.email,

      actorEmail:
        payload.email,

      actorRole:
        payload.role,

      targetName:
        existingLeadName,

      summary:
        `Permanently deleted lead: ${existingLeadName}${
          existingLead.company
            ? ` (${existingLead.company})`
            : ""
        }`,

      ipAddress:
        getIpFromRequest(request),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/leads/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete lead",
      },
      { status: 500 }
    );
  }
}