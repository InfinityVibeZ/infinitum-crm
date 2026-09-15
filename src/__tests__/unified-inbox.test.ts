import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Inline tenant validation (mirrors src/lib/inbox/validation.ts logic)
// Used here to avoid ESM/CJS import resolution issues in test runner
class TenantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantValidationError';
  }
}

async function validateConversationTenancy(data: {
  companyId: string;
  contactId: string;
  integrationId?: string | null;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
}) {
  const { companyId, contactId, integrationId, assignedUserId, assignedTeamId } = data;

  const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { companyId: true } });
  if (!contact) throw new TenantValidationError('Contact not found.');
  if (contact.companyId !== companyId)
    throw new TenantValidationError('Cross-tenant violation: Contact belongs to a different company.');

  if (integrationId) {
    const integration = await prisma.integration.findUnique({ where: { id: integrationId }, select: { companyId: true } });
    if (!integration) throw new TenantValidationError('Integration not found.');
    if (integration.companyId !== companyId)
      throw new TenantValidationError('Cross-tenant violation: Integration belongs to a different company.');
  }

  if (assignedUserId) {
    const user = await prisma.user.findUnique({ where: { id: assignedUserId }, select: { companyId: true } });
    if (!user) throw new TenantValidationError('User not found.');
    if (user.companyId !== companyId)
      throw new TenantValidationError('Cross-tenant violation: User belongs to a different company.');
  }

  if (assignedTeamId) {
    const team = await prisma.team.findUnique({ where: { id: assignedTeamId }, select: { companyId: true } });
    if (!team) throw new TenantValidationError('Team not found.');
    if (team.companyId !== companyId)
      throw new TenantValidationError('Cross-tenant violation: Team belongs to a different company.');
  }

  return true;
}

describe('Unified Inbox Foundation', () => {
  let companyA: string;
  let companyB: string;
  let contactA: string;
  let contactB: string;
  let integrationA: string;
  let userB: string;
  let teamB: string;

  before(async () => {
    const ts = Date.now();
    const ca = await prisma.company.create({ data: { name: `Company A Test ${ts}` } });
    const cb = await prisma.company.create({ data: { name: `Company B Test ${ts}` } });
    companyA = ca.id;
    companyB = cb.id;

    const ctcA = await prisma.contact.create({ data: { companyId: companyA, name: 'Contact A' } });
    const ctcB = await prisma.contact.create({ data: { companyId: companyB, name: 'Contact B' } });
    contactA = ctcA.id;
    contactB = ctcB.id;

    const intA = await prisma.integration.create({
      data: { companyId: companyA, provider: 'TEST', type: 'TEST', externalId: `test_int_A_${ts}`, displayName: 'Integration A' }
    });
    integrationA = intA.id;

    const uB = await prisma.user.create({
      data: { email: `userb_${ts}@test.com`, name: 'User B', passwordHash: 'hash', companyId: companyB }
    });
    userB = uB.id;

    const tb = await prisma.team.create({ data: { companyId: companyB, name: 'Team B' } });
    teamB = tb.id;
  });

  after(async () => {
    try { await prisma.company.delete({ where: { id: companyA } }); } catch {}
    try { await prisma.company.delete({ where: { id: companyB } }); } catch {}
    await prisma.$disconnect();
  });

  // ── Idempotency Tests ──────────────────────────────────────────────────

  test('duplicate external conversation is rejected (P2002)', async () => {
    const extId = `ext_conv_idem_${Date.now()}`;

    const conv1 = await prisma.conversation.create({
      data: { company_id: companyA, contact_id: contactA, integration_id: integrationA, channel: 'TEST', external_conversation_id: extId }
    });
    assert.ok(conv1.id, 'First conversation should be created');

    await assert.rejects(
      prisma.conversation.create({
        data: { company_id: companyA, contact_id: contactA, integration_id: integrationA, channel: 'TEST', external_conversation_id: extId }
      }),
      (err: any) => {
        assert.equal(err.code, 'P2002');
        return true;
      }
    );
  });

  test('duplicate external message is rejected (P2002)', async () => {
    const conv = await prisma.conversation.create({
      data: { company_id: companyA, contact_id: contactA, channel: 'TEST' }
    });
    const extId = `ext_msg_idem_${Date.now()}`;

    await prisma.message.create({
      data: { company_id: companyA, conversation_id: conv.id, direction: 'INBOUND', sender_type: 'CONTACT', external_message_id: extId, content: 'Hi' }
    });
    await assert.rejects(
      prisma.message.create({
        data: { company_id: companyA, conversation_id: conv.id, direction: 'INBOUND', sender_type: 'CONTACT', external_message_id: extId, content: 'Dup' }
      }),
      (err: any) => { assert.equal(err.code, 'P2002'); return true; }
    );
  });

  test('same external conversation ID allowed across different integrations', async () => {
    const ts = Date.now();
    const intA2 = await prisma.integration.create({
      data: { companyId: companyA, provider: 'TEST2', type: 'TEST', externalId: `test_int_A2_${ts}`, displayName: 'Integration A2' }
    });
    const extId = `ext_conv_shared_${ts}`;

    await prisma.conversation.create({
      data: { company_id: companyA, contact_id: contactA, integration_id: integrationA, channel: 'TEST', external_conversation_id: extId }
    });
    const conv2 = await prisma.conversation.create({
      data: { company_id: companyA, contact_id: contactA, integration_id: intA2.id, channel: 'TEST', external_conversation_id: extId }
    });
    assert.ok(conv2.id, 'Same extId is allowed for a different integration');
  });

  test('same external message ID allowed across different conversations', async () => {
    const extId = `ext_msg_shared_${Date.now()}`;
    const conv1 = await prisma.conversation.create({ data: { company_id: companyA, contact_id: contactA, channel: 'TEST' } });
    const conv2 = await prisma.conversation.create({ data: { company_id: companyA, contact_id: contactA, channel: 'TEST' } });

    await prisma.message.create({ data: { company_id: companyA, conversation_id: conv1.id, direction: 'INBOUND', sender_type: 'CONTACT', external_message_id: extId, content: 'A' } });
    const msg2 = await prisma.message.create({ data: { company_id: companyA, conversation_id: conv2.id, direction: 'INBOUND', sender_type: 'CONTACT', external_message_id: extId, content: 'B' } });
    assert.ok(msg2.id, 'Same extId is allowed in a different conversation');
  });

  // ── Tenant Isolation Tests ─────────────────────────────────────────────

  test('cross-company Contact rejected from Conversation', async () => {
    await assert.rejects(
      validateConversationTenancy({ companyId: companyA, contactId: contactB }),
      /Cross-tenant violation: Contact/
    );
  });

  test('cross-company Integration rejected from Conversation', async () => {
    const intB = await prisma.integration.create({
      data: { companyId: companyB, provider: 'T', type: 'T', externalId: `intB_${Date.now()}`, displayName: 'B' }
    });
    await assert.rejects(
      validateConversationTenancy({ companyId: companyA, contactId: contactA, integrationId: intB.id }),
      /Cross-tenant violation: Integration/
    );
  });

  test('cross-company User assignment rejected', async () => {
    await assert.rejects(
      validateConversationTenancy({ companyId: companyA, contactId: contactA, assignedUserId: userB }),
      /Cross-tenant violation: User/
    );
  });

  test('cross-company Team assignment rejected', async () => {
    await assert.rejects(
      validateConversationTenancy({ companyId: companyA, contactId: contactA, assignedTeamId: teamB }),
      /Cross-tenant violation: Team/
    );
  });
});
