import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { conversationId: string } }) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        company_id: user.companyId,
      },
      include: {
        contact: true,
        integration: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Inbox Conversation GET API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
