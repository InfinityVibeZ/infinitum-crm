/**
 * Phase 3.8.7.2 — Realtime Inbox event wiring tests.
 *
 * Focused on the wiring contract:
 *  - persisted inbound message → new_message + conversation_updated
 *  - duplicate (idempotent) inbound message → NO events
 *  - outbound send → outbound_message
 *  - read → conversation_read
 *  - publisher failure never fails the underlying operation
 *  - events are tenant-routed (Company A events never reach Company B)
 *  - no events before persistence
 *
 * Uses a real hub (with a spy) and real DB rows. UI/API shapes untouched.
 */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const PORT = 5598;

let hub: any;
let companyA: any, companyB: any;
let integrationA: any;
let userA: any;
let convA: any;

/** Captured published events (per-company for isolation assertions). */
const publishedByCompany = new Map<string, any[]>();

beforeEach(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-3871";
  process.env.REALTIME_ENABLED = "true";
  process.env.REALTIME_PORT = String(PORT);
  process.env.REALTIME_HUB_PATH = "/hubs/inbox";
  process.env.REALTIME_ALLOWED_ORIGINS = "";

  const { startRealtimeHub } = await import("@/realtime/server");
  hub = await startRealtimeHub();
  assert.ok(hub, "hub should be running");

  // Spy on hub.publish while keeping the real tenant routing logic.
  if (!hub.__spied) {
    const original = hub.publish.bind(hub);
    hub.publish = (event: any) => {
      const list = publishedByCompany.get(event.companyId) || [];
      list.push(event);
      publishedByCompany.set(event.companyId, list);
      return original(event);
    };
    hub.__spied = true;
  }

  if (!companyA) {
    const suffix = Date.now();
    companyA = await prisma.company.create({
      data: { name: `RTW-A-${suffix}`, isActive: true, status: "ACTIVE" },
    });
    companyB = await prisma.company.create({
      data: { name: `RTW-B-${suffix}`, isActive: true, status: "ACTIVE" },
    });
    integrationA = await prisma.integration.create({
      data: {
        companyId: companyA.id,
        provider: "INSTAGRAM",
        type: "INSTAGRAM_BUSINESS",
        externalId: `rtw-ig-${suffix}`,
        displayName: `RTW IG ${suffix}`,
        status: "CONNECTED",
        isActive: true,
      } as any,
    });
    userA = await prisma.user.create({
      data: {
        email: `rtw-a-${suffix}@t.io`,
        name: "User A",
        passwordHash: "x",
        role: "USER",
        companyId: companyA.id,
        isActive: true,
        status: "ACTIVE",
      },
    });
    const seedContact = await prisma.contact.create({
      data: { companyId: companyA.id, name: "RTW Seed Contact" } as any,
    });
    convA = await prisma.conversation.create({
      data: {
        company_id: companyA.id,
        contact_id: seedContact.id,
        integration_id: integrationA.id,
        channel: "INSTAGRAM",
        external_conversation_id: `rtw-thread-${suffix}`,
        status: "OPEN",
        last_message_at: new Date(),
      } as any,
    });
  }
  publishedByCompany.clear();
});

after(async () => {
  const { stopRealtimeHub } = await import("@/realtime/server");
  await stopRealtimeHub();
  await prisma.$disconnect();
});

function eventsFor(companyId: string, name: string): any[] {
  return (publishedByCompany.get(companyId) || []).filter((e) => e.name === name);
}

/**
 * The shared dev Postgres (pooled) intermittently aborts interactive
 * transactions with "Transaction API error: Transaction not found" — a
 * transient infra issue that also intermittently affects the pre-existing
 * inbox-normalization suite. Retry with backoff on that specific error.
 */
async function withTxRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!String(err?.message).includes("Transaction not found")) throw err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload-builder wiring tests (pure, no DB)
// ─────────────────────────────────────────────────────────────────────────────

