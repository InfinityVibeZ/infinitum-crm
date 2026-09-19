/**
 * SignalR hub server — the realtime service boundary.
 *
 * A standalone Node WebSocket server implementing the SignalR
 * WebSocket-transport JSON protocol (handshake + invocations), so the
 * official `@microsoft/signalr` client can connect directly. This
 * repository is a Next.js application with no .NET backend, so this is
 * the smallest production-appropriate SignalR service boundary.
 *
 * Security model:
 *  - Every connection MUST present a valid access token in the
 *    `access_token` query parameter (the standard SignalR mechanism for
 *    browser WebSocket clients, which cannot set arbitrary headers).
 *  - Identity (userId, companyId) is resolved SERVER-SIDE from the token
 *    and the authoritative User row. Client-supplied companyId/group
 *    names are never trusted.
 *  - Connections are auto-joined to their tenant group on connect; there
 *    is no client "join group" invocation at all, so group membership
 *    cannot be manipulated from the browser.
 *  - Origin is validated against an explicit allowlist (no wildcard
 *    production CORS).
 *  - No tokens, credentials, or secrets are ever logged.
 */
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { loadRealtimeConfig, type RealtimeConfig } from "./config";
import { resolveRealtimeIdentity, type RealtimeIdentity } from "./identity";
import { groupsForIdentity } from "./groups";
import type { RealtimeEvent } from "./events";

interface HubConnection {
  socket: WebSocket;
  identity: RealtimeIdentity;
  /** SignalR connection id (generated server-side). */
  connectionId: string;
  /** Tenant groups this connection belongs to. */
  groups: string[];
}

export class RealtimeHub {
  private config: RealtimeConfig;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  /** connectionId -> connection. */
  private connections = new Map<string, HubConnection>();
  /** Per-connection pending handshake state. */
  private handshaken = new Set<string>();

  constructor(config?: RealtimeConfig) {
    this.config = config ?? loadRealtimeConfig();
  }

