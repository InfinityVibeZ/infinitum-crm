import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!user || !user.companyId || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }
    const companyId = user.companyId;

    const body = await req.json();
    const { survivingContactId, losingContactId } = body;

    if (!survivingContactId || !losingContactId || survivingContactId === losingContactId) {
      return NextResponse.json({ error: "Invalid contact IDs provided for merge." }, { status: 400 });
    }

    // Run merge in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify both contacts exist and belong to the company
      const survivor = await tx.contact.findUnique({ where: { id: survivingContactId, companyId } });
      const loser = await tx.contact.findUnique({ where: { id: losingContactId, companyId } });

      if (!survivor || !loser) {
        throw new Error("One or both contacts not found or do not belong to your organization.");
      }

      // 2. Re-parent Leads
      await tx.lead.updateMany({
        where: { contactId: losingContactId, companyId },
        data: { contactId: survivingContactId }
      });

      // 3. Re-parent AttributionTouches
      await tx.attributionTouch.updateMany({
        where: { contactId: losingContactId, companyId },
        data: { contactId: survivingContactId }
      });

      // 4. Re-parent ContactIdentities (handling potential provider uniqueness conflicts)
      const loserIdentities = await tx.contactIdentity.findMany({
        where: { contactId: losingContactId, companyId }
      });

      for (const identity of loserIdentities) {
        // Check if survivor already has this provider + externalId
        const existing = await tx.contactIdentity.findUnique({
          where: {
            companyId_provider_externalId: {
              companyId,
              provider: identity.provider,
              externalId: identity.externalId
            }
          }
        });

        if (!existing) {
          await tx.contactIdentity.update({
            where: { id: identity.id },
            data: { contactId: survivingContactId }
          });
        } else {
          // Survivor already has it, safe to delete the duplicate identity mapping
          await tx.contactIdentity.delete({ where: { id: identity.id } });
        }
      }

      // 5. Enrich survivor if it is missing data that loser had
      const updateData: any = {};
      if (!survivor.email && loser.email) {
        updateData.email = loser.email;
        updateData.normalizedEmail = loser.normalizedEmail;
      }
      if (!survivor.phone && loser.phone) {
        updateData.phone = loser.phone;
        updateData.normalizedPhone = loser.normalizedPhone;
      }
      if (!survivor.companyName && loser.companyName) updateData.companyName = loser.companyName;
      if (!survivor.jobTitle && loser.jobTitle) updateData.jobTitle = loser.jobTitle;

      if (Object.keys(updateData).length > 0) {
        await tx.contact.update({
          where: { id: survivingContactId },
          data: updateData
        });
      }

      // 6. Delete the losing contact
      await tx.contact.delete({ where: { id: losingContactId } });

      return { success: true, survivingContactId };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Merge Contacts API error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
