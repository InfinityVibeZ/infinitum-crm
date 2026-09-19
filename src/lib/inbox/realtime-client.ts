/**
 * Inbox realtime client (Phase 3.8.7.3).
 *
 * Connects the /inbox UI to the standalone SignalR hub. REST remains the
 * source of truth; this is a notification layer only.
 *
 * Security:
 * - The browser never sees refresh tokens. Because authentication is via
 *   HttpOnly cookies, the client exchanges its session for a SHORT-LIVED
 *   (5-minute) access token from /api/auth/realtime-token and keeps it in
 *   memory only. The token is never logged, never persisted.
 * - Hub URL comes from NEXT_PUBLIC_REALTIME_URL (never a server-only secret).
 *
 * Reliability:
 * - `withAutomaticReconnect` with sensible delays; `stop()` is called on
 *   unmount/logout. A module-level singleton prevents multiple simultaneous
 *   connections, and `off()` before `on()` prevents duplicate handlers across
 *   reconnects/remounts.
 * - Every handler is wrapped so SignalR failures can never break the Inbox.
 */

import {
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";

export type RealtimeConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface InboxRealtimeHandlers {
  onNewMessage?: (payload: Record<string, unknown>) => void;
  onConversationUpdated?: (payload: Record<string, unknown>) => void;
  onOutboundMessage?: (payload: Record<string, unknown>) => void;
  onConversationRead?: (payload: Record<string, unknown>) => void;
  onStateChange?: (state: RealtimeConnectionState) => void;
}

const HUB_EVENTS = [
  "new_message",
  "conversation_updated",
  "outbound_message",
  "conversation_read",
] as const;

type HubEventName = (typeof HUB_EVENTS)[number];

let connection: HubConnection | null = null;
let startedForHandlers: InboxRealtimeHandlers | null = null;
let activeHandlers: InboxRealtimeHandlers | null = null;

function safeLogger(error: Error | undefined, message: string | undefined) {
  // Never log tokens/JWT contents — the SignalR framework log line on
  // failure contains only transport metadata.
  console.warn(`[realtime] ${message || "client error"}`);
  if (error && process.env.NODE_ENV !== "production") {
    console.warn(`[realtime] ${error.name}`);
  }
}

function setState(state: RealtimeConnectionState) {
  try {
    activeHandlers?.onStateChange?.(state);
  } catch {
    // UI handler failures must never affect the connection.
  }
}

async function fetchRealtimeAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/realtime-token", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Fetch the hub URL from the token endpoint response. Kept in one place so
 * the client never hardcodes a deployment URL.
 */
let cachedHubUrl: string | null = null;

async function resolveHubUrl(): Promise<string | null> {
  if (cachedHubUrl) return cachedHubUrl;
  const envUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (envUrl) {
    cachedHubUrl = envUrl.replace(/\/$/, "");
    return cachedHubUrl;
  }
  try {
    const res = await fetch("/api/auth/realtime-token", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string | null };
    cachedHubUrl = data.url ? data.url.replace(/\/$/, "") : null;
    return cachedHubUrl;
  } catch {
    return null;
  }
}

export function resetRealtimeClientForTests(): void {
  connection = null;
  startedForHandlers = null;
  activeHandlers = null;
  cachedHubUrl = null;
}

/**
 * Start (or update handlers on an already-started) realtime connection.
 * Safe to call repeatedly: a second call while connected only swaps the
 * handlers — no duplicate connections or registrations.
 */
export async function startInboxRealtime(
  handlers: InboxRealtimeHandlers
): Promise<void> {
  // Already connected: just attach the latest handlers (dedupe-safe).
  if (connection && startedForHandlers) {
    attachHandlers(connection, handlers);
    return;
  }

  const hubUrl = await resolveHubUrl();
  if (!hubUrl) {
    // Realtime not configured — REST-only mode. Not an error.
    setState("disconnected");
    return;
  }

  // If a previous connection exists in a bad state, tear it down first.
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // ignore
    }
    connection = null;
  }

  const tokenFactory = async (): Promise<string> =>
    (await fetchRealtimeAccessToken()) || "";

  const builder = new HubConnectionBuilder()
    .withUrl(hubUrl, {
      // skipNegotiation is safe: our standalone hub speaks WebSockets only.
      skipNegotiation: true,
      transport: HttpTransportType.WebSockets,
      accessTokenFactory: tokenFactory,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging({
      log: (_level: unknown, message: string) => safeLogger(undefined, message),
    });

  const conn = builder.build();
  connection = conn;
  startedForHandlers = handlers;
  attachHandlers(conn, handlers);

  conn.onreconnecting(() => setState("reconnecting"));
  conn.onreconnected(() => {
    setState("connected");
    // Access token may have expired while disconnected; force a fresh one on
    // the next (re)negotiation by rebuilding is handled by reconnect cycle —
    // the accessTokenFactory runs on every (re)connect attempt.
  });
  conn.onclose(() => {
    setState("disconnected");
    if (connection === conn) {
      connection = null;
      startedForHandlers = null;
    }
  });

  setState("connecting");
  try {
    await conn.start();
    setState("connected");
  } catch {
    // Never break the Inbox because realtime is unavailable.
    setState("disconnected");
    if (connection === conn) {
      connection = null;
      startedForHandlers = null;
    }
  }
}

function attachHandlers(conn: HubConnection, handlers: InboxRealtimeHandlers) {
  // Detach first so reconnects/remounts never double-register.
  for (const event of HUB_EVENTS) {
    conn.off(event);
  }

  const wrap =
    (
      eventName: string,
      fn?: (payload: Record<string, unknown>) => void
    ) =>
    (payload: unknown) => {
      console.log("[realtime-client] RECEIVED", eventName, payload);

      try {
        fn?.((payload as Record<string, unknown>) || {});
      } catch (error) {
        console.warn(
          "[realtime] handler error",
          error instanceof Error ? error.name : "unknown"
        );
      }
    };

  conn.on("new_message", wrap("new_message", handlers.onNewMessage));
  conn.on(
    "conversation_updated",
    wrap("conversation_updated", handlers.onConversationUpdated)
  );
  conn.on(
    "outbound_message",
    wrap("outbound_message", handlers.onOutboundMessage)
  );
  conn.on(
    "conversation_read",
    wrap("conversation_read", handlers.onConversationRead)
  );

  activeHandlers = handlers;
  // Expose hub event names for tests/introspection without leaking internals.
  void (handlers as { __events?: readonly HubEventName[] });
}

/** Stop the realtime connection cleanly (logout / unmount). */
export async function stopInboxRealtime(): Promise<void> {
  const conn = connection;
  connection = null;
  startedForHandlers = null;
  activeHandlers = null;
  if (conn) {
    try {
      await conn.stop();
    } catch {
      // ignore
    }
  }
}

/** Current connection state for status indicators. */
export function getInboxRealtimeState(): RealtimeConnectionState {
  if (!connection) return "disconnected";
  switch (connection.state) {
    case "Connected":
      return "connected";
    case "Reconnecting":
      return "reconnecting";
    case "Connecting":
      return "connecting";
    default:
      return "disconnected";
  }
}
