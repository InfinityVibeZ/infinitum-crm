import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    if (!user || !user.companyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const limit = Math.min(
      Math.max(
        parseInt(searchParams.get("limit") || "20", 10),
        1
      ),
      100
    );

    const cursor = searchParams.get("cursor");

    /*
     * Only integrations that are currently connected and active
     * are allowed to appear in the Inbox.
     *
     * This is intentionally server-side so that disconnected
     * channels cannot appear through the "All" view either.
     */
    const connectedIntegrations =
      await prisma.integration.findMany({
        where: {
          companyId: user.companyId,
          status: "CONNECTED",
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    const connectedIntegrationIds =
      connectedIntegrations.map(
        (integration) => integration.id
      );

    /*
     * No connected integrations means the Inbox should be empty.
     *
     * We intentionally do not return conversations where
     * integration_id IS NULL because those conversations cannot
     * be associated with an active channel.
     */
    if (connectedIntegrationIds.length === 0) {
      return NextResponse.json({
        conversations: [],
        nextCursor: null,
      });
    }

    const conversations =
      await prisma.conversation.findMany({
        where: {
          company_id: user.companyId,

          /*
           * Only conversations belonging to currently connected
           * integrations are visible in Inbox.
           */
          integration_id: {
            in: connectedIntegrationIds,
          },
        },

        orderBy: {
          last_message_at: "desc",
        },

        take: limit + 1,

        ...(cursor
          ? {
              cursor: {
                id: cursor,
              },
            }
          : {}),

        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              customFields: true,
            },
          },

          integration: {
            select: {
              id: true,
              provider: true,
              status: true,
              isActive: true,
            },
          },

          messages: {
            orderBy: {
              created_at: "desc",
            },
            take: 1,
          },
        },
      });

    let nextCursor: string | null = null;

    if (conversations.length > limit) {
      const nextItem = conversations.pop();

      if (nextItem) {
        nextCursor = nextItem.id;
      }
    }

    return NextResponse.json({
      conversations,
      nextCursor,
    });
  } catch (error) {
    console.error(
      "Inbox Conversations GET API error:",
      error
    );

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}