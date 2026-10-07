// Minimal static server for the production build: serves build/client with the same
// security headers and SPA fallback as production, and proxies /api to the backend.
// Used by `npm run preview` and the Playwright e2e suite. Not for production traffic.
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "build", "client");
const { values } = parseArgs({ options: { port: { type: "string", default: "4173" } } });
const port = Number(values.port);
const apiTarget = new URL(process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000");

// Read per request (the file is tiny) so a rebuild never leaves a reused server on a stale CSP.
const readSecurityHeaders = async () =>
  JSON.parse(await readFile(path.join(root, "build", "security-headers.json"), "utf8"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".bin": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

async function resolveFile(decoded) {
  const candidate = path.normalize(path.join(clientDir, decoded));
  // Reject anything that escapes the build directory.
  const rel = path.relative(clientDir, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
    if (info.isDirectory()) {
      const index = path.join(candidate, "index.html");
      if ((await stat(index).catch(() => null))?.isFile()) return index;
    }
  } catch {
    // missing: the caller decides between 404 and the SPA fallback
  }
  return null;
}

function proxyApi(req, res) {
  const upstream = http.request(
    {
      hostname: apiTarget.hostname,
      port: apiTarget.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: apiTarget.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ detail: "API không phản hồi." }));
  });
  req.pipe(upstream);
}

// Missing hashed assets or theme files must 404, never fall back to the SPA HTML
// (mirrors the _redirects rules written by postbuild-csp.mjs).
const NO_FALLBACK = ["/assets/", "/themes/"];

async function handle(req, res) {
  const url = req.url ?? "/";
  if (url.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(url.split("?")[0] ?? "/");
  } catch {
    res.writeHead(400).end();
    return;
  }
  const securityHeaders = await readSecurityHeaders();
  let file = await resolveFile(decoded);
  if (!file) {
    if (NO_FALLBACK.some((prefix) => decoded.startsWith(prefix))) {
      res.writeHead(404, securityHeaders).end();
      return;
    }
    file = path.join(clientDir, "__spa-fallback.html");
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    ...securityHeaders,
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  });
  createReadStream(file)
    .on("error", () => res.destroy())
    .pipe(res);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

server.listen(port, "127.0.0.1", () => {
  console.warn(`Serving build/client on http://127.0.0.1:${port}`);
});
