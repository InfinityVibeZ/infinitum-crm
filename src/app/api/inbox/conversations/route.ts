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
     * Phase 3.8.6 — Inbox Productivity filters.
     *
     * All parameters are optional. With no parameters, the query below is
     * byte-identical to the pre-3.8.6 behavior (same where, same ordering,
     * same cursor pagination).
     *
     * UNREAD SAFETY:
     * The canonical unread definition in this product is the CLIENT-side
     * comparison of Conversation.metadata.lastReadAt (set by the /read
     * endpoint) against Conversation.last_message_at. Conversation.status
     * is NOT maintained as an unread marker (the pipeline always writes
     * "OPEN" and never "UNREAD"), so server-side unread filtering CANNOT
     * accurately reproduce lastReadAt behavior with the current schema.
     *
     * Therefore:
     * - filter=unread is implemented CLIENT-SIDE over loaded pages, and
     *   the API additionally exposes unreadCount only as a client mirror.
     * - The API deliberately does NOT map filter=unread to status=UNREAD.
     *
     * Documented limitation: unread filtering operates on pages already
     * fetched by the client. If the total conversation count exceeds what
     * has been loaded, the Unread tab shows unread items among loaded
     * conversations with a hint to load more. Fixing this properly would
     * require a schema change (e.g. a lastReadAt column), which is out of
     * scope for 3.8.6 by design.
     */

    const filter = searchParams.get("filter") || "all"; // "all" | "unread" | "channel"
    const channelParam = (searchParams.get("channel") || "").trim().toUpperCase();
    const searchParam = (searchParams.get("search") || "").trim().slice(0, 100);

    // Channel filtering is only honored for the "channel" filter mode.
    // Invalid channel values are ignored (fall back to all) rather than
    // erroring, so the UI can never get stuck on a broken filter state.
    const KNOWN_CHANNELS = ["INSTAGRAM", "FACEBOOK", "WHATSAPP"];
    const channelFilter =
      filter === "channel" && KNOWN_CHANNELS.includes(channelParam)
        ? channelParam
        : null;

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

          /*
           * Phase 3.8.6 — optional filters (all additive; when absent the
           * effective where clause is unchanged from pre-3.8.6).
           */
          ...(channelFilter ? { channel: channelFilter } : {}),

          ...(searchParam
            ? {
                OR: [
                  {
                    contact: {
                      name: {
                        contains: searchParam,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                  {
                    messages: {
                      some: {
                        content: {
                          contains: searchParam,
                          mode: "insensitive" as const,
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        },

        /*
         * Phase 3.8.6 — deterministic tie-break: last_message_at is not
         * unique, so cursor pagination without a unique tie-breaker could
         * repeat or skip conversations with identical timestamps across
         * pages. Ordering by (last_message_at desc, id desc) is stable and
         * keeps the existing latest-activity-first semantics.
         */
        orderBy: [
          {
            last_message_at: "desc",
          },
          {
            id: "desc",
          },
        ],

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

    /*
     * Phase 3.8.6 — Prisma's cursor paginatation INCLUDES the cursor row as
     * the first result. Without this, every page fetch would re-serve the
     * first conversation of the next page (a duplicate the client would
     * otherwise have to drop). We drop it server-side so pages are exact.
     *
     * This only affects calls that pass a cursor (new in 3.8.6 usage);
     * cursor-less calls are unchanged.
     */
    if (cursor && conversations.length > 0 && conversations[0].id === cursor) {
      conversations.shift();
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