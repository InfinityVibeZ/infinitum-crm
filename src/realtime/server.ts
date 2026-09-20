import type http from "http";
import { loadRealtimeConfig } from "./config";
import { RealtimeHub } from "./hub";

const GLOBAL_HUB_KEY = "__CRM_REALTIME_HUB__";

type GlobalWithRealtimeHub = typeof globalThis & {
  __CRM_REALTIME_HUB__?: RealtimeHub;
};

const globalState = globalThis as GlobalWithRealtimeHub;

export function getRealtimeHub(): RealtimeHub | null {
  return globalState[GLOBAL_HUB_KEY] ?? null;
}

export function setRealtimeHub(instance: RealtimeHub): void {
  globalState[GLOBAL_HUB_KEY] = instance;
}

export async function startRealtimeHub(
  existingServer?: http.Server,
): Promise<RealtimeHub | null> {
  const config = loadRealtimeConfig();

  if (!config.enabled) {
    return null;
  }

  let current = getRealtimeHub();

  if (!current) {
    current = new RealtimeHub(config);
    setRealtimeHub(current);
  }

  if (!current.running) {
    await current.start(existingServer);
  }

  return current;
}

export async function stopRealtimeHub(): Promise<void> {
  const current = getRealtimeHub();

  if (current) {
    await current.stop();
    globalState[GLOBAL_HUB_KEY] = undefined;
  }
}