/**
 * Phase 3.8.7.1 — SignalR realtime infrastructure tests.
 *
 * Focused on AUTHENTICATION and TENANT ISOLATION only, against a real
 * running hub with real WebSocket connections:
 *   1. Unauthenticated connections are rejected.
 *   2. Invalid/expired tokens are rejected.
 *   3. A user from Company A only receives Company A events.
 *   4. A user from Company A never receives Company B events — even though
 *      the wire format for both tenants is identical.
 *   5. Clients cannot invoke hub methods or join arbitrary groups.
 *   6. Correct SignalR handshake completes for authenticated clients.
 *
 * No Inbox/UI/API behavior is touched. Uses existing JWT mechanism.
 */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import { PrismaClient } from "@prisma/client";
import { WebSocket } from "ws";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const PORT = 5599;
const URL = `ws://localhost:${PORT}/hubs/inbox`;

let hub: any;
let companyA: any, companyB: any;
let userA: any, userB: any;
let tokenA: string, tokenB: string;

function makeToken(userId: string, secret = process.env.JWT_SECRET!, opts: any = {}) {
  return jwt.sign({ userId, email: "t@t.io", role: "USER", name: "T" }, secret, {
    expiresIn: "15m",
    ...opts,
  });
}

/** Open a raw WS connection and perform the SignalR handshake. */
function connect(query = ""): Promise<{ ws: WebSocket; handshake: any }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${URL}?${query}`);
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error("timeout")), 8000);
    ws.on("open", () => {
      // Send the SignalR JSON-protocol handshake request.
      ws.send('{"protocol":"json","version":1}\x1e');
    });
    ws.on("message", (d) => {
      buffer += d.toString();
      let idx;
      while ((idx = buffer.indexOf("\x1e")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!chunk) continue;
        let msg: any;
        try {
          msg = JSON.parse(chunk);
        } catch {
          continue;
        }
        // SignalR handshake response is `{}` (no error key) — any message
        // without a `type` field that isn't an error IS the handshake ack.
        if (!msg.type && !msg.error) {
          clearTimeout(timeout);
          resolve({ ws, handshake: msg });
        } else if (msg.error) {
          clearTimeout(timeout);
          reject(new Error(msg.error));
        } else {
          (ws as any)._lastServerMessage = msg;
          (ws as any)._messages = ((ws as any)._messages || []).concat(msg);
        }
      }
    });
    ws.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    ws.on("close", () => {
      (ws as any)._closed = true;
    });
  });
}

/** Wait until the socket has received an event with the given target, or fail. */
async function waitForEvent(ws: WebSocket, target: string, ms = 4000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const msgs: any[] = (ws as any)._messages || [];
    const found = msgs.find((m) => m.target === target);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`did not receive event '${target}'`);
}

/** Assert that no event with the target ever arrives within the window. */
async function assertNoEvent(ws: WebSocket, target: string, ms = 1200): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const msgs: any[] = (ws as any)._messages || [];
    if (msgs.some((m) => m.target === target)) {
      throw new Error(`received forbidden event '${target}' — tenant isolation leak!`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

beforeEach(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-3871";
  process.env.REALTIME_ENABLED = "true";
  process.env.REALTIME_PORT = String(PORT);
  process.env.REALTIME_HUB_PATH = "/hubs/inbox";
  process.env.REALTIME_ALLOWED_ORIGINS = "";

  const { startRealtimeHub } = await import("@/realtime/server");
  if (!hub || !hub.running) {
    hub = await startRealtimeHub();
  }

  if (!companyA) {
    const suffix = Date.now();
    companyA = await prisma.company.create({
      data: { name: `RT-A-${suffix}`, isActive: true, status: "ACTIVE" },
    });
    companyB = await prisma.company.create({
      data: { name: `RT-B-${suffix}`, isActive: true, status: "ACTIVE" },
    });
    userA = await prisma.user.create({
      data: {
        email: `rt-a-${suffix}@t.io`,
        name: "User A",
        passwordHash: "x",
        role: "USER",
        companyId: companyA.id,
        isActive: true,
        status: "ACTIVE",
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `rt-b-${suffix}@t.io`,
        name: "User B",
        passwordHash: "x",
        role: "USER",
        companyId: companyB.id,
        isActive: true,
        status: "ACTIVE",
      },
    });
    tokenA = makeToken(userA.id);
    tokenB = makeToken(userB.id);
  }
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA?.id, userB?.id].filter(Boolean) } } });
  await prisma.company.deleteMany({ where: { id: { in: [companyA?.id, companyB?.id].filter(Boolean) } } });
  const { stopRealtimeHub } = await import("@/realtime/server");
  await stopRealtimeHub();
  await prisma.$disconnect();
});

test("handshake completes for authenticated connection with valid token", async () => {
  const { ws, handshake } = await connect(`access_token=${tokenA}`);
  assert.strictEqual(handshake.error, undefined);
  ws.close();
  await new Promise((r) => setTimeout(r, 100));
});

test("connection without a token is rejected", async () => {
  await assert.rejects(() => connect(""), (err: any) => {
    // Either the socket errors, closes with 4401, or never completes handshake
    return true; // rejection of the connect promise is the pass condition
  });
});

test("connection with an invalid-token signature is rejected", async () => {
  const forged = jwt.sign({ userId: userA.id }, "wrong-secret");
  await assert.rejects(() => connect(`access_token=${forged}`), () => true);
});

test("connection with an expired token is rejected", async () => {
  const expired = makeToken(userA.id, process.env.JWT_SECRET!, { expiresIn: "-10s" });
  await assert.rejects(() => connect(`access_token=${expired}`), () => true);
});

test("token for a non-existent user is rejected", async () => {
  const ghost = makeToken("00000000-0000-0000-0000-000000000000");
  await assert.rejects(() => connect(`access_token=${ghost}`), () => true);
});

test("Company A user receives Company A events", async () => {
  const { ws } = await connect(`access_token=${tokenA}`);
  await new Promise((r) => setTimeout(r, 200));
  const n = hub.publish({
    name: "new_message",
    companyId: companyA.id,
    conversationId: "conv-a",
    payload: { messageId: "m1", preview: "hello" },
  });
  assert.ok(n >= 1, "expected at least one recipient");
  const evt = await waitForEvent(ws, "new_message");
  assert.strictEqual(evt.arguments[0].messageId, "m1");
  ws.close();
  await new Promise((r) => setTimeout(r, 100));
});

test("Company A user NEVER receives Company B events (tenant isolation)", async () => {
  const { ws } = await connect(`access_token=${tokenA}`);
  await new Promise((r) => setTimeout(r, 200));
  hub.publish({
    name: "outbound_message",
    companyId: companyB.id,
    conversationId: "conv-b",
    payload: { messageId: "m2" },
  });
  await assertNoEvent(ws, "outbound_message");
  ws.close();
  await new Promise((r) => setTimeout(r, 100));
});

test("both tenants connected simultaneously: events are delivered strictly per company", async () => {
  const connA = await connect(`access_token=${tokenA}`);
  const connB = await connect(`access_token=${tokenB}`);
  await new Promise((r) => setTimeout(r, 200));

  hub.publish({ name: "conversation_updated", companyId: companyA.id, payload: { v: "A" } });
  hub.publish({ name: "conversation_updated", companyId: companyB.id, payload: { v: "B" } });

  const evtA = await waitForEvent(connA.ws, "conversation_updated");
  const evtB = await waitForEvent(connB.ws, "conversation_updated");
  assert.strictEqual(evtA.arguments[0].v, "A");
  assert.strictEqual(evtB.arguments[0].v, "B");
  // Cross-contamination check
  assert.ok(!((connA.ws as any)._messages || []).some((m: any) => m.target === "conversation_updated" && m.arguments[0].v === "B"));
  assert.ok(!((connB.ws as any)._messages || []).some((m: any) => m.target === "conversation_updated" && m.arguments[0].v === "A"));

  connA.ws.close();
  connB.ws.close();
  await new Promise((r) => setTimeout(r, 100));
});

test("client cannot join an arbitrary group or invoke hub methods", async () => {
  const { ws } = await connect(`access_token=${tokenA}`);
  await new Promise((r) => setTimeout(r, 200));
  // Attempt a SignalR "join group" invocation (type 5) and a method call (type 1).
  ws.send(JSON.stringify({ type: 5, target: "company:XXX", arguments: [] }) + "\x1e");
  ws.send(JSON.stringify({ type: 1, target: "JoinGroup", arguments: ["company:XXX"] }) + "\x1e");
  await new Promise((r) => setTimeout(r, 200));
  // Now publish to company XXX (a "foreign" group) — client must NOT receive it.
  hub.publish({
    name: "new_message",
    companyId: "XXX-fake-company",
    payload: { leak: true },
  });
  await assertNoEvent(ws, "new_message");
  ws.close();
  await new Promise((r) => setTimeout(r, 100));
});

test("reconnect after disconnect receives new events (no duplicate issues)", async () => {
  const c1 = await connect(`access_token=${tokenA}`);
  c1.ws.close();
  await new Promise((r) => setTimeout(r, 200));
  // Reconnect with the same identity
  const c2 = await connect(`access_token=${tokenA}`);
  await new Promise((r) => setTimeout(r, 200));
  hub.publish({ name: "conversation_read", companyId: companyA.id, payload: { re: true } });
  const evt = await waitForEvent(c2.ws, "conversation_read");
  assert.strictEqual(evt.arguments[0].re, true);
  c2.ws.close();
  await new Promise((r) => setTimeout(r, 100));
});

test("connection count goes to zero after all clients disconnect", async () => {
  const before = hub.connectionCount;
  const c = await connect(`access_token=${tokenA}`);
  assert.ok(hub.connectionCount >= before + 1);
  c.ws.close();
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(hub.connectionCount, before);
});
