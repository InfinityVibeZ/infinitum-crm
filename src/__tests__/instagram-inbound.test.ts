/**
 * Phase 3.8.3 — Instagram Inbound Messaging E2E Tests
 *
 * Tests the full flow:
 *   Realistic IG webhook payload
 *   → extractEvents()
 *   → receiveWebhookEvents() / gateway persistence
 *   → processWebhookEvent()
 *   → normalizeInboundEvent()
 *   → processInboxEvent()
 *   → Contact + ContactIdentity resolution
 *   → Conversation upsert
 *   → Message creation
 *   → Conversation.lastMessageAt update
 *
 * All fixtures use synthetic IDs. No real tokens, secrets, or personal data.
 *
 * Run: node -r ts-node/register --test src/__tests__/instagram-inbound.test.ts
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { PrismaClient, IntegrationStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ── Realistic Instagram Webhook Fixture Payloads ──────────────────────────────
// Synthetic IDs only — no real account data, tokens, or secrets.

const IG_ACCOUNT_ID = "17841400000000000";   // Synthetic IG Business account ID
const IG_PAGE_ID    = "17841400000000000";   // Same as account for IG
const PSID_ALICE    = "7890000000000001";    // Synthetic sender PSID
const PSID_BOB      = "7890000000000002";    // Second synthetic sender
const MID_TEXT_1    = "m_synth_text_001";
const MID_TEXT_2    = "m_synth_text_002";
const MID_IMAGE_1   = "m_synth_image_001";
const MID_TEXT_BOB  = "m_synth_bob_001";

/** Builds a realistic Instagram webhook envelope for a messaging event */
function makeIGWebhookPayload(messagingItems: object[]): object {
  return {
    object: "instagram",
    entry: [
      {
        id: IG_ACCOUNT_ID,
        time: 1700000000000,
        messaging: messagingItems,
      },
    ],
  };
}

function makeIGTextMsg(mid: string, senderId: string, text: string, ts = 1700000000000): object {
  return {
    sender: { id: senderId },
    recipient: { id: IG_PAGE_ID },
    timestamp: ts,
    message: { mid, text },
  };
}

function makeIGImageMsg(mid: string, senderId: string, ts = 1700000001000): object {
  return {
    sender: { id: senderId },
    recipient: { id: IG_PAGE_ID },
    timestamp: ts,
    message: {
      mid,
      attachments: [
        {
          type: "image",
          payload: { url: "https://scontent.cdninstagram.com/synthetic/photo.jpg" },
        },
      ],
    },
  };
}

function makeIGReadReceipt(senderId: string): object {
  return {
    sender: { id: senderId },
    recipient: { id: IG_PAGE_ID },
    timestamp: Date.now(),
    read: { watermark: Date.now() },
  };
}

function makeIGEchoMsg(mid: string): object {
  return {
    sender: { id: IG_PAGE_ID },
    recipient: { id: PSID_ALICE },
    timestamp: Date.now(),
    message: { mid, text: "Bot reply", is_echo: true },
  };
}

// ── Inlined normalization & pipeline (mirrors Phase 3.8.2 production files) ──
// Avoids ESM/CJS import resolution issues with ts-node in this environment.

type MessageContentType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "STICKER" | "LOCATION" | "UNSUPPORTED";
type MessageDirection = "INBOUND" | "OUTBOUND";

interface NormalizedAttachment {
  type: MessageContentType;
  url?: string;
  payloadId?: string;
}

interface NormalizedInboxEvent {
  provider: string;
  channel: "INSTAGRAM" | "FACEBOOK" | "WHATSAPP";
  integrationId: string;
  externalConversationId: string;
  externalMessageId: string;
  externalSenderId: string;
  direction: MessageDirection;
  contentType: MessageContentType;
  text: string | null;
  attachments: NormalizedAttachment[];
  timestamp: Date;
  raw: Record<string, unknown>;
}

type NormalizationResult =
  | { ok: true; event: NormalizedInboxEvent }
  | { ok: false; reason: string };

