import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const cursor = searchParams.get("cursor");

    const conversations = await prisma.conversation.findMany({
      where: { company_id: user.companyId },
      orderBy: { last_message_at: "desc" },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
      }),
      include: {
        contact: {
          select: { id: true, name: true, email: true, phone: true },
        },
        integration: {
          select: { id: true, provider: true },
        },
        messages: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });

    let nextCursor: string | null = null;
    if (conversations.length > limit) {
      const nextItem = conversations.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({ conversations, nextCursor });
  } catch (error) {
    console.error("Inbox Conversations GET API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
