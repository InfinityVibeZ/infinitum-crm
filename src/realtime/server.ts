/**
 * Lazy singleton access to the RealtimeHub.
 *
 * The hub is only started when REALTIME_ENABLED=true; otherwise this is a
 * no-op so the application runs identically without realtime.
 */
import { loadRealtimeConfig } from "./config";
import { RealtimeHub } from "./hub";

let hub: RealtimeHub | null = null;

export function getRealtimeHub(): RealtimeHub | null {
  return hub;
}

export async function startRealtimeHub(): Promise<RealtimeHub | null> {
  const config = loadRealtimeConfig();
  if (!config.enabled) return null;
  if (!hub) hub = new RealtimeHub(config);
  if (!hub.running) await hub.start();
  return hub;
}

export async function stopRealtimeHub(): Promise<void> {
  if (hub) {
    await hub.stop();
    hub = null;
  }
}