  get running(): boolean {
    return this.wss !== null;
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  async start(): Promise<void> {
    if (this.wss) return; // idempotent — supports reconnects/hot reloads

    const httpServer = http.createServer((req, res) => {
      // Plain HTTP requests to the hub are only used for health checks and
      // cross-process event publishing (Next.js runs in a separate process).
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", connections: this.connections.size }));
        return;
      }
      if (req.url === "/publish" && req.method === "POST") {
        this.handlePublishRequest(req, res);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const wss = new WebSocketServer({
      server: httpServer,
      path: this.config.path,
      // Origin allowlist — no wildcards. Enforced at upgrade time.
      verifyClient: (info, done) => {
        const origin = info.req.headers.origin;
        const allowed = this.config.allowedOrigins;
        const ok =
          allowed.length === 0
            ? true // explicit dev/no-origin mode; production sets allowedOrigins
            : !!origin && allowed.includes(origin);
        if (!ok) {
          console.warn("[realtime] rejected upgrade: origin not allowed");
        }
        done(ok);
      },
    });

    wss.on("connection", (socket, req) => {
      void this.handleConnection(socket, req);
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(this.config.port, () => resolve());
    });

    this.httpServer = httpServer;
    this.wss = wss;
    console.log(
      `[realtime] hub listening on port ${this.config.port} at ${this.config.path}`
    );
  }

  async stop(): Promise<void> {
    if (!this.wss) return;
    for (const conn of this.connections.values()) {
      conn.socket.close(1001, "server shutting down");
    }
    this.connections.clear();
    this.handshaken.clear();
    const wss = this.wss;
    const httpServer = this.httpServer;
    this.wss = null;
    this.httpServer = null;
    await new Promise<void>((resolve) => {
      wss.close(() => {
        if (httpServer) httpServer.close(() => resolve());
        else resolve();
      });
    });
  }

  // ─── Connection lifecycle ────────────────────────────────────────────────

  private async handleConnection(socket: WebSocket, req: http.IncomingMessage) {
    const url = new URL(req.url || "/", "http://localhost");
    /*
     * Token locations, in order:
     *  1. `access_token` query param — how BROWSER SignalR clients pass the
     *     token (browsers cannot set headers on WebSocket connections).
     *  2. `Authorization: Bearer` header — how the official Node client
     *     passes it (it sends headers instead of the query param).
     */
    const authHeader = req.headers.authorization;
    const token =
      url.searchParams.get("access_token") ||
      (authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : null);

    // Buffer any messages that arrive while the async identity lookup below
    // is in flight — clients (including the official SignalR client) send
    // the handshake immediately after the socket opens, and we must not
    // lose it.
    const earlyMessages: string[] = [];
    let buffering = true;
    const bufferHandler = (data: Buffer) => {
      if (buffering) earlyMessages.push(data.toString());
    };
    socket.on("message", bufferHandler);

    if (!token) {
      console.warn("[realtime] connection rejected: no access token");
      socket.close(4401, "Unauthorized");
      return;
    }

    // Server-side identity resolution. NEVER from browser-supplied fields.
    const identity = await resolveRealtimeIdentity(token);
    if (!identity) {
      console.warn("[realtime] connection rejected: invalid identity");
      socket.close(4401, "Unauthorized");
      return;
    }

    const connectionId = crypto.randomUUID();
    // Tenant groups derived ONLY from the authenticated identity.
    const groups = groupsForIdentity(identity);

    this.connections.set(connectionId, { socket, identity, connectionId, groups });

    console.log(
      `[realtime] connected userId=${identity.userId} company=${identity.companyId} connectionId=${connectionId}`
    );

    socket.off("message", bufferHandler);
    buffering = false;

    socket.on("message", (data) => {
      this.handleMessage(connectionId, data.toString());
    });
    // Process anything that arrived during identity resolution.
    for (const raw of earlyMessages.splice(0)) {
      this.handleMessage(connectionId, raw);
    }
    socket.on("close", () => {
      // Clean disconnect; group membership dies with the connection, so
      // reconnects can never produce duplicate membership.
      this.connections.delete(connectionId);
      this.handshaken.delete(connectionId);
      console.log(
        `[realtime] disconnected userId=${identity.userId} connectionId=${connectionId}`
      );
    });
    socket.on("error", (err) => {
      console.warn(
        `[realtime] socket error userId=${identity.userId}: ${err.message}`
      );
    });
  }

  /**
   * Handle an incoming SignalR JSON protocol message.
   * Only the handshake and ping are supported — there are intentionally no
   * client->server invocations that could join groups or trigger actions.
   */
  private handleMessage(connectionId: string, raw: string) {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    // SignalR JSON protocol messages are terminated by \x1e.
    for (const chunk of raw.split("\x1e")) {
      if (!chunk) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(chunk);
      } catch {
        continue;
      }
      const type = msg.type as number | undefined;

      if (type === undefined && msg.protocol) {
        // Handshake request: accept JSON protocol.
        conn.socket.send('{}\x1e');
        this.handshaken.add(connectionId);
        continue;
      }
      if (type === 6) {
        // Ping -> Pong (keeps SignalR clients healthy; supports reconnects).
        conn.socket.send('{"type":6}\x1e');
        continue;
      }
      // Types 1 (Invocation), 3 (CancelInvocation) and any group-management
      // messages (4/5) are intentionally ignored: clients cannot invoke
      // hub methods or join/leave groups.
      if (type === 1 || type === 3 || type === 4 || type === 5) {
        console.warn(
          `[realtime] ignored client invocation type=${type} userId=${conn.identity.userId}`
        );
      }
    }
  }

  // ─── Event fan-out ───────────────────────────────────────────────────────

  /**
   * Cross-process publish: the Next.js app POSTs events here because the
   * hub runs in its own process. Authenticated with a shared internal
   * token; payloads contain only sanitized event data (no credentials).
   */
  private handlePublishRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const expected = process.env.REALTIME_PUBLISH_TOKEN || "";
    if (!expected || req.headers["x-publish-token"] !== expected) {
      res.writeHead(401);
      res.end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy(); // hard cap: events are small
    });
    req.on("end", () => {
      try {
        const event = JSON.parse(body) as RealtimeEvent;
        if (!event || typeof event.name !== "string" || typeof event.companyId !== "string") {
          res.writeHead(400);
          res.end();
          return;
        }
        const recipients = this.publish(event);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ delivered: recipients }));
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
  }

  /** Publish an event to its tenant group. Returns number of recipients. */
  publish(event: RealtimeEvent): number {
    if (!this.wss) return 0;
    const groupName = `company:${event.companyId}`;
    let recipients = 0;
    const frame = JSON.stringify({
      type: 1,
      target: event.name,
      arguments: [
        {
          conversationId: event.conversationId,
          ...event.payload,
        },
      ],
    }) + "\x1e";

    for (const conn of this.connections.values()) {
      if (!conn.groups.includes(groupName)) continue;
      if (conn.socket.readyState !== WebSocket.OPEN) continue;
      conn.socket.send(frame);
      recipients++;
    }
    return recipients;
  }
}
