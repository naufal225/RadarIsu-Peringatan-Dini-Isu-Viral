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

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.BIND_HOST ?? "0.0.0.0";
const dev = process.argv.includes("--dev");

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

createServer((req, res) => {
  req.headers["x-forwarded-for"] = req.socket.remoteAddress ?? "";
  delete req.headers["forwarded"];
  delete req.headers["x-real-ip"];
  handle(req, res);
}).listen(port, hostname, () => {
  console.log(`> RadarIsu frontend on http://${hostname}:${port} (${dev ? "development" : "production"})`);
});
