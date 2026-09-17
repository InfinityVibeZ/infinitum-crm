import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";
import { assignLead } from "@/lib/integrations/assignment-service";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { leadId, targetUserId } = body;

    if (!leadId || !targetUserId) {
      return NextResponse.json({ error: "Missing leadId or targetUserId" }, { status: 400 });
    }

    // Verify lead belongs to company
    const lead = await prisma.lead.findUnique({
      where: { id: leadId, companyId: user.companyId }
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Assign manually via a temporary specific rule or direct fallback
    const result = await prisma.$transaction(async (tx) => {
      // Re-assign explicitly
      const newAssignment = await tx.leadAssignment.create({
        data: {
          companyId: user.companyId,
          leadId,
          assignedUserId: targetUserId,
          strategy: "SPECIFIC_USER",
          trigger: "MANUAL_ASSIGNMENT",
          status: "ASSIGNED",
          reason: `Manually reassigned by Admin ${user.id}`
        }
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { userId: targetUserId }
      });

      return newAssignment;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
