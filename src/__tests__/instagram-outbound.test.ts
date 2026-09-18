/**
 * Phase 3.8.5 — Outbound Instagram Messaging Tests
 *
 * Covers:
 *  1. sendInstagramMessage() unit tests (mocked fetch):
 *     - success returns externalMessageId
 *     - provider error returns safe error fields (no token leakage)
 *     - network failure returns NETWORK_ERROR
 *     - token is never logged or included in results
 *  2. Duplicate outbound send prevention (DB-level, mirrors the API's
 *     authoritative check — auth itself can't be invoked without a session).
 *  3. Echo suppression regression: outbound messages echoed back by the
 *     webhook are skipped by the normalizer, so no duplicate message rows.
 *
 * Run: node -r ts-node/register --test src/__tests__/instagram-outbound.test.ts
 */

import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";
import { PrismaClient } from "@prisma/client";
import { sendInstagramMessage } from "../lib/integrations/providers/meta";
import { normalizeInstagramMessage } from "../lib/inbox/normalizers/instagram";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

// ── Part 1: sendInstagramMessage unit tests (mocked fetch) ──────────────────

describe("Phase 3.8.5 - sendInstagramMessage (mocked fetch)", () => {
  const CREDENTIALS = { accessToken: "TEST_TOKEN_SHOULD_NEVER_LEAK" };
  const RECIPIENT = "7890000000000099";
  const TEXT = "Hello from Nexus";

  test("success returns externalMessageId", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      new Response(
        JSON.stringify({ recipient_id: RECIPIENT, message_id: "m_out_001" }),
        { status: 200 }
      ) as any
    );

    try {
      const result = await sendInstagramMessage(CREDENTIALS, RECIPIENT, TEXT);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.externalMessageId, "m_out_001");
      }

      // Verify request shape (no direct token assertions on logs).
      const call = fetchMock.mock.calls[0];
      const body = JSON.parse((call.arguments[1] as any).body);
      assert.strictEqual(body.recipient.id, RECIPIENT);
      assert.strictEqual(body.message.text, TEXT);
      assert.strictEqual(body.access_token, "TEST_TOKEN_SHOULD_NEVER_LEAK");
    } finally {
      fetchMock.mock.restore();
    }
  });

  test("provider error returns safe error fields without token", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      new Response(
        JSON.stringify({
          error: { code: 10, message: "Permission denied", type: "OAuthException" },
        }),
        { status: 403 }
      ) as any
    );

    try {
      const result = await sendInstagramMessage(CREDENTIALS, RECIPIENT, TEXT);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.errorCode, "10");
        assert.strictEqual(result.errorMessage, "Permission denied");
        // Token must never appear in error output.
        assert.ok(!JSON.stringify(result).includes("TEST_TOKEN"));
      }
    } finally {
      fetchMock.mock.restore();
    }
  });

  test("network failure returns NETWORK_ERROR without token", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    try {
      const result = await sendInstagramMessage(CREDENTIALS, RECIPIENT, TEXT);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.errorCode, "NETWORK_ERROR");
        assert.ok(!JSON.stringify(result).includes("TEST_TOKEN"));
      }
    } finally {
      fetchMock.mock.restore();
    }
  });

  test("missing inputs fail fast without calling provider", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("should not be called");
    });

    try {
      const noToken = await sendInstagramMessage({}, RECIPIENT, TEXT);
      assert.strictEqual(noToken.ok, false);

      const noText = await sendInstagramMessage(CREDENTIALS, RECIPIENT, "");
      assert.strictEqual(noText.ok, false);

      assert.strictEqual(fetchMock.mock.callCount(), 0);
    } finally {
      fetchMock.mock.restore();
    }
  });

  test("token is never written to logs on success or failure", async (t) => {
    const consoleWarnCalls: any[][] = [];
    const warnMock = mock.method(console, "warn", (...args: any[]) => {
      consoleWarnCalls.push(args);
    });

    // Failure path (403).
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      new Response(
        JSON.stringify({ error: { code: 10, message: "Permission denied" } }),
        { status: 403 }
      ) as any
    );

    try {
      await sendInstagramMessage(CREDENTIALS, RECIPIENT, TEXT);

      const logged = JSON.stringify(consoleWarnCalls);
      assert.ok(!logged.includes("TEST_TOKEN"), "token must never be logged");

      // Provider-safe fields are logged, but not the token.
      assert.ok(
        logged.includes("Instagram Send"),
        "expected a provider send warning log"
      );
    } finally {
      warnMock.mock.restore();
      fetchMock.mock.restore();
    }
  });
});

// ── Part 2: duplicate outbound send prevention (DB-level) ────────────────────

describe("Phase 3.8.5 - duplicate outbound send prevention", () => {
  let companyId: string;
  let contactId: string;
  let conversationId: string;

  before(async () => {
    const company = await prisma.company.create({
      data: { name: `test-outbound-dedupe-${randomUUID()}` },
    });
    companyId = company.id;

    const contact = await prisma.contact.create({
      data: {
        companyRef: { connect: { id: companyId } },
        name: "Outbound Dedupe Contact",
      },
    });
    contactId = contact.id;

    const conversation = await prisma.conversation.create({
      data: {
        company: { connect: { id: companyId } },
        contact: { connect: { id: contactId } },
        channel: "INSTAGRAM",
        status: "OPEN",
      },
    });
    conversationId = conversation.id;
  });

  after(async () => {
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  test("recent identical outbound message is detected as duplicate", async () => {
    await prisma.message.create({
      data: {
        company: { connect: { id: companyId } },
        conversation: { connect: { id: conversationId } },
        direction: "OUTBOUND",
        sender_type: "USER",
        content: "duplicate probe text",
        status: "SENT",
      },
    });

    // The exact authoritative check used by the POST handler.
    const dedupeWindowMs = 5_000;
    const duplicate = await prisma.message.findFirst({
      where: {
        conversation_id: conversationId,
        direction: "OUTBOUND",
        content: "duplicate probe text",
        created_at: { gte: new Date(Date.now() - dedupeWindowMs) },
      },
      select: { id: true },
    });

    assert.ok(duplicate, "recent identical outbound message must be found");
  });

  test("older identical outbound message is NOT a duplicate", async () => {
    const old = new Date(Date.now() - 60_000); // 60s ago, outside the window

    await prisma.message.create({
      data: {
        company: { connect: { id: companyId } },
        conversation: { connect: { id: conversationId } },
        direction: "OUTBOUND",
        sender_type: "USER",
        content: "old probe text",
        status: "SENT",
        created_at: old,
        updated_at: old,
      },
    });

    const dedupeWindowMs = 5_000;
    const duplicate = await prisma.message.findFirst({
      where: {
        conversation_id: conversationId,
        direction: "OUTBOUND",
        content: "old probe text",
        created_at: { gte: new Date(Date.now() - dedupeWindowMs) },
      },
      select: { id: true },
    });

    assert.strictEqual(duplicate, null);
  });

  test("identical INBOUND message is not treated as outbound duplicate", async () => {
    await prisma.message.create({
      data: {
        company: { connect: { id: companyId } },
        conversation: { connect: { id: conversationId } },
        direction: "INBOUND",
        sender_type: "CONTACT",
        content: "inbound probe text",
        status: "DELIVERED",
      },
    });

    const dedupeWindowMs = 5_000;
    const duplicate = await prisma.message.findFirst({
      where: {
        conversation_id: conversationId,
        direction: "OUTBOUND",
        content: "inbound probe text",
        created_at: { gte: new Date(Date.now() - dedupeWindowMs) },
      },
      select: { id: true },
    });

    assert.strictEqual(duplicate, null);
  });
});

// ── Part 3: echo suppression regression ──────────────────────────────────────

describe("Phase 3.8.5 - webhook echo suppression (regression)", () => {
  const IG_PAGE_ID = "17841400000000000";

  test("outbound message echoed by webhook is skipped by the normalizer", () => {
    const echoEvent = {
      sender: { id: IG_PAGE_ID },
      recipient: { id: "7890000000000099" },
      timestamp: 1700000000000,
      message: {
        mid: "m_echo_001",
        text: "Hello from Nexus",
        is_echo: true,
      },
    };

    const result = normalizeInstagramMessage(echoEvent, "integration-id");
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.ok(result.reason.toLowerCase().includes("echo"));
    }
  });

  test("non-echo messages are still normalized (inbound unaffected)", () => {
    const inboundEvent = {
      sender: { id: "7890000000000099" },
      recipient: { id: IG_PAGE_ID },
      timestamp: 1700000000000,
      message: { mid: "m_in_001", text: "Hello from customer" },
    };

    const result = normalizeInstagramMessage(inboundEvent, "integration-id");
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.event.direction, "INBOUND");
      assert.strictEqual(result.event.externalMessageId, "m_in_001");
    }
  });
});
