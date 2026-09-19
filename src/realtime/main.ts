/**
 * Realtime service entry point.
 *
 * Run standalone:  node -r ts-node/register/transpile-only -r tsconfig-paths/register src/realtime/main.ts
 * (or compile with the project's TypeScript build). Requires REALTIME_ENABLED=true.
 */
import { startRealtimeHub, stopRealtimeHub } from "./server";

async function main() {
  const hub = await startRealtimeHub();
  if (!hub) {
    console.error("[realtime] REALTIME_ENABLED is not true; not starting.");
    process.exit(1);
  }
  const shutdown = async () => {
    await stopRealtimeHub();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
