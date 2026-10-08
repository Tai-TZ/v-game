import { readFileSync } from "node:fs";
import path from "node:path";

import { test as base, expect, type Page } from "@playwright/test";

/** The content seed the backend serves; mocks answer with the same data. */
interface SeedZone {
  id: string;
  status: "open" | "coming_soon";
  levels: unknown[];
  [field: string]: unknown;
}

const seed = JSON.parse(
  readFileSync(
    path.resolve(
      import.meta.dirname,
      "..",
      "..",
      "backend",
      "src",
      "vgame",
      "content",
      "data",
      "zones.json",
    ),
    "utf8",
  ),
) as { zones: SeedZone[] };

export const zoneList = () => ({
  zones: seed.zones.map(({ levels, ...zone }) => ({ ...zone, level_count: levels.length })),
});

export const zoneDetail = (id: string) => seed.zones.find((zone) => zone.id === id);

export const themeIds = (
  JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, "..", "public", "themes", "index.json"), "utf8"),
  ) as { themes: { id: string }[] }
).themes.map((theme) => theme.id);

/** Chunks proven by scripts/check-bundle.mjs to hold three.js or the lazy scene. */
export const bundleReport = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "..", "build", "bundle-report.json"), "utf8"),
) as { threeChunks: string[]; sceneChunks: string[] };

interface Reply {
  status: number;
  body?: unknown;
}

/** Replies like the real API: the seed zone, or 404. */
export function seedDetail(id: string): Reply {
  const zone = zoneDetail(id);
  return zone ? { status: 200, body: zone } : { status: 404, body: { detail: "Not found" } };
}

/**
 * Mocks the zones API. `list` and `detail` may be a fixed reply or a function, so a test can
 * fail first and succeed on retry.
 */
export async function mockApi(
  page: Page,
  options: { list?: () => Reply; detail?: (id: string) => Reply } = {},
) {
  const list = options.list ?? (() => ({ status: 200, body: zoneList() }));
  const detail = options.detail ?? seedDetail;
  await page.route("**/api/zones", (route) => {
    const reply = list();
    return route.fulfill({ status: reply.status, json: reply.body ?? { detail: "Lỗi" } });
  });
  await page.route("**/api/zones/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    const reply = detail(decodeURIComponent(id));
    return route.fulfill({ status: reply.status, json: reply.body ?? { detail: "Lỗi" } });
  });
}

/**
 * Collects console errors, uncaught exceptions and CSP violations. Failed API responses that
 * a test mocks on purpose are expected and filtered out.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, provide) => {
    // The landing page pings /api/health to wake a sleeping API; no backend runs in e2e.
    await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok" } }));
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Failed to load resource: the server responded with a status of (404|500)/.test(text))
        return;
      errors.push(text);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    // The console filter above cannot tell a mocked API failure from a missing asset, so any
    // non-API resource that fails is reported here by URL.
    page.on("response", (response) => {
      const { pathname } = new URL(response.url());
      if (response.status() >= 400 && !pathname.startsWith("/api/")) {
        errors.push(`${response.status()} ${pathname}`);
      }
    });
    await provide(errors);
  },
});

export { expect };

/** Waits until the scene has drawn its first frame and stopped drawing. */
export async function waitForIdleScene(page: Page) {
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("html[data-frames]")).toBeAttached();
  const frames = () => page.evaluate(() => Number(document.documentElement.dataset.frames));
  let previous = -1;
  await expect
    .poll(
      async () => {
        const now = await frames();
        const settled = now === previous;
        previous = now;
        return settled;
      },
      { intervals: [500], timeout: 15_000 },
    )
    .toBe(true);
  return frames;
}