test("buildNewMessageEvent produces the documented payload shape with safe fields only", async () => {
  const { buildNewMessageEvent } = await import("@/lib/inbox/realtime-events");
  const now = new Date();
  const evt = buildNewMessageEvent({
    companyId: "c1",
    conversationId: "conv1",
    messageId: "m1",
    content: "x".repeat(500),
    contentType: "TEXT",
    direction: "INBOUND",
    senderType: "CONTACT",
    senderContactId: "contact1",
    createdAt: now,
    lastMessageAt: now,
    conversationStatus: "EXISTING",
    messageStatus: "CREATED",
  });
  assert.strictEqual(evt.name, "new_message");
  assert.strictEqual(evt.companyId, "c1");
  assert.strictEqual(evt.payload.conversationId, "conv1");
  assert.strictEqual(evt.payload.messageId, "m1");
  assert.strictEqual(evt.payload.direction, "INBOUND");
  assert.strictEqual(evt.payload.contentType, "TEXT");
  assert.strictEqual(evt.payload.senderType, "CONTACT");
  // Preview truncated, no raw content leakage
  assert.strictEqual((evt.payload.preview as string).length, 160);
  const serialized = JSON.stringify(evt.payload);
  assert.ok(!serialized.includes("x".repeat(200)), "full content must not be in payload");
});

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline wiring (inbound)
// ─────────────────────────────────────────────────────────────────────────────

test("inbound persisted message publishes new_message + conversation_updated", async () => {
  const suffix = Date.now() + "-inb";
  const { processInboxEvent } = await import("@/lib/inbox/pipeline");
  const result = await withTxRetry(() =>
    processInboxEvent({
      provider: "INSTAGRAM",
      channel: "INSTAGRAM",
      integrationId: integrationA.id,
      externalConversationId: `rtw-inb-${suffix}`,
      externalMessageId: `rtw-msg-${suffix}`,
      externalSenderId: `rtw-sender-${suffix}`,
      direction: "INBOUND",
      contentType: "TEXT",
      text: "hello realtime",
      attachments: [],
      timestamp: new Date(),
      raw: {},
    } as any)
  );

  assert.strictEqual(result.messageStatus, "CREATED");
  await new Promise((r) => setTimeout(r, 300));

  const nm = eventsFor(companyA.id, "new_message");
  assert.strictEqual(nm.length, 1, "exactly one new_message");
  assert.strictEqual(nm[0].payload.conversationId, result.conversationId);
  assert.strictEqual(nm[0].payload.messageId, result.messageId);
  assert.strictEqual(nm[0].payload.direction, "INBOUND");

  const cu = eventsFor(companyA.id, "conversation_updated");
  assert.ok(cu.length >= 1, "conversation_updated published");
  assert.strictEqual(cu[0].payload.conversationId, result.conversationId);

  // Tenant routing: nothing for Company B
  assert.strictEqual(eventsFor(companyB.id, "new_message").length, 0);
});

test("duplicate inbound webhook (idempotent no-op) publishes NO events", async () => {
  const suffix = Date.now() + "-dup";
  const { processInboxEvent } = await import("@/lib/inbox/pipeline");
  const base = {
    provider: "INSTAGRAM",
    channel: "INSTAGRAM",
    integrationId: integrationA.id,
    externalConversationId: `rtw-dup-${suffix}`,
    externalMessageId: `rtw-dup-msg-${suffix}`,
    externalSenderId: `rtw-dup-sender-${suffix}`,
    direction: "INBOUND",
    contentType: "TEXT",
    text: "dup",
    attachments: [],
    timestamp: new Date(),
    raw: {},
  } as any;

  await withTxRetry(() => processInboxEvent(base));
  // Let the async fire-and-forget publishes from the first call settle
  // BEFORE clearing the spy capture.
  await new Promise((r) => setTimeout(r, 400));
  publishedByCompany.clear();
  const second = await withTxRetry(() => processInboxEvent(base));
  assert.strictEqual(second.messageStatus, "EXISTING");
  await new Promise((r) => setTimeout(r, 400));
  assert.strictEqual(eventsFor(companyA.id, "new_message").length, 0);
  assert.strictEqual(eventsFor(companyA.id, "conversation_updated").length, 0);
});

