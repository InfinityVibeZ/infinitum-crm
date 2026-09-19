/**
 * Realtime (SignalR) service configuration.
 *
 * All values come from environment variables — nothing is hardcoded.
 * `enabled=false` makes the entire realtime subsystem a no-op so the rest
 * of the application never depends on it being up (REST remains the
 * source of truth).
 */
export interface RealtimeConfig {
  enabled: boolean;
  port: number;
  path: string;
  /** Allowed browser origins for CORS/handshake validation. No wildcards in production. */
  allowedOrigins: string[];
  /** JWT secrets — the SAME secret as the existing Next.js app (shared identity). */
  jwtSecret: string;
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

export function loadRealtimeConfig(): RealtimeConfig {
  const enabled = process.env.REALTIME_ENABLED === "true";
  const port = Number(process.env.REALTIME_PORT || "5001");
  const path = process.env.REALTIME_HUB_PATH || "/hubs/inbox";
  const allowedOrigins = parseOrigins(process.env.REALTIME_ALLOWED_ORIGINS);
  const jwtSecret = process.env.JWT_SECRET as string;

  if (enabled && !jwtSecret) {
    throw new Error("REALTIME_ENABLED=true requires JWT_SECRET");
  }

  return { enabled, port, path, allowedOrigins, jwtSecret };
}
