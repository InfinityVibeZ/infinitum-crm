import { AssignmentStatus, AssignmentStrategy, AssignmentTrigger, Prisma } from "@prisma/client";

export interface AssignLeadParams {
  companyId: string;
  leadId: string;
  trigger: AssignmentTrigger;
  context?: any;
}

export interface AssignLeadResult {
  status: AssignmentStatus;
  assignedUserId: string | null;
  assignedTeamId: string | null;
  ruleId: string | null;
  strategy: AssignmentStrategy;
  reason: string;
}

export async function assignLead(
  tx: any,
  params: AssignLeadParams
): Promise<AssignLeadResult> {
  const { companyId, leadId, trigger } = params;

  // 1. Idempotency Check: Don't assign if already assigned for this trigger
  const existingHistory = await tx.leadAssignment.findUnique({
    where: {
      leadId_trigger: {
        leadId,
        trigger
      }
    }
  });

  if (existingHistory) {
    return {
      status: existingHistory.status,
      assignedUserId: existingHistory.assignedUserId,
      assignedTeamId: existingHistory.assignedTeamId,
      ruleId: existingHistory.ruleId,
      strategy: existingHistory.strategy,
      reason: "Idempotent return of existing assignment"
    };
  }

  // 2. Fetch active rules
  const rules = await tx.leadAssignmentRule.findMany({
    where: {
      companyId,
      enabled: true
    },
    orderBy: {
      priority: "asc"
    }
  });

  let assignedUserId: string | null = null;
  let assignedTeamId: string | null = null;
  let ruleId: string | null = null;
  let finalStrategy: AssignmentStrategy = AssignmentStrategy.FALLBACK;
  let finalStatus: AssignmentStatus = AssignmentStatus.UNASSIGNED;
  let reason = "No eligible rule or fallback found";

  for (const rule of rules) {
    if (rule.strategy === AssignmentStrategy.SPECIFIC_USER && rule.targetUserId) {
      // Check if user is active
      const user = await tx.user.findUnique({
        where: { id: rule.targetUserId }
      });
      if (user && user.companyId === companyId && user.isActive && !user.isDeleted) {
        assignedUserId = user.id;
        ruleId = rule.id;
        finalStrategy = AssignmentStrategy.SPECIFIC_USER;
        finalStatus = AssignmentStatus.ASSIGNED;
        reason = "Matched SPECIFIC_USER rule";
        break;
      }
    } else if (rule.strategy === AssignmentStrategy.ROUND_ROBIN && rule.targetTeamId) {
      // Find active team members
      const teamMembers = await tx.userTeam.findMany({
        where: { teamId: rule.targetTeamId, companyId },
        include: {
          user: true
        },
        orderBy: {
          userId: "asc" // Deterministic ordering
        }
      });

      const eligibleMembers = teamMembers.filter((tm: any) => tm.user.isActive && !tm.user.isDeleted && tm.user.companyId === companyId);
      
      if (eligibleMembers.length > 0) {
        // Atomic transaction update on rule cursor
        // Using raw query to update cursor atomically returning the updated rule state safely
        const updatedRuleArray = await tx.$queryRaw`
          UPDATE "lead_assignment_rules"
          SET cursor = CAST(
            CASE 
              WHEN cursor IS NULL THEN '0'
              ELSE ((cursor::text::int + 1) % ${eligibleMembers.length})::text
            END
          AS jsonb)
          WHERE id = ${rule.id}::uuid
          RETURNING cursor
        `;

        const currentIndex = updatedRuleArray[0]?.cursor ?? 0;
        const selectedMember = eligibleMembers[currentIndex];
        
        if (selectedMember) {
          assignedUserId = selectedMember.userId;
          assignedTeamId = rule.targetTeamId;
          ruleId = rule.id;
          finalStrategy = AssignmentStrategy.ROUND_ROBIN;
          finalStatus = AssignmentStatus.ASSIGNED;
          reason = `Matched ROUND_ROBIN rule for team ${rule.targetTeamId}`;
          break;
        }
      }
    } else if (rule.strategy === AssignmentStrategy.TEAM && rule.targetTeamId) {
       // A direct team assignment without an explicit individual owner
       // Could be picked up from a team queue later
       const team = await tx.team.findUnique({ where: { id: rule.targetTeamId, companyId }});
       if (team && team.isActive) {
          assignedTeamId = team.id;
          ruleId = rule.id;
          finalStrategy = AssignmentStrategy.TEAM;
          finalStatus = AssignmentStatus.ASSIGNED;
          reason = "Matched TEAM rule";
          break;
       }
    }
  }

  // 3. Fallback
  if (finalStatus === AssignmentStatus.UNASSIGNED) {
    // Try company owner or first admin
    const fallbackUser = await tx.user.findFirst({
      where: {
        companyId,
        isActive: true,
        isDeleted: false,
        role: "ADMIN"
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (fallbackUser) {
      assignedUserId = fallbackUser.id;
      finalStrategy = AssignmentStrategy.FALLBACK;
      finalStatus = AssignmentStatus.ASSIGNED;
      reason = "Assigned via FALLBACK to an active Admin";
    }
  }

  // 4. Create the LeadAssignment History Record
  const newAssignment = await tx.leadAssignment.create({
    data: {
      companyId,
      leadId,
      assignedUserId,
      assignedTeamId,
      ruleId,
      strategy: finalStrategy,
      trigger,
      status: finalStatus,
      reason
    }
  });

  // 5. Update the Lead's current owner
  if (assignedUserId) {
    await tx.lead.update({
      where: { id: leadId },
      data: { userId: assignedUserId }
    });
  }

  return {
    status: finalStatus,
    assignedUserId,
    assignedTeamId,
    ruleId,
    strategy: finalStrategy,
    reason
  };
}