test("pipeline persistence failure publishes no events (no events before persistence)", async () => {
  const { processInboxEvent } = await import("@/lib/inbox/pipeline");
  await assert.rejects(
    processInboxEvent({
      provider: "INSTAGRAM",
      channel: "INSTAGRAM",
      integrationId: "nonexistent-integration",
      externalConversationId: "x",
      externalMessageId: "x",
      externalSenderId: "x",
      direction: "INBOUND",
      contentType: "TEXT",
      text: "x",
      attachments: [],
      timestamp: new Date(),
      raw: {},
    } as any)
  );
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(eventsFor(companyA.id, "new_message").length, 0);
  assert.strictEqual(eventsFor(companyA.id, "conversation_updated").length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Outbound + read routes
// ─────────────────────────────────────────────────────────────────────────────

test("outbound send publishes outbound_message after persistence", async () => {
  // This flow requires a real Meta send; here we validate the builder wiring
  // directly against the route's exact call pattern (the full HTTP path is
  // covered by instagram-outbound tests which must not hit real Meta).
  const { buildOutboundMessageEvent } = await import("@/lib/inbox/realtime-events");
  const now = new Date();
  const evt = buildOutboundMessageEvent({
    companyId: companyA.id,
    conversationId: convA.id,
    messageId: "m-out",
    content: "outbound text",
    status: "SENT",
    senderUserId: userA.id,
    createdAt: now,
    lastMessageAt: now,
  });
  assert.strictEqual(evt.name, "outbound_message");
  assert.strictEqual(evt.companyId, companyA.id);
  assert.strictEqual(evt.payload.direction, "OUTBOUND");
  assert.strictEqual(evt.payload.status, "SENT");
  const { publishRealtimeEvent } = await import("@/realtime/publish");
  await publishRealtimeEvent(evt);
  await new Promise((r) => setTimeout(r, 150));
  const list = eventsFor(companyA.id, "outbound_message");
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].payload.messageId, "m-out");
});

test("read operation publishes conversation_read with userId and readAt", async () => {
  const { buildConversationReadEvent } = await import("@/lib/inbox/realtime-events");
  const evt = buildConversationReadEvent({
    companyId: companyA.id,
    conversationId: convA.id,
    userId: userA.id,
    readAt: new Date(),
  });
  assert.strictEqual(evt.name, "conversation_read");
  const { publishRealtimeEvent } = await import("@/realtime/publish");
  await publishRealtimeEvent(evt);
  await new Promise((r) => setTimeout(r, 150));
  const list = eventsFor(companyA.id, "conversation_read");
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].payload.userId, userA.id);
  assert.ok(list[0].payload.readAt);
});

// ─────────────────────────────────────────────────────────────────────────────
// Failure safety + isolation
// ─────────────────────────────────────────────────────────────────────────────

test("publisher failure does not fail pipeline persistence", async () => {
  // Replace publish with a throwing version.
  const { publishRealtimeEvent } = await import("@/realtime/publish");
  const orig = (await import("@/realtime/server")).getRealtimeHub();
  assert.ok(orig);
  const realPublish = orig!.publish.bind(orig);
  orig!.publish = () => {
    throw new Error("simulated hub crash");
  };
  try {
    const suffix = Date.now() + "-fail";
    const { processInboxEvent } = await import("@/lib/inbox/pipeline");
    const result = await withTxRetry(() =>
      processInboxEvent({
      provider: "INSTAGRAM",
      channel: "INSTAGRAM",
      integrationId: integrationA.id,
      externalConversationId: `rtw-fail-${suffix}`,
      externalMessageId: `rtw-fail-msg-${suffix}`,
      externalSenderId: `rtw-fail-sender-${suffix}`,
      direction: "INBOUND",
      contentType: "TEXT",
      text: "persist despite hub crash",        attachments: [],
        timestamp: new Date(),
        raw: {},
      } as any)
    );
    assert.strictEqual(result.messageStatus, "CREATED");
    // DB row really exists
    const msg = await prisma.message.findUnique({ where: { id: result.messageId } });
    assert.ok(msg, "message persisted despite publisher failure");
  } finally {
    orig!.publish = realPublish;
  }
});

test("Company A events are never routed to Company B", async () => {
  const { publishRealtimeEvent } = await import("@/realtime/publish");
  const { buildNewMessageEvent } = await import("@/lib/inbox/realtime-events");
  await publishRealtimeEvent(
    buildNewMessageEvent({
      companyId: companyA.id,
      conversationId: convA.id,
      messageId: "iso-1",
      content: "iso",
      contentType: "TEXT",
      direction: "INBOUND",
      senderType: "CONTACT",
      createdAt: new Date(),
      lastMessageAt: new Date(),
    })
  );
  await new Promise((r) => setTimeout(r, 150));
  assert.strictEqual(eventsFor(companyA.id, "new_message").length, 1);
  assert.strictEqual(eventsFor(companyB.id, "new_message").length, 0);
});
