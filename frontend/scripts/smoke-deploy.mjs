// Post-deploy smoke test for the public site (Vercel) and its API (Render behind /api).
//
//   node frontend/scripts/smoke-deploy.mjs https://v-game-theta.vercel.app
//
// Checks pages and the SPA fallback, the security headers, that only the public theme packs
// are served, and that the API answers. The API may be asleep on a free plan, so /api/health
// is retried for up to four minutes. Exits 1 with a list of failures.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = new URL(process.argv[2] ?? process.env.BASE_URL ?? "");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPacks = (process.env.VITE_THEME_PACKS ?? "town").split(",").map((id) => id.trim());
const failures = [];

const url = (pathname) => new URL(pathname, base).href;
const check = (ok, message) => {
  console.warn(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(pathname) {
  try {
    return await fetch(url(pathname), { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    return { ok: false, status: 0, headers: new Headers(), text: async () => String(error) };
  }
}

const home = await get("/");
const homeHtml = await home.text();
check(home.status === 200 && homeHtml.includes("V-Game"), `GET / -> ${home.status}`);
const csp = home.headers.get("content-security-policy") ?? "";
check(csp.includes("default-src 'self'"), "Content-Security-Policy is set");
check(
  /connect-src [^;]*https:\/\/api\.open-meteo\.com/.test(csp),
  "CSP connect-src allows Open-Meteo (campus weather)",
);
check(home.headers.has("strict-transport-security"), "Strict-Transport-Security is set");
check(home.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");

for (const pathname of ["/play", "/play/library"]) {
  const page = await get(pathname);
  check(page.status === 200, `GET ${pathname} -> ${page.status} (SPA fallback)`);
  if (pathname === "/play") {
    check(
      (await page.text()).includes("data-scene-loader"),
      "/play is prerendered with the loader",
    );
  }
}

// Every pack in the repo that is not public must answer 404, so a brand-licensed pack never
// ships by accident. Pack ids come from the repo, not from this script.
const index = JSON.parse(await readFile(path.join(root, "public", "themes", "index.json"), "utf8"));
for (const { id } of index.themes) {
  const manifest = await get(`/themes/${id}/manifest.json`);
  const expected = publicPacks.includes(id) ? 200 : 404;
  check(
    manifest.status === expected,
    `theme pack "${id}" -> ${manifest.status} (want ${expected})`,
  );
}

let health = { status: 0 };
for (let attempt = 0; attempt < 24; attempt += 1) {
  health = await get("/api/health");
  if (health.status === 200) break;
  await sleep(10_000);
}
const healthBody = health.status === 200 ? await health.text() : "";
check(healthBody.includes('"status":"ok"'), `GET /api/health -> ${health.status} ${healthBody}`);

const zones = await get("/api/zones");
let zoneCount = 0;
if (zones.status === 200) zoneCount = (JSON.parse(await zones.text()).zones ?? []).length;
check(
  zones.status === 200 && zoneCount > 0,
  `GET /api/zones -> ${zones.status}, ${zoneCount} zones`,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed for ${base.origin}`);
  process.exit(1);
}
console.warn(`\nAll checks passed for ${base.origin}`);