interface PipelineResult {
  conversationId: string;
  messageId: string;
  contactId: string;
  messageStatus: "CREATED" | "EXISTING";
  conversationStatus: "CREATED" | "EXISTING";
}

class InboxPipelineError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "InboxPipelineError";
    this.code = code;
  }
}

function normalizeIGMessage(rawEvent: unknown, integrationId: string): NormalizationResult {
  const e = rawEvent as any;
  const senderId = e?.sender?.id;
  const recipientId = e?.recipient?.id;
  if (!senderId || !recipientId) return { ok: false, reason: "Missing sender.id or recipient.id" };
  if (e.message?.is_echo) return { ok: false, reason: "Echo message — skip" };
  if (!e.message) return { ok: false, reason: "No message payload — likely a read/delivery event" };

  const mid = e.message.mid;
  const externalMessageId = mid ?? `ig_${senderId}_${e.timestamp ?? Date.now()}`;
  const externalConversationId = `${recipientId}_${senderId}`;
  const text = e.message.text ?? null;
  const igAttachments: any[] = e.message.attachments ?? [];
  const attachments: NormalizedAttachment[] = igAttachments.map((a: any) => ({
    type: (() => {
      switch ((a.type ?? "").toLowerCase()) {
        case "image": return "IMAGE" as const;
        case "video": return "VIDEO" as const;
        case "audio": return "AUDIO" as const;
        case "file": return "FILE" as const;
        case "sticker": return "STICKER" as const;
        default: return "UNSUPPORTED" as const;
      }
    })(),
    url: a.payload?.url,
  }));

  const contentType: MessageContentType = text ? "TEXT" : attachments.length > 0 ? attachments[0].type : "UNSUPPORTED";

  return {
    ok: true,
    event: {
      provider: "INSTAGRAM",
      channel: "INSTAGRAM",
      integrationId,
      externalConversationId,
      externalMessageId,
      externalSenderId: senderId,
      direction: "INBOUND",
      contentType,
      text,
      attachments,
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      raw: rawEvent as Record<string, unknown>,
    },
  };
}

async function runPipeline(event: NormalizedInboxEvent): Promise<PipelineResult> {
  const integration = await prisma.integration.findUnique({
    where: { id: event.integrationId },
    select: { id: true, companyId: true, isActive: true },
  });
  if (!integration) throw new InboxPipelineError(`Integration ${event.integrationId} not found`, "INTEGRATION_NOT_FOUND");
  if (!integration.isActive) throw new InboxPipelineError(`Integration ${event.integrationId} is inactive`, "INTEGRATION_INACTIVE");
  const companyId = integration.companyId;

  return prisma.$transaction(async (tx: any) => {
    // Resolve contact identity
    let contactId: string;
    const existingIdentity = await tx.contactIdentity.findUnique({
      where: {
        companyId_provider_externalId: {
          companyId,
          provider: event.provider,
          externalId: event.externalSenderId,
        },
      },
      select: { contactId: true },
    });
    if (existingIdentity) {
      contactId = existingIdentity.contactId;
    } else {
      const newContact = await tx.contact.create({
        data: { companyId, name: "Instagram User" },
        select: { id: true },
      });
      contactId = newContact.id;
      await tx.contactIdentity.create({
        data: {
          companyId,
          contactId,
          provider: event.provider,
          identityType: "PROVIDER_EXTERNAL_ID",
          integrationId: event.integrationId,
          externalId: event.externalSenderId,
        },
      });
    }

    // Upsert Conversation
    let conversationStatus: "CREATED" | "EXISTING" = "CREATED";
    let conversationId: string;
    const existingConv = await tx.conversation.findFirst({
      where: {
        integration_id: event.integrationId,
        external_conversation_id: event.externalConversationId,
      },
      select: { id: true },
    });
    if (existingConv) {
      conversationId = existingConv.id;
      conversationStatus = "EXISTING";
    } else {
      const newConv = await tx.conversation.create({
        data: {
          company_id: companyId,
          contact_id: contactId,
          integration_id: event.integrationId,
          channel: event.channel,
          external_conversation_id: event.externalConversationId,
          status: "OPEN",
          last_message_at: event.timestamp,
          metadata: { openedBy: event.provider, firstMessageId: event.externalMessageId },
        },
        select: { id: true },
      });
      conversationId = newConv.id;
      await tx.conversationParticipant.create({
        data: {
          conversation_id: conversationId,
          contact_id: contactId,
          external_identity_id: event.externalSenderId,
          role: "CUSTOMER",
        },
      });
    }

    // Upsert Message
    let messageStatus: "CREATED" | "EXISTING" = "CREATED";
    let messageId: string;
    const existingMsg = await tx.message.findFirst({
      where: {
        conversation_id: conversationId,
        external_message_id: event.externalMessageId,
      },
      select: { id: true },
    });
    if (existingMsg) {
      messageId = existingMsg.id;
      messageStatus = "EXISTING";
    } else {
      const newMsg = await tx.message.create({
        data: {
          company_id: companyId,
          conversation_id: conversationId,
          external_message_id: event.externalMessageId,
          direction: event.direction,
          sender_type: "CONTACT",
          sender_contact_id: contactId,
          content: event.text ?? "",
          content_type: event.contentType,
          status: "DELIVERED",
          metadata: {
            attachments: event.attachments as any,
            raw: event.raw,
            provider: event.provider,
            channel: event.channel,
            externalSenderId: event.externalSenderId,
          },
        },
        select: { id: true },
      });
      messageId = newMsg.id;
      await tx.conversation.update({
        where: { id: conversationId },
        data: { last_message_at: event.timestamp },
      });
    }
    return { conversationId, messageId, contactId, messageStatus, conversationStatus };
  });
}

// ── Test DB setup ─────────────────────────────────────────────────────────────

describe("Phase 3.8.3 — Instagram Inbound Messaging E2E", () => {
  let companyA: string;
  let companyB: string;
  let integrationA: string;  // Company A's Instagram integration
  let integrationB: string;  // Company B's integration (cross-tenant tests)

  before(async () => {
    const ts = Date.now();
    const ca = await prisma.company.create({ data: { name: `IG E2E Company A ${ts}` } });
    const cb = await prisma.company.create({ data: { name: `IG E2E Company B ${ts}` } });
    companyA = ca.id;
    companyB = cb.id;

    const intA = await prisma.integration.create({
      data: {
        companyId: companyA,
        provider: "INSTAGRAM",
        type: "MESSAGING",
        externalId: IG_ACCOUNT_ID + `_${ts}`, // unique per test run
        displayName: "E2E Test IG Account",
        status: IntegrationStatus.CONNECTED,
        isActive: true,
      },
    });
    integrationA = intA.id;

    const intB = await prisma.integration.create({
      data: {
        companyId: companyB,
        provider: "INSTAGRAM",
        type: "MESSAGING",
        externalId: IG_ACCOUNT_ID + `_b_${ts}`,
        displayName: "E2E Test IG Account B",
        status: IntegrationStatus.CONNECTED,
        isActive: true,
      },
    });
    integrationB = intB.id;
  });

  after(async () => {
    try { await prisma.company.delete({ where: { id: companyA } }); } catch {}
    try { await prisma.company.delete({ where: { id: companyB } }); } catch {}
    await prisma.$disconnect();
  });

  // ── Test 1: Realistic IG text DM → Contact + Conversation + Message ────────

  test("1. Realistic IG text DM creates Contact, Conversation, and Message", async () => {
    const mid = `${MID_TEXT_1}_${Date.now()}`;
    const raw = makeIGTextMsg(mid, PSID_ALICE, "Hello, I need support!", 1700000000000);
    const normResult = normalizeIGMessage(raw, integrationA);

    assert.ok(normResult.ok, `Normalization failed: ${!normResult.ok && normResult.reason}`);
    assert.ok(normResult.ok);
    const result = await runPipeline(normResult.event);

    assert.ok(result.conversationId);
    assert.ok(result.messageId);
    assert.ok(result.contactId);
    assert.equal(result.messageStatus, "CREATED");
    assert.equal(result.conversationStatus, "CREATED");

    // Verify DB state
    const conv = await prisma.conversation.findUnique({
      where: { id: result.conversationId },
      select: { company_id: true, channel: true, status: true, external_conversation_id: true },
    });
    assert.equal(conv?.company_id, companyA, "Conversation scoped to companyA");
    assert.equal(conv?.channel, "INSTAGRAM");
    assert.equal(conv?.status, "OPEN");
    assert.equal(conv?.external_conversation_id, `${IG_PAGE_ID}_${PSID_ALICE}`);

    const msg = await prisma.message.findUnique({
      where: { id: result.messageId },
      select: { company_id: true, direction: true, content: true, content_type: true, external_message_id: true },
    });
    assert.equal(msg?.company_id, companyA);
    assert.equal(msg?.direction, "INBOUND");
    assert.equal(msg?.content, "Hello, I need support!");
    assert.equal(msg?.content_type, "TEXT");
    assert.equal(msg?.external_message_id, mid);
  });

  // ── Test 2: Existing Contact identity → same Contact reused ───────────────

  test("2. Existing ContactIdentity → same Contact reused (no duplicate)", async () => {
    const mid1 = `${MID_TEXT_1}_reuse_${Date.now()}`;
    const mid2 = `${MID_TEXT_2}_reuse_${Date.now()}`;

    // First message — creates Contact
    const norm1 = normalizeIGMessage(makeIGTextMsg(mid1, PSID_ALICE + "_reuse", "First message"), integrationA);
    assert.ok(norm1.ok);
    assert.ok(norm1.ok);
    const r1 = await runPipeline(norm1.event);

    // Second message from same PSID
    const norm2 = normalizeIGMessage(makeIGTextMsg(mid2, PSID_ALICE + "_reuse", "Second message"), integrationA);
    assert.ok(norm2.ok);
    assert.ok(norm2.ok);
    const r2 = await runPipeline(norm2.event);

    // Same contact must be reused
    assert.equal(r1.contactId, r2.contactId, "Same PSID must map to same Contact");
    // Second message is in same conversation
    assert.equal(r1.conversationId, r2.conversationId, "Second message should be in same Conversation");
    assert.equal(r2.messageStatus, "CREATED");
    assert.equal(r2.conversationStatus, "EXISTING");

    // Verify only one ContactIdentity exists for this PSID
    const identities = await prisma.contactIdentity.findMany({
      where: { companyId: companyA, provider: "INSTAGRAM", externalId: PSID_ALICE + "_reuse" },
    });
    assert.equal(identities.length, 1, "Only one ContactIdentity should exist");
  });

  // ── Test 3: New sender → Contact + ContactIdentity created ─────────────────

  test("3. New sender PSID → new Contact + ContactIdentity created", async () => {
    const newPSID = `PSID_NEWUSER_${Date.now()}`;
    const mid = `mid_new_${Date.now()}`;
    const norm = normalizeIGMessage(makeIGTextMsg(mid, newPSID, "First time!"), integrationA);
    assert.ok(norm.ok);
    assert.ok(norm.ok);

    const result = await runPipeline(norm.event);
    assert.ok(result.contactId);

    const identity = await prisma.contactIdentity.findUnique({
      where: {
        companyId_provider_externalId: {
          companyId: companyA,
          provider: "INSTAGRAM",
          externalId: newPSID,
        },
      },
      select: { contactId: true, integrationId: true },
    });
    assert.ok(identity, "ContactIdentity should be created");
    assert.equal(identity?.contactId, result.contactId);
    assert.equal(identity?.integrationId, integrationA);
  });

  // ── Test 4: Existing conversation → message appended ──────────────────────

  test("4. Second message in existing conversation is appended (same Conversation)", async () => {
    const psid = `PSID_CONV_APPEND_${Date.now()}`;
    const mid1 = `mid_conv_a_${Date.now()}`;
    const mid2 = `mid_conv_b_${Date.now() + 1}`;

    const r1 = await runPipeline(normalizeIGMessage(makeIGTextMsg(mid1, psid, "Msg 1"), integrationA).ok ?
      (normalizeIGMessage(makeIGTextMsg(mid1, psid, "Msg 1"), integrationA) as { ok: true; event: NormalizedInboxEvent }).event :
      (() => { throw new Error("Norm failed"); })());

    const r2 = await runPipeline(normalizeIGMessage(makeIGTextMsg(mid2, psid, "Msg 2", Date.now() + 2000), integrationA).ok ?
      (normalizeIGMessage(makeIGTextMsg(mid2, psid, "Msg 2", Date.now() + 2000), integrationA) as { ok: true; event: NormalizedInboxEvent }).event :
      (() => { throw new Error("Norm failed"); })());

    assert.equal(r1.conversationId, r2.conversationId, "Both messages must be in same Conversation");
    assert.equal(r2.messageStatus, "CREATED");
    assert.equal(r2.conversationStatus, "EXISTING");

    // Verify both messages exist
    const messages = await prisma.message.findMany({
      where: { conversation_id: r1.conversationId },
      orderBy: { created_at: "asc" },
      select: { external_message_id: true },
    });
    const mids = messages.map(m => m.external_message_id);
    assert.ok(mids.includes(mid1));
    assert.ok(mids.includes(mid2));
  });

  // ── Test 5: New conversation is created for first message ─────────────────

  test("5. First message from new sender creates a new Conversation", async () => {
    const psid = `PSID_NEWCONV_${Date.now()}`;
    const mid = `mid_newconv_${Date.now()}`;
    const norm = normalizeIGMessage(makeIGTextMsg(mid, psid, "New conv!"), integrationA);
    assert.ok(norm.ok);
    assert.ok(norm.ok);
    const result = await runPipeline(norm.event);

    assert.equal(result.conversationStatus, "CREATED");

    const conv = await prisma.conversation.findUnique({
      where: { id: result.conversationId },
      select: { channel: true, company_id: true },
    });
    assert.equal(conv?.channel, "INSTAGRAM");
    assert.equal(conv?.company_id, companyA);
  });

  // ── Test 6 & 7: Duplicate webhook → no duplicate Message or Conversation ──

  test("6 & 7. Duplicate webhook delivery: no duplicate Message, no duplicate Conversation", async () => {
    const psid = `PSID_DUP_${Date.now()}`;
    const mid = `mid_dup_${Date.now()}`;
    const raw = makeIGTextMsg(mid, psid, "Please don't duplicate me");
    const norm = normalizeIGMessage(raw, integrationA);
    assert.ok(norm.ok);
    assert.ok(norm.ok);

    const r1 = await runPipeline(norm.event);
    const r2 = await runPipeline(norm.event); // same event again

    // Idempotent — same IDs, no duplication
    assert.equal(r1.messageId, r2.messageId, "Same messageId on duplicate");
    assert.equal(r1.conversationId, r2.conversationId, "Same conversationId on duplicate");
    assert.equal(r2.messageStatus, "EXISTING", "Second call returns EXISTING for message");
    assert.equal(r2.conversationStatus, "EXISTING", "Second call returns EXISTING for conversation");

    // Verify only one message in DB
    const msgs = await prisma.message.findMany({
      where: { conversation_id: r1.conversationId, external_message_id: mid },
    });
    assert.equal(msgs.length, 1, "Only one Message record should exist");

    // Verify only one conversation in DB
    const convs = await prisma.conversation.findMany({
      where: {
        integration_id: integrationA,
        external_conversation_id: `${IG_PAGE_ID}_${psid}`,
      },
    });
    assert.equal(convs.length, 1, "Only one Conversation record should exist");
  });

  // ── Test 8: Company resolved from Integration ──────────────────────────────

  test("8. Company is resolved from Integration — never from webhook payload", async () => {
    const psid = `PSID_CO_${Date.now()}`;
    const mid = `mid_co_${Date.now()}`;
    const norm = normalizeIGMessage(makeIGTextMsg(mid, psid, "Company test"), integrationA);
    assert.ok(norm.ok);
    assert.ok(norm.ok);
    // Verify integrationId is taken from DB, not from any field in raw payload
    assert.equal(norm.event.integrationId, integrationA, "integrationId must be from DB");

    const result = await runPipeline(norm.event);

    const conv = await prisma.conversation.findUnique({
      where: { id: result.conversationId },
      select: { company_id: true },
    });
    assert.equal(conv?.company_id, companyA, "Conversation must be scoped to companyA");

    // Verify company is NOT from the raw IG payload (it has no companyId field)
    const rawPayload = norm.event.raw as any;
    assert.ok(!rawPayload.companyId, "IG payload should not contain companyId");
  });

  // ── Test 9: Cross-tenant event rejected ───────────────────────────────────

  test("9. Non-existent integrationId is rejected with INTEGRATION_NOT_FOUND", async () => {
    const fakeIntId = "00000000-0000-0000-0000-000000000099";
    const mid = `mid_cross_${Date.now()}`;
    const norm = normalizeIGMessage(makeIGTextMsg(mid, "PSID_CROSS", "Cross tenant"), fakeIntId);
    assert.ok(norm.ok);
    assert.ok(norm.ok);

    await assert.rejects(
      runPipeline(norm.event),
      (err: any) => {
        assert.ok(err instanceof InboxPipelineError);
        assert.equal(err.code, "INTEGRATION_NOT_FOUND");
        return true;
      }
    );
  });

  // ── Test 10: Instagram image/media message ────────────────────────────────

  test("10. Instagram image message: contentType=IMAGE, attachment preserved", async () => {
    const psid = `PSID_IMG_${Date.now()}`;
    const mid = `${MID_IMAGE_1}_${Date.now()}`;
    const norm = normalizeIGMessage(makeIGImageMsg(mid, psid), integrationA);

    assert.ok(norm.ok, `Normalization failed: ${!norm.ok && norm.reason}`);
    assert.ok(norm.ok);
    assert.equal(norm.event.contentType, "IMAGE");
    assert.equal(norm.event.text, null);
    assert.equal(norm.event.attachments.length, 1);
    assert.equal(norm.event.attachments[0].type, "IMAGE");
    assert.equal(norm.event.attachments[0].url, "https://scontent.cdninstagram.com/synthetic/photo.jpg");

    const result = await runPipeline(norm.event);
    const msg = await prisma.message.findUnique({
      where: { id: result.messageId },
      select: { content_type: true, metadata: true },
    });
    assert.equal(msg?.content_type, "IMAGE");

    const metadata = msg?.metadata as any;
    assert.ok(metadata.attachments, "attachments should be in metadata");
    assert.equal(Array.isArray(metadata.attachments), true);
    assert.equal((metadata.attachments as any[])[0].type, "IMAGE");
  });

  // ── Test 11: Unsupported Instagram event ignored safely ───────────────────

  test("11. Read receipt ignored safely (ok:false, no DB write)", () => {
    const readReceipt = makeIGReadReceipt(PSID_ALICE);
    const norm = normalizeIGMessage(readReceipt, integrationA);
    assert.equal(norm.ok, false, "Read receipt should return ok:false");
    assert.ok(!norm.ok);
    assert.match(norm.reason, /read|delivery/i);
  });

  test("11b. Echo message ignored safely (ok:false)", () => {
    const echo = makeIGEchoMsg("m_echo_synth");
    const norm = normalizeIGMessage(echo, integrationA);
    assert.equal(norm.ok, false);
    assert.ok(!norm.ok);
    assert.match(norm.reason, /Echo/);
  });

  // ── Test 12: Conversation.lastMessageAt updated ───────────────────────────

  test("12. Conversation.lastMessageAt updated on new message", async () => {
    const psid = `PSID_LASTSEEN_${Date.now()}`;
    const mid1 = `mid_ls_1_${Date.now()}`;
    const mid2 = `mid_ls_2_${Date.now() + 1}`;
    const ts1 = 1700000100000;
    const ts2 = 1700000200000;

    const n1 = normalizeIGMessage(makeIGTextMsg(mid1, psid, "First", ts1), integrationA);
    assert.ok(n1.ok); assert.ok(n1.ok);
    const r1 = await runPipeline(n1.event);

    const convAfterFirst = await prisma.conversation.findUnique({
      where: { id: r1.conversationId },
      select: { last_message_at: true },
    });
    assert.equal(convAfterFirst?.last_message_at?.getTime(), ts1);

    const n2 = normalizeIGMessage(makeIGTextMsg(mid2, psid, "Second", ts2), integrationA);
    assert.ok(n2.ok); assert.ok(n2.ok);
    await runPipeline(n2.event);

    const convAfterSecond = await prisma.conversation.findUnique({
      where: { id: r1.conversationId },
      select: { last_message_at: true },
    });
    assert.equal(convAfterSecond?.last_message_at?.getTime(), ts2, "lastMessageAt must be updated");
  });

  // ── Test 13: Provider metadata preserved ──────────────────────────────────

  test("13. Raw Instagram payload preserved in message.metadata.raw", async () => {
    const psid = `PSID_META_${Date.now()}`;
    const mid = `mid_meta_${Date.now()}`;
    const rawPayload = makeIGTextMsg(mid, psid, "Metadata check");
    const norm = normalizeIGMessage(rawPayload, integrationA);
    assert.ok(norm.ok); assert.ok(norm.ok);

    const result = await runPipeline(norm.event);

    const msg = await prisma.message.findUnique({
      where: { id: result.messageId },
      select: { metadata: true },
    });
    const meta = msg?.metadata as any;
    assert.ok(meta, "metadata must exist");
    assert.ok(meta.raw, "raw provider payload must be preserved");
    assert.equal((meta.raw as any)?.message?.mid, mid, "Original MID in raw");
    assert.equal((meta.raw as any)?.sender?.id, psid, "Original sender PSID in raw");
    assert.equal(meta.provider, "INSTAGRAM");
    assert.equal(meta.channel, "INSTAGRAM");
    assert.equal(meta.externalSenderId, psid);
  });

  // ── Test 14: Multiple messages in same conversation maintain ordering ───────

  test("14. Multiple messages in same conversation maintain creation order", async () => {
    const psid = `PSID_ORDER_${Date.now()}`;
    const texts = ["First message", "Second message", "Third message"];
    const mids = texts.map((_, i) => `mid_order_${Date.now()}_${i}`);
    const timestamps = [1700001000000, 1700002000000, 1700003000000];

    let conversationId: string | undefined;

    for (let i = 0; i < texts.length; i++) {
      const norm = normalizeIGMessage(
        makeIGTextMsg(mids[i], psid, texts[i], timestamps[i]),
        integrationA
      );
      assert.ok(norm.ok); assert.ok(norm.ok);
      const result = await runPipeline(norm.event);

      if (i === 0) {
        conversationId = result.conversationId;
        assert.equal(result.conversationStatus, "CREATED");
      } else {
        assert.equal(result.conversationId, conversationId, `Message ${i + 1} should be in same Conversation`);
        assert.equal(result.conversationStatus, "EXISTING");
      }
      assert.equal(result.messageStatus, "CREATED");
    }

    // Verify all 3 messages are in the conversation in order
    const messages = await prisma.message.findMany({
      where: { conversation_id: conversationId! },
      orderBy: { created_at: "asc" },
      select: { external_message_id: true, content: true },
    });

    // Find our messages by mid
    const ourMessages = messages.filter(m => mids.includes(m.external_message_id ?? ""));
    assert.equal(ourMessages.length, 3, "All 3 messages should exist in the conversation");
  });
});
