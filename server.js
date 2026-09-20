const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const next = require("next");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
require("tsconfig-paths").register({
  baseUrl: process.cwd(),
  paths: { "@/*": ["src/*"] },
});

const {
  getRealtimeHub,
  startRealtimeHub,
  stopRealtimeHub,
  setRealtimeHub,
} = require("./src/realtime/server");

async function main() {
  const dev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");
  const keyPath = path.join(process.cwd(), "certificates", "localhost-key.pem");
  const certPath = path.join(process.cwd(), "certificates", "localhost.pem");
  const useHttps = dev && fs.existsSync(keyPath) && fs.existsSync(certPath);
  let handle;
  const requestHandler = (req, res) => {
    const hub = getRealtimeHub();
    if (hub && hub.handleHttpRequest(req, res)) return;
    handle(req, res);
  };
  const httpServer = useHttps
    ? https.createServer(
      { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
      requestHandler
    )
    : http.createServer(requestHandler);

  const app = next({
    dev,
    dir: process.cwd(),
    httpServer,
    ...(dev ? { turbopack: true } : {}),
  });
  handle = app.getRequestHandler();
  await app.prepare();
  const realtimeHub = await startRealtimeHub(httpServer);

  if (realtimeHub) {
    setRealtimeHub(realtimeHub);
  }

  console.log("[server] realtime hub state", {
    exists: !!realtimeHub,
    running: !!realtimeHub?.running,
  });
  const port = Number(process.env.PORT || "3000");
  httpServer.listen(port, () => {
    console.log(
      `[server] Next.js and realtime listening on ${useHttps ? "https" : "http"}://localhost:${port}`
    );
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await stopRealtimeHub();
    await new Promise((resolve) => httpServer.close(resolve));
    await app.close();
  };

  process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
  process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});