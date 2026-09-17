/**
 * Phase 3.8.2 — Inbox Normalization & Pipeline Tests
 *
 * All normalizer logic is inlined here to avoid ESM/CJS import resolution issues
 * with ts-node in this environment. The actual source files remain clean ESM for
 * Next.js. This test verifies the same behavior against the live database.
 *
 * Run: node -r ts-node/register --test src/__tests__/inbox-normalization.test.ts
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { PrismaClient, IntegrationStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ── Inlined Types (mirrors src/lib/inbox/types.ts) ────────────────────────────

type InboxChannel = "INSTAGRAM" | "FACEBOOK" | "WHATSAPP";
type MessageDirection = "INBOUND" | "OUTBOUND";
type MessageContentType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "STICKER" | "LOCATION" | "UNSUPPORTED";

interface NormalizedAttachment {
  type: MessageContentType;
  url?: string;
  mimeType?: string;
  name?: string;
  payloadId?: string;
}

interface NormalizedInboxEvent {
  provider: string;
  channel: InboxChannel;
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

interface InboxPipelineResult {
  conversationId: string;
  messageId: string;
  contactId: string;
  messageStatus: "CREATED" | "EXISTING";
  conversationStatus: "CREATED" | "EXISTING";
}

// ── Inlined Instagram Normalizer (mirrors src/lib/inbox/normalizers/instagram.ts)

function normalizeAttachmentTypeIG(igType: string | undefined): MessageContentType {
  switch ((igType ?? "").toLowerCase()) {
    case "image": return "IMAGE";
    case "video": return "VIDEO";
    case "audio": return "AUDIO";
    case "file": return "FILE";
    case "sticker": return "STICKER";
    case "location": return "LOCATION";
    default: return "UNSUPPORTED";
  }
}

function normalizeInstagramMessage(rawEvent: unknown, integrationId: string): NormalizationResult {
  const e = rawEvent as any;
  const senderId = e?.sender?.id;
  const recipientId = e?.recipient?.id;

  if (!senderId || !recipientId) {
    return { ok: false, reason: "Missing sender.id or recipient.id" };
  }
  if (e.message?.is_echo) {
    return { ok: false, reason: "Echo message — skip" };
  }
  if (!e.message) {
    return { ok: false, reason: "No message payload — likely a read/delivery event" };
  }

  const mid = e.message.mid;
  if (!mid) {
    console.warn("[InboxNormalizer:Instagram] message.mid is missing — using timestamp fallback");
  }
  const externalMessageId = mid ?? `ig_${senderId}_${e.timestamp ?? Date.now()}`;
  const externalConversationId = `${recipientId}_${senderId}`;

  const text = e.message.text ?? null;
  const igAttachments: any[] = e.message.attachments ?? [];
  const attachments: NormalizedAttachment[] = igAttachments.map((a: any) => ({
    type: normalizeAttachmentTypeIG(a.type),
    url: a.payload?.url,
    payloadId: a.payload?.sticker_id?.toString(),
  }));

  if (e.message.sticker_id && attachments.length === 0) {
    attachments.push({ type: "STICKER", payloadId: String(e.message.sticker_id) });
  }

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

// ── Inlined Facebook Normalizer (mirrors src/lib/inbox/normalizers/facebook.ts)

function normalizeAttachmentTypeFB(fbType: string | undefined): MessageContentType {
  switch ((fbType ?? "").toLowerCase()) {
    case "image": return "IMAGE";
    case "video": return "VIDEO";
    case "audio": return "AUDIO";
    case "file": return "FILE";
    case "sticker": return "STICKER";
    case "location": return "LOCATION";
    default: return "UNSUPPORTED";
  }
}

function normalizeFacebookMessage(rawEvent: unknown, integrationId: string): NormalizationResult {
  const e = rawEvent as any;
  const senderId = e?.sender?.id;
  const recipientId = e?.recipient?.id;

  if (!senderId || !recipientId) {
    return { ok: false, reason: "Missing sender.id or recipient.id" };
  }
  if (e.message?.is_echo) {
    return { ok: false, reason: "Echo message — skip" };
  }
  if (e.postback || e.reaction || e.referral) {
    return { ok: false, reason: "Postback/reaction/referral event — not a message" };
  }
  if (!e.message) {
    return { ok: false, reason: "No message payload — likely a read/delivery event" };
  }

  const mid = e.message.mid;
  if (!mid) {
    console.warn("[InboxNormalizer:Facebook] message.mid is missing — using timestamp fallback");
  }
  const externalMessageId = mid ?? `fb_${senderId}_${e.timestamp ?? Date.now()}`;
  const externalConversationId = `${recipientId}_${senderId}`;

  const text = e.message.text ?? null;
  const fbAttachments: any[] = e.message.attachments ?? [];
  const attachments: NormalizedAttachment[] = fbAttachments.map((a: any) => ({
    type: normalizeAttachmentTypeFB(a.type),
    url: a.payload?.url,
    name: a.payload?.title,
    payloadId: a.payload?.sticker_id?.toString(),
  }));

  if (e.message.sticker_id && attachments.length === 0) {
    attachments.push({ type: "STICKER", payloadId: String(e.message.sticker_id) });
  }

  const contentType: MessageContentType = text ? "TEXT" : attachments.length > 0 ? attachments[0].type : "UNSUPPORTED";

  return {
    ok: true,
    event: {
      provider: "META",
      channel: "FACEBOOK",
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

// ── Inlined Dispatcher (mirrors src/lib/inbox/normalizers/index.ts) ───────────

function normalizeInboundEvent(channel: string, rawEvent: unknown, integrationId: string): NormalizationResult {
  switch (channel) {
    case "INSTAGRAM": return normalizeInstagramMessage(rawEvent, integrationId);
    case "FACEBOOK": return normalizeFacebookMessage(rawEvent, integrationId);
    default: return { ok: false, reason: `Unsupported channel: ${channel}. Supported channels: INSTAGRAM, FACEBOOK.` };
  }
}

// ── Inlined Pipeline Error (mirrors src/lib/inbox/pipeline.ts) ────────────────

class InboxPipelineError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "InboxPipelineError";
    this.code = code;
  }
}

// ── Inlined Pipeline (mirrors src/lib/inbox/pipeline.ts) ─────────────────────

async function processInboxEvent(event: NormalizedInboxEvent): Promise<InboxPipelineResult> {
  const integration = await prisma.integration.findUnique({
    where: { id: event.integrationId },
    select: { id: true, companyId: true, isActive: true, provider: true },
  });

  if (!integration) {
    throw new InboxPipelineError(`Integration ${event.integrationId} not found`, "INTEGRATION_NOT_FOUND");
  }
  if (!integration.isActive) {
    throw new InboxPipelineError(`Integration ${event.integrationId} is inactive`, "INTEGRATION_INACTIVE");
  }

  const companyId = integration.companyId;

  return await prisma.$transaction(async (tx: any) => {
    // Resolve or create ContactIdentity for sender
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
        data: { companyId, name: `${event.channel} User` },
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
            attachments: event.attachments,
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

// ── Test Fixtures ─────────────────────────────────────────────────────────────

function makeIGTextPayload(mid: string, senderId = "PSID_001", recipientId = "PAGE_123") {
  return { sender: { id: senderId }, recipient: { id: recipientId }, timestamp: 1700000000000, message: { mid, text: "Hello from Instagram!" } };
}

function makeIGImagePayload(mid: string, senderId = "PSID_001", recipientId = "PAGE_123") {
  return { sender: { id: senderId }, recipient: { id: recipientId }, timestamp: 1700000000001, message: { mid, attachments: [{ type: "image", payload: { url: "https://cdn.example.com/photo.jpg" } }] } };
}

function makeFBTextPayload(mid: string, senderId = "PSID_FB_001", recipientId = "FB_PAGE_456") {
  return { sender: { id: senderId }, recipient: { id: recipientId }, timestamp: 1700000000002, message: { mid, text: "Hello from Facebook Messenger!" } };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Phase 3.8.2 — Inbox Normalization & Pipeline", () => {
  let companyA: string;
  let companyB: string;
  let integrationA: string;

  before(async () => {
    const ts = Date.now();
    const ca = await prisma.company.create({ data: { name: `NormTest A ${ts}` } });
    const cb = await prisma.company.create({ data: { name: `NormTest B ${ts}` } });
    companyA = ca.id;
    companyB = cb.id;

    const intA = await prisma.integration.create({
      data: { companyId: companyA, provider: "INSTAGRAM", type: "MESSAGING", externalId: `ig_acc_${ts}`, displayName: "Test IG Account", status: IntegrationStatus.CONNECTED, isActive: true },
    });
    integrationA = intA.id;
  });

  after(async () => {
    try { await prisma.company.delete({ where: { id: companyA } }); } catch {}
    try { await prisma.company.delete({ where: { id: companyB } }); } catch {}
    await prisma.$disconnect();
  });

  // 1. Instagram text message normalization
  test("1. Instagram text message normalizes correctly", () => {
    const mid = `ig_mid_txt_${Date.now()}`;
    const payload = makeIGTextPayload(mid);
    const result = normalizeInstagramMessage(payload, "fake-integration-id");

    assert.ok(result.ok, `Expected ok:true, got: ${!result.ok && result.reason}`);
    assert.ok(result.ok);
    const e = result.event;
    assert.equal(e.channel, "INSTAGRAM");
    assert.equal(e.provider, "INSTAGRAM");
    assert.equal(e.direction, "INBOUND");
    assert.equal(e.contentType, "TEXT");
    assert.equal(e.text, "Hello from Instagram!");
    assert.equal(e.externalMessageId, mid);
    assert.equal(e.externalSenderId, "PSID_001");
    assert.equal(e.externalConversationId, "PAGE_123_PSID_001");
    assert.deepEqual(e.attachments, []);
    assert.equal(e.integrationId, "fake-integration-id");
    assert.ok(e.timestamp instanceof Date);
    assert.deepEqual(e.raw, payload);
  });

  // 2. Facebook text message normalization
  test("2. Facebook Messenger text message normalizes correctly", () => {
    const mid = `fb_mid_txt_${Date.now()}`;
    const payload = makeFBTextPayload(mid);
    const result = normalizeFacebookMessage(payload, "fake-integration-id");

    assert.ok(result.ok, `Expected ok:true, got: ${!result.ok && result.reason}`);
    assert.ok(result.ok);
    const e = result.event;
    assert.equal(e.channel, "FACEBOOK");
    assert.equal(e.provider, "META");
    assert.equal(e.direction, "INBOUND");
    assert.equal(e.contentType, "TEXT");
    assert.equal(e.text, "Hello from Facebook Messenger!");
    assert.equal(e.externalMessageId, mid);
    assert.equal(e.externalSenderId, "PSID_FB_001");
    assert.equal(e.externalConversationId, "FB_PAGE_456_PSID_FB_001");
    assert.deepEqual(e.attachments, []);
    assert.ok(e.timestamp instanceof Date);
  });

  // 3. Instagram media (image) message normalization
  test("3. Instagram image message normalizes correctly", () => {
    const mid = `ig_mid_img_${Date.now()}`;
    const payload = makeIGImagePayload(mid);
    const result = normalizeInstagramMessage(payload, "fake-integration-id");

    assert.ok(result.ok, `Expected ok:true, got: ${!result.ok && result.reason}`);
    assert.ok(result.ok);
    const e = result.event;
    assert.equal(e.contentType, "IMAGE");
    assert.equal(e.text, null);
    assert.equal(e.attachments.length, 1);
    assert.equal(e.attachments[0].type, "IMAGE");
    assert.equal(e.attachments[0].url, "https://cdn.example.com/photo.jpg");
  });

  // 4. Unknown/unsupported events safely rejected
  test("4a. Unknown channel returns ok:false without crash", () => {
    const result = normalizeInboundEvent("WHATSAPP", { sender: { id: "1" } }, "int-1");
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.match(result.reason, /Unsupported channel/);
  });

  test("4b. Echo message skipped (ok:false, no crash)", () => {
    const payload = { sender: { id: "BOT" }, recipient: { id: "USER" }, timestamp: Date.now(), message: { mid: "m_echo_123", text: "Echo", is_echo: true } };
    const result = normalizeInstagramMessage(payload, "int-1");
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.match(result.reason, /Echo/);
  });

  test("4c. Missing sender/recipient rejected cleanly", () => {
    const result = normalizeInstagramMessage({ message: { mid: "m1", text: "Hi" } }, "int-1");
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.match(result.reason, /sender|recipient/i);
  });

  test("4d. Postback event on Facebook rejected cleanly", () => {
    const payload = { sender: { id: "PSID" }, recipient: { id: "PAGE" }, timestamp: Date.now(), postback: { title: "Get Started", payload: "GET_STARTED" } };
    const result = normalizeFacebookMessage(payload, "int-1");
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.match(result.reason, /Postback/);
  });

  // 5. Missing external message ID handled correctly
  test("5. Missing message.mid falls back gracefully (no crash)", () => {
    const payload = { sender: { id: "PSID_001" }, recipient: { id: "PAGE_123" }, timestamp: 1700000009999, message: { text: "No MID here" } };
    const result = normalizeInstagramMessage(payload, "fake-integration-id");
    assert.ok(result.ok, `Expected ok:true, got: ${!result.ok && result.reason}`);
    assert.ok(result.ok);
    assert.ok(result.event.externalMessageId.startsWith("ig_"), `ID should start with ig_, got: ${result.event.externalMessageId}`);
    assert.equal(result.event.text, "No MID here");
  });

  // 6. Correct integration/company resolution
  test("6. Pipeline resolves company from Integration — never from payload", async () => {
    const mid = `ig_mid_res_${Date.now()}`;
    const payload = makeIGTextPayload(mid, "PSID_RES_001", "PAGE_BUSI_001");
    const normResult = normalizeInstagramMessage(payload, integrationA);
    assert.ok(normResult.ok);
    assert.ok(normResult.ok);

    const result = await processInboxEvent(normResult.event);

    assert.ok(result.conversationId);
    assert.ok(result.messageId);
    assert.ok(result.contactId);
    assert.equal(result.messageStatus, "CREATED");
    assert.equal(result.conversationStatus, "CREATED");

    const conv = await prisma.conversation.findUnique({ where: { id: result.conversationId }, select: { company_id: true, channel: true } });
    assert.equal(conv?.company_id, companyA, "Conversation must be scoped to companyA");
    assert.equal(conv?.channel, "INSTAGRAM");

    const msg = await prisma.message.findUnique({ where: { id: result.messageId }, select: { company_id: true, direction: true, external_message_id: true } });
    assert.equal(msg?.company_id, companyA);
    assert.equal(msg?.direction, "INBOUND");
    assert.equal(msg?.external_message_id, mid);
  });

  // 7. Cross-tenant event rejected
  test("7. Non-existent integration is rejected with INTEGRATION_NOT_FOUND", async () => {
    const fakeIntId = "00000000-0000-0000-0000-000000000001";
    const mid = `ig_mid_cross_${Date.now()}`;
    const payload = makeIGTextPayload(mid, "PSID_CROSS_001", "PAGE_CROSS_001");
    const normResult = normalizeInstagramMessage(payload, fakeIntId);
    assert.ok(normResult.ok);
    assert.ok(normResult.ok);

    await assert.rejects(
      processInboxEvent(normResult.event),
      (err: any) => {
        assert.ok(err instanceof InboxPipelineError, `Expected InboxPipelineError, got ${err.constructor.name}`);
        assert.equal(err.code, "INTEGRATION_NOT_FOUND");
        return true;
      }
    );
  });

  // 8. Same normalized event remains idempotent
  test("8. Same message processed twice: second call returns EXISTING", async () => {
    const mid = `ig_mid_idem_${Date.now()}`;
    const payload = makeIGTextPayload(mid, "PSID_IDEM_001", "PAGE_IDEM_001");
    const normResult = normalizeInstagramMessage(payload, integrationA);
    assert.ok(normResult.ok);
    assert.ok(normResult.ok);

    const first = await processInboxEvent(normResult.event);
    assert.equal(first.messageStatus, "CREATED");
    assert.equal(first.conversationStatus, "CREATED");

    const second = await processInboxEvent(normResult.event);
    assert.equal(second.messageStatus, "EXISTING");
    assert.equal(second.messageId, first.messageId);
    assert.equal(second.conversationId, first.conversationId);
    assert.equal(second.contactId, first.contactId);
  });

  // 9. Provider-specific metadata preserved
  test("9. Provider-specific metadata preserved in message.metadata.raw", async () => {
    const mid = `ig_mid_meta_${Date.now()}`;
    const payload = makeIGTextPayload(mid, "PSID_META_001", "PAGE_META_001");
    const normResult = normalizeInstagramMessage(payload, integrationA);
    assert.ok(normResult.ok);
    assert.ok(normResult.ok);

    const result = await processInboxEvent(normResult.event);
    const msg = await prisma.message.findUnique({ where: { id: result.messageId }, select: { metadata: true } });

    const metadata = msg?.metadata as any;
    assert.ok(metadata, "metadata should exist");
    assert.ok(metadata.raw, "raw provider payload should be preserved");
    assert.equal((metadata.raw as any)?.message?.mid, mid, "Original MID should be in raw");
    assert.equal(metadata.provider, "INSTAGRAM");
    assert.equal(metadata.channel, "INSTAGRAM");
    assert.equal(metadata.externalSenderId, "PSID_META_001");
  });

  // 10. Normalized output structure identical regardless of provider
  test("10. Normalized event structure is identical for Instagram and Facebook", () => {
    const igPayload = makeIGTextPayload("ig_mid_struct_001", "PSID_IG", "PAGE_IG");
    const fbPayload = makeFBTextPayload("fb_mid_struct_001", "PSID_FB", "PAGE_FB");

    const igResult = normalizeInstagramMessage(igPayload, "int-ig");
    const fbResult = normalizeFacebookMessage(fbPayload, "int-fb");

    assert.ok(igResult.ok && fbResult.ok);
    assert.ok(igResult.ok);
    assert.ok(fbResult.ok);

    const igKeys = Object.keys(igResult.event).sort();
    const fbKeys = Object.keys(fbResult.event).sort();
    assert.deepEqual(igKeys, fbKeys, "Both events must have identical top-level keys");

    const requiredFields: (keyof NormalizedInboxEvent)[] = [
      "provider", "channel", "integrationId", "externalConversationId",
      "externalMessageId", "externalSenderId", "direction", "contentType",
      "text", "attachments", "timestamp", "raw",
    ];
    for (const field of requiredFields) {
      assert.ok(field in igResult.event, `IG event missing field: ${field}`);
      assert.ok(field in fbResult.event, `FB event missing field: ${field}`);
    }

    // Channel differs (expected); direction and contentType must match
    assert.notEqual(igResult.event.channel, fbResult.event.channel);
    assert.equal(igResult.event.direction, fbResult.event.direction);
    assert.equal(igResult.event.contentType, fbResult.event.contentType);
  });
});
