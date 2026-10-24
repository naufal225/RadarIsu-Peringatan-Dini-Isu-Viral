// Thin custom server (PRD v2.1 §13, Phase 1 security item).
//
// Next.js only fills X-Forwarded-For when the client did not send one, so a client could
// spoof its IP towards Laravel. Here the header is overwritten with the socket peer address
// before Next.js sees the request; the BFF forwards exactly this value, and Laravel trusts it
// only from the BFF's own address (TRUSTED_PROXIES).
//
// If a TLS-terminating reverse proxy is placed in front of this server later, this must be
// revisited: the peer address would then be that proxy, not the client.

import { createServer } from "node:http";
import next from "next";
import { watchBuildId } from "./src/server/build-guard.mjs";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.BIND_HOST ?? "0.0.0.0";
const dev = process.argv.includes("--dev");

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

// WebSocket upgrades (HMR in development) are not part of the request handler; without this the
// dev client never connects and the page is not hydrated. Only available after prepare().
const handleUpgrade = app.getUpgradeHandler();

const server = createServer((req, res) => {
  req.headers["x-forwarded-for"] = req.socket.remoteAddress ?? "";
  delete req.headers["forwarded"];
  delete req.headers["x-real-ip"];
  handle(req, res);
});

server.on("upgrade", (req, socket, head) => {
  handleUpgrade(req, socket, head);
});

server.listen(port, hostname, () => {
  console.log(`> RadarIsu frontend on http://${hostname}:${port} (${dev ? "development" : "production"})`);
});

// `npm run build` replaces .next under a running production server, whose pages then reference chunks
// that no longer exist. Exit so it is noticed; Docker restarts the container (restart: unless-stopped).
if (!dev) {
  watchBuildId({
    file: new URL("./.next/BUILD_ID", import.meta.url),
    onChange: (previous, current) => {
      console.error(`> .next was rebuilt (${previous} -> ${current}) while this server was running; exiting. Start it again with: npm start`);
      process.exit(1);
    },
  });
}
