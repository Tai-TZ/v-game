// Vercel build: runs the normal build, then writes Vercel's Build Output API layout
// (.vercel/output), because Vercel ignores the _headers/_redirects files that
// postbuild-csp.mjs writes for other hosts.
//
// - Public deploys ship only the neutral town theme unless VITE_THEME_PACKS/VITE_DEFAULT_THEME
//   say otherwise, so a brand-licensed pack is never published by forgetting an env var.
// - Security headers (including the per-build CSP hashes) come from build/security-headers.json.
// - /api/* is proxied to VG_API_ORIGIN, so the browser stays same-origin (CSP connect-src 'self').
// - Theme packs not listed in VITE_THEME_PACKS are left out of the deployment.
// - /play gets its pre-rendered page; unknown /assets and /themes paths answer 404; every other
//   path gets the SPA fallback.
import { execSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "build", "client");
const outDir = path.join(root, ".vercel", "output");
const staticDir = path.join(outDir, "static");

const apiOrigin = process.env.VG_API_ORIGIN;
if (!apiOrigin)
  throw new Error("Set VG_API_ORIGIN to the backend origin, e.g. https://x.onrender.com");
const api = new URL(apiOrigin);
if (api.protocol !== "https:" || api.pathname !== "/" || api.search) {
  throw new Error(`VG_API_ORIGIN must be a bare https origin, got ${apiOrigin}`);
}

const env = {
  ...process.env,
  VITE_THEME_PACKS: process.env.VITE_THEME_PACKS ?? "town",
  VITE_DEFAULT_THEME: process.env.VITE_DEFAULT_THEME ?? "town",
};
execSync("npm run build", { cwd: root, stdio: "inherit", env });

const packs = env.VITE_THEME_PACKS.split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const HOST_FILES = new Set(["_headers", "_redirects"]);

await rm(outDir, { recursive: true, force: true });
await mkdir(staticDir, { recursive: true });
await cp(clientDir, staticDir, {
  recursive: true,
  filter: (source) => !HOST_FILES.has(path.basename(source)),
});

if (packs.length > 0) {
  const themesDir = path.join(staticDir, "themes");
  for (const entry of await readdir(themesDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !packs.includes(entry.name)) {
      await rm(path.join(themesDir, entry.name), { recursive: true });
    }
  }
  const indexFile = path.join(themesDir, "index.json");
  const index = JSON.parse(await readFile(indexFile, "utf8"));
  const kept = index.themes.filter((theme) => packs.includes(theme.id));
  await writeFile(indexFile, `${JSON.stringify({ ...index, themes: kept }, null, 2)}\n`);
}

const security = JSON.parse(
  await readFile(path.join(root, "build", "security-headers.json"), "utf8"),
);
const config = {
  version: 3,
  routes: [
    {
      src: "^/assets/(.*)$",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    {
      src: "^/themes/(.*)$",
      headers: { "Cache-Control": "public, max-age=86400" },
      continue: true,
    },
    {
      src: "^/(.*)$",
      headers: { ...security, "Strict-Transport-Security": "max-age=63072000; includeSubDomains" },
      continue: true,
    },
    { src: "^/api/(.*)$", dest: `${api.origin}/api/$1` },
    { handle: "filesystem" },
    // Pre-rendered page with the scene loader, whatever Vercel does with directory indexes.
    { src: "^/play/?$", dest: "/play/index.html" },
    { src: "^/(assets|themes)/(.*)$", status: 404 },
    { src: "^/(.*)$", dest: "/__spa-fallback.html" },
  ],
};
await writeFile(path.join(outDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);

console.warn(
  `Vercel output: /api -> ${api.origin}; theme packs: ${packs.length ? packs.join(", ") : "all"}.`,
);
