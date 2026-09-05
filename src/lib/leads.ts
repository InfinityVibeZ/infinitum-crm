import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@prisma/client";

export async function recordLeadStatusTransition({
  leadId,
  toStatus,
  userId,
  activityId,
  reason,
  lostReason,
}: {
  leadId: string;
  toStatus: LeadStatus;
  userId?: string;
  activityId?: string;
  reason?: string;
  lostReason?: string;
}) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, status: true, companyId: true },
  });

  if (!lead) return null;

  const fromStatus = lead.status;

  // Do nothing if status hasn't changed
  if (fromStatus === toStatus) return null;

  // Update current lead status
  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: { status: toStatus },
  });

  // Create immutable status history record
  const history = await prisma.leadStatusHistory.create({
    data: {
      leadId,
      fromStatus,
      toStatus,
      userId: userId || null,
      activityId: activityId || null,
      reason: reason || null,
      lostReason: lostReason || null,
      changedAt: new Date(),
      companyId: lead.companyId,
    },
  });

  return { updatedLead, history };
}
