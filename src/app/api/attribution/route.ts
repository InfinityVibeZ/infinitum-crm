import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth"; // Ensure we get the companyId

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = user.companyId;

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get("contactId");
    const leadId = searchParams.get("leadId");

    if (!contactId && !leadId) {
      return NextResponse.json({ error: "Must provide contactId or leadId" }, { status: 400 });
    }

    const whereClause: any = { companyId };
    if (contactId) whereClause.contactId = contactId;
    if (leadId) whereClause.leadId = leadId;

    const touches = await prisma.attributionTouch.findMany({
      where: whereClause,
      orderBy: { capturedAt: "asc" },
    });

    return NextResponse.json({ touches });
  } catch (error) {
    console.error("Attribution GET API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
