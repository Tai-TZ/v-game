// Generates security headers for the static build.
//
// React Router emits a few inline <script> elements (hydration context, scroll
// restoration) and we add one for the theme bootstrap. A static host cannot inject a
// nonce, so this script hashes every inline script and allows exactly those hashes.
//
// Outputs:
//   build/client/_headers           Netlify / Cloudflare Pages header rules
//   build/client/_redirects         404 for missing assets + SPA fallback for the same hosts
//   build/security-headers.json     consumed by scripts/serve-build.mjs (local preview, e2e)
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "build", "client");

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listHtmlFiles(full);
      return entry.name.endsWith(".html") ? [full] : [];
    }),
  );
  return nested.flat();
}

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const body = match[1] ?? "";
    if (body.length === 0) continue;
    hashes.push(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return hashes;
}

function connectSources() {
  const sources = ["'self'"];
  const apiBase = process.env.VITE_API_BASE_URL;
  if (apiBase) sources.push(new URL(apiBase).origin);
  return sources.join(" ");
}

const htmlFiles = await listHtmlFiles(clientDir);
if (htmlFiles.length === 0) {
  throw new Error(`No HTML files found in ${clientDir}; run react-router build first.`);
}

const hashes = new Set();
for (const file of htmlFiles) {
  for (const hash of inlineScriptHashes(await readFile(file, "utf8"))) hashes.add(hash);
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes].sort().join(" ")}`.trim(),
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connectSources()}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = {
  "Content-Security-Policy": csp,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const headerLines = (headers) =>
  Object.entries(headers)
    .map(([name, value]) => `  ${name}: ${value}`)
    .join("\n");

const headersFile = [
  "/*",
  headerLines({
    ...securityHeaders,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  }),
  "/assets/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "/themes/*",
  "  Cache-Control: public, max-age=86400",
  "",
].join("\n");

await writeFile(path.join(clientDir, "_headers"), headersFile);
// Missing hashed assets and theme files answer 404 instead of the SPA HTML, which would
// otherwise be cached as an immutable asset. Hosts skip a rule when a real file exists.
await writeFile(
  path.join(clientDir, "_redirects"),
  "/assets/*  /404.html  404\n/themes/*  /404.html  404\n/*  /__spa-fallback.html  200\n",
);
await writeFile(
  path.join(root, "build", "security-headers.json"),
  `${JSON.stringify(securityHeaders, null, 2)}\n`,
);

console.warn(`CSP: ${hashes.size} inline script hash(es) from ${htmlFiles.length} HTML file(s).`);
