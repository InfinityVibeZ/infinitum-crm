import { prisma } from "../prisma";

export class TenantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantValidationError";
  }
}

export async function validateConversationTenancy(data: {
  companyId: string;
  contactId: string;
  integrationId?: string | null;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
}) {
  const { companyId, contactId, integrationId, assignedUserId, assignedTeamId } = data;

  // Validate Contact
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { companyId: true },
  });
  if (!contact) throw new TenantValidationError("Contact not found.");
  if (contact.companyId !== companyId) {
    throw new TenantValidationError("Cross-tenant violation: Contact belongs to a different company.");
  }

  // Validate Integration
  if (integrationId) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      select: { companyId: true },
    });
    if (!integration) throw new TenantValidationError("Integration not found.");
    if (integration.companyId !== companyId) {
      throw new TenantValidationError("Cross-tenant violation: Integration belongs to a different company.");
    }
  }

  // Validate User
  if (assignedUserId) {
    const user = await prisma.user.findUnique({
      where: { id: assignedUserId },
      select: { companyId: true },
    });
    if (!user) throw new TenantValidationError("User not found.");
    if (user.companyId !== companyId) {
      throw new TenantValidationError("Cross-tenant violation: User belongs to a different company.");
    }
  }

  // Validate Team
  if (assignedTeamId) {
    const team = await prisma.team.findUnique({
      where: { id: assignedTeamId },
      select: { companyId: true },
    });
    if (!team) throw new TenantValidationError("Team not found.");
    if (team.companyId !== companyId) {
      throw new TenantValidationError("Cross-tenant violation: Team belongs to a different company.");
    }
  }

  return true;
}

export async function validateMessageTenancy(data: {
  companyId: string;
  conversationId: string;
}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    select: { company_id: true },
  });
  if (!conversation) throw new TenantValidationError("Conversation not found.");
  if (conversation.company_id !== data.companyId) {
    throw new TenantValidationError("Cross-tenant violation: Conversation belongs to a different company.");
  }

  return true;
}
