import { hasFeature } from "@/lib/subscription";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantWhereClauseAsync,
  requireAuthenticatedUser,
} from "@/lib/auth";
import {
  ActivityType,
  LeadStatus,
} from "@prisma/client";
import { recordLeadStatusTransition } from "@/lib/leads";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth =
      await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter =
      await getTenantWhereClauseAsync(payload);

    const lead =
      await prisma.lead.findFirst({
        where: {
          id: resolvedParams.id,
          ...tenantFilter,
        },
        select: {
          id: true,
          name: true,
          company: true,
          status: true,
          createdAt: true,
        },
      });

    if (!lead) {
      return NextResponse.json(
        {
          error:
            "Lead not found or unauthorized",
        },
        { status: 404 }
      );
    }

    const [
      activities,
      statusHistory,
      payments,
    ] = await Promise.all([
      prisma.activity.findMany({
        where: {
          leadId: resolvedParams.id,
          companyId:
            payload.companyId as string,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.leadStatusHistory.findMany({
        where: {
          leadId: resolvedParams.id,
          companyId:
            payload.companyId as string,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.leadPayment.findMany({
        where: {
          leadId: resolvedParams.id,
          companyId:
            payload.companyId as string,
        },
        orderBy: {
          paymentDate: "desc",
        },
      }),
    ]);

    return NextResponse.json({
      lead,
      activities,
      statusHistory,
      payments,
    });
  } catch (error) {
    console.error(
      "GET activities error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch activities",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;

  try {
    const auth =
      await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter =
      await getTenantWhereClauseAsync(payload);

    const lead =
      await prisma.lead.findFirst({
        where: {
          id: resolvedParams.id,
          ...tenantFilter,
        },
        select: {
          id: true,
        },
      });

    if (!lead) {
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

    if (!type) {
      return NextResponse.json(
        {
          error:
            "Activity type is required",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * ACTIVITY TYPE
     * -------------------------------------------------------
     */

    let schemaType: ActivityType =
      ActivityType.NOTE;

    const typeUpper =
      String(type).toUpperCase();

    if (typeUpper === "CALL") {
      schemaType = ActivityType.CALL;
    } else if (
      typeUpper === "MEETING"
    ) {
      schemaType =
        ActivityType.MEETING;
    } else if (
      typeUpper === "SITE VISIT" ||
      typeUpper === "SITE_VISIT"
    ) {
      schemaType =
        ActivityType.TASK;
    } else if (
      typeUpper === "EMAIL"
    ) {
      schemaType =
        ActivityType.EMAIL;
    }

    /*
     * -------------------------------------------------------
     * ACTIVITY DATA
     *
     * The Prisma Activity model does not have:
     * outcome
     * activityDate
     * nextFollowUpDate
     * nextFollowUpTime
     * nextFollowUpType
     * reminder
     *
     * Keep those application-level values inside description
     * so existing frontend functionality is preserved.
     * -------------------------------------------------------
     */

    const descriptionJson =
      JSON.stringify({
        visitDate:
          visitDate || null,

        outcome:
          outcome || null,

        followUpDate:
          followUpDate || null,

        nextFollowUpTime:
          nextFollowUpTime || null,

        nextFollowUpType:
          nextFollowUpType || null,

        reminder:
          reminder || null,

        summary:
          summary || null,

        related:
          related || null,

        customType:
          customType || null,

        newStatus:
          newStatus ||
          "NO_CHANGE",
      });

    const activityDate =
      visitDate
        ? new Date(visitDate)
        : new Date();

    const newActivity =
      await prisma.activity.create({
        data: {
          type: schemaType,

          subject:
            summary ||
            `${type} Activity`,

          description:
            descriptionJson,

          due_date:
            followUpDate
              ? new Date(followUpDate)
              : activityDate,

          completed_at:
            null,

          leadId:
            resolvedParams.id,

          userId:
            payload.userId,

          companyId:
            payload.companyId as string,
        },
      });

    /*
     * -------------------------------------------------------
     * STATUS TRANSITION
     * -------------------------------------------------------
     *
     * HOLD is not part of the actual LeadStatus enum.
     * Valid statuses from the current application are:
     * NEW, CONTACTED, QUALIFIED, PROPOSAL,
     * NEGOTIATION, WON, LOST
     * -------------------------------------------------------
     */

    if (
      newStatus &&
      newStatus !== "NO_CHANGE"
    ) {
      const validStatuses: LeadStatus[] = [
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
      ];

      if (
        validStatuses.includes(
          newStatus as LeadStatus
        )
      ) {
        await recordLeadStatusTransition({
          leadId:
            resolvedParams.id,

          toStatus:
            newStatus as LeadStatus,

          userId:
            payload.userId,

          activityId:
            newActivity.id,

          reason:
            `Activity (${type}): ${outcome ||
            summary ||
            "Status Updated"
            }`,
        });
      }
    }

    return NextResponse.json(
      newActivity
    );
  } catch (error) {
    console.error(
      "POST activity error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create activity",
      },
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
    const auth =
      await requireAuthenticatedUser(request);

    if (auth instanceof Response) {
      return auth;
    }

    const { payload } = auth;

    const tenantFilter =
      await getTenantWhereClauseAsync(payload);

    const lead =
      await prisma.lead.findFirst({
        where: {
          id: resolvedParams.id,
          ...tenantFilter,
        },
        select: {
          id: true,
        },
      });

    if (!lead) {
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
      return NextResponse.json(
        {
          error:
            "Activity ID is required",
        },
        { status: 400 }
      );
    }

    /*
     * Make sure the activity belongs to
     * this tenant and lead.
     */

    const existingActivity =
      await prisma.activity.findFirst({
        where: {
          id: activityId,
          leadId: resolvedParams.id,
          companyId:
            payload.companyId as string,
        },

        select: {
          id: true,
        },
      });

    if (!existingActivity) {
      return NextResponse.json(
        {
          error:
            "Activity not found or unauthorized",
        },
        { status: 404 }
      );
    }

    /*
     * -------------------------------------------------------
     * ACTIVITY TYPE
     * -------------------------------------------------------
     */

    let schemaType: ActivityType =
      ActivityType.NOTE;

    const typeUpper =
      String(type || "NOTE").toUpperCase();

    if (typeUpper === "CALL") {
      schemaType =
        ActivityType.CALL;
    } else if (
      typeUpper === "MEETING"
    ) {
      schemaType =
        ActivityType.MEETING;
    } else if (
      typeUpper === "SITE VISIT" ||
      typeUpper === "SITE_VISIT"
    ) {
      schemaType =
        ActivityType.TASK;
    } else if (
      typeUpper === "EMAIL"
    ) {
      schemaType =
        ActivityType.EMAIL;
    }

    /*
     * -------------------------------------------------------
     * STORE EXTENDED ACTIVITY DATA
     * -------------------------------------------------------
     */

    const descriptionJson =
      JSON.stringify({
        visitDate:
          visitDate || null,

        outcome:
          outcome || null,

        followUpDate:
          followUpDate || null,

        nextFollowUpTime:
          nextFollowUpTime || null,

        nextFollowUpType:
          nextFollowUpType || null,

        reminder:
          reminder || null,

        summary:
          summary || null,

        related:
          related || null,

        customType:
          customType || null,

        newStatus:
          newStatus ||
          "NO_CHANGE",
      });

    const activityDate =
      visitDate
        ? new Date(visitDate)
        : new Date();

    const updatedActivity =
      await prisma.activity.update({
        where: {
          id: activityId,
        },

        data: {
          type: schemaType,

          subject:
            summary ||
            `${type || "NOTE"} Activity`,

          description:
            descriptionJson,

          due_date:
            followUpDate
              ? new Date(followUpDate)
              : activityDate,
        },
      });

    /*
     * -------------------------------------------------------
     * STATUS TRANSITION
     * -------------------------------------------------------
     */

    if (
      newStatus &&
      newStatus !== "NO_CHANGE"
    ) {
      const validStatuses: LeadStatus[] = [
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
      ];

      if (
        validStatuses.includes(
          newStatus as LeadStatus
        )
      ) {
        await recordLeadStatusTransition({
          leadId:
            resolvedParams.id,

          toStatus:
            newStatus as LeadStatus,

          userId:
            payload.userId,

          activityId:
            updatedActivity.id,

          reason:
            `Activity Edit (${type}): ${outcome ||
            summary ||
            "Status Updated"
            }`,
        });
      }
    }

    return NextResponse.json(
      updatedActivity
    );
  } catch (error) {
    console.error(
      "PUT activity error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update activity",
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

    const tenantFilter =
      await getTenantWhereClauseAsync(
        payload
      );

    const lead =
      await prisma.lead.findFirst({
        where: {
          id: resolvedParams.id,
          ...tenantFilter,
        },

        select: {
          id: true,
        },
      });

    if (!lead) {
      return NextResponse.json(
        {
          error:
            "Lead not found or unauthorized",
        },
        { status: 404 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const activityId =
      searchParams.get(
        "activityId"
      );

    if (!activityId) {
      return NextResponse.json(
        {
          error:
            "Activity ID is required",
        },
        { status: 400 }
      );
    }

    /*
     * Verify activity belongs to
     * the current tenant and lead.
     */

    const existingActivity =
      await prisma.activity.findFirst({
        where: {
          id: activityId,
          leadId: resolvedParams.id,
          companyId:
            payload.companyId as string,
        },

        select: {
          id: true,
        },
      });

    if (!existingActivity) {
      return NextResponse.json(
        {
          error:
            "Activity not found or unauthorized",
        },
        { status: 404 }
      );
    }

    await prisma.activity.delete({
      where: {
        id: activityId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE activity error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete activity",
      },
      { status: 500 }
    );
  }
}