import { readFileSync } from "node:fs";
import path from "node:path";

import { test as base, expect, type Page, type Request } from "@playwright/test";

import { blocksJson, publicLevelJson, readText } from "../app/features/workbench/test-fixtures";

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
      if (
        /Failed to load resource: the server responded with a status of (404|409|422|429|500|503)/.test(
          text,
        )
      )
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
export async function waitForIdleScene(page: Page, timeout = 15_000) {
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
      { intervals: [500], timeout },
    )
    .toBe(true);
  return frames;
}

/** Captured SSE bodies (e2e/data); see e2e/data/README.md. */
export const sse = {
  short: () => readText("e2e", "data", "run-l1-short.sse"),
  reference: () => readText("e2e", "data", "run-l1-reference.sse"),
};

export const runId = (n: number) => n.toString(16).padStart(32, "0");

export interface WorkbenchReply extends Reply {
  headers?: Record<string, string>;
}

export interface WorkbenchMock {
  /** Every POST /api/runs, in order. */
  posts: { key: string | null; contentType: string | null; body: string }[];
  /** Run ids of every POST /api/runs/{id}/cancel. */
  cancels: string[];
  /** GET /api/runs/{id}/events requests so far. */
  streams: number;
}

/**
 * Mocks the zones API plus the engine API the workbench uses: levels and blocks from e2e/data,
 * POST /api/runs (202 with run ids 1, 2, … unless `post` says otherwise), the SSE stream (the
 * short L1 run unless `events` says otherwise) and cancel (202).
 */
export async function mockWorkbenchApi(
  page: Page,
  options: {
    /** Reply to the n-th POST; a promise holds the request open until it settles. */
    post?: (
      n: number,
      request: Request,
    ) => WorkbenchReply | undefined | Promise<WorkbenchReply | undefined>;
    /** Body of the n-th stream. Chrome adds Last-Event-ID below Playwright's interception, so
     * a test of that header needs a real server (see the reconnect test). */
    events?: (n: number) => string | Promise<string>;
    /** Status of the n-th cancel (202 unless it says otherwise); a promise holds it open. */
    cancel?: (n: number) => number | Promise<number>;
  } = {},
): Promise<WorkbenchMock> {
  await mockApi(page);
  const mock: WorkbenchMock = { posts: [], cancels: [], streams: 0 };
  await page.route("**/api/blocks", (route) => route.fulfill({ json: blocksJson() }));
  await page.route("**/api/levels/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    try {
      return route.fulfill({ json: publicLevelJson(id) });
    } catch {
      return route.fulfill({ status: 404, json: { detail: "Không tìm thấy level." } });
    }
  });
  await page.route(
    (url) => url.pathname === "/api/runs",
    async (route) => {
      const request = route.request();
      mock.posts.push({
        key: request.headers()["idempotency-key"] ?? null,
        contentType: request.headers()["content-type"] ?? null,
        body: request.postData() ?? "",
      });
      const n = mock.posts.length;
      const reply = (await options.post?.(n, request)) ?? {
        status: 202,
        body: { run_id: runId(n), created: true, issues: [] },
      };
      return route.fulfill({
        status: reply.status,
        json: reply.body ?? {},
        ...(reply.headers ? { headers: reply.headers } : {}),
      });
    },
  );
  await page.route("**/api/runs/*/events", async (route) => {
    mock.streams += 1;
    const body = await (options.events?.(mock.streams) ?? sse.short());
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
      body,
    });
  });
  await page.route("**/api/runs/*/cancel", async (route) => {
    mock.cancels.push(new URL(route.request().url()).pathname.split("/").at(-2) ?? "");
    const status = (await options.cancel?.(mock.cancels.length)) ?? 202;
    return route.fulfill({
      status,
      json: status === 202 ? { cancelled: true } : { detail: "Máy chủ gặp lỗi." },
    });
  });
  return mock;
}
