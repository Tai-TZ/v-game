import { readFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { cameraCentre, desiredCentre, toScreen, viewFor } from "../app/features/campus/camera";
import { arrivalPose, BASE, siteFor, SPAWN, type Vec2 } from "../app/features/campus/layout";
import { bundleReport, expect, mockApi, test, waitForIdleScene } from "./fixtures";

const CLIENT_DIR = path.resolve(import.meta.dirname, "..", "build", "client");
const VIEWPORTS = [
  // Overview: the board's back corner (top of the diamond) is on screen.
  { width: 1280, height: 800, project: "desktop", at: null, edge: [BASE.minX, BASE.minZ] },
  // Follow mode, arriving at the library: a point on the board's back-left edge.
  { width: 375, height: 812, project: "mobile", at: "library", edge: [BASE.minX, -11.5] },
] as const;

const loader = (page: Page) => page.locator("[data-scene-loader]");

/**
 * The lazy scene chunk itself (the one holding three.js). Not every file of `sceneChunks`: the
 * scene shares a chunk with the route (the loader's store and the camera maths).
 */
const sceneChunk = new Set(bundleReport.threeChunks.map((file) => `/${file}`));

/** Holds the scene chunk request until `release()`, so the loader stays at step 2. */
async function holdScene(page: Page) {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => sceneChunk.has(url.pathname),
    async (route) => {
      await held;
      await route.continue();
    },
  );
  return () => release();
}

/** Where a ground point lands on screen in the first 3D frame (useHubFrame's first camera). */
function groundPixel(width: number, height: number, x: number, z: number, player: Vec2 = SPAWN) {
  const view = viewFor(width, height);
  const focus = toScreen(player.x, 0, player.z);
  const centre = cameraCentre(desiredCentre(focus, focus, view), view);
  const p = toScreen(x, 0, z);
  return {
    x: width / 2 + (p.sx - centre.sx) * view.zoom,
    y: height / 2 - (p.sy - centre.sy) * view.zoom,
  };
}

const marks = (page: Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType("mark")
      .map((mark) => mark.name)
      .filter((name) => name.startsWith("vg-scene-")),
  );

test.describe("scene loader", () => {
  test("pre-rendered pages carry no inline styles (CSP style-src 'self')", () => {
    for (const file of ["index.html", "play/index.html", "__spa-fallback.html"]) {
      const html = readFileSync(path.join(CLIENT_DIR, file), "utf8");
      expect(html, file).not.toMatch(/\sstyle=/);
      expect(html, file).not.toMatch(/<style[\s>]/);
    }
  });

  test("leaves after the first frame, marks every stage in order, leaves an idle scene idle", async ({
    page,
    consoleErrors,
  }) => {
    await mockApi(page);
    await page.goto("/play?debug=frames");
    const frames = await waitForIdleScene(page);
    await expect(loader(page)).toHaveCount(0);
    expect(await marks(page)).toEqual([
      "vg-scene-1",
      "vg-scene-2",
      "vg-scene-3",
      "vg-scene-4",
      "vg-scene-5",
    ]);
    const before = await frames();
    // Measuring idleness needs time to pass; no state is being waited for here.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    expect(await frames()).toBe(before);
    expect(consoleErrors).toEqual([]);
  });

  test("covers a warm re-entry from a zone page, then leaves", async ({ page, consoleErrors }) => {
    test.slow();
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    await page.getByRole("button", { name: "Các khu" }).click();
    await page.getByRole("link", { name: "Vào Thư viện" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Về khuôn viên" }).click();
    await expect(page).toHaveURL(/\/play\?at=library$/);
    await waitForIdleScene(page);
    await expect(loader(page)).toHaveCount(0);
    expect((await marks(page)).filter((name) => name === "vg-scene-5")).toHaveLength(2);
    expect(consoleErrors).toEqual([]);
  });

  test("gives way to the boundary note when the scene chunk fails", async ({ page }) => {
    await mockApi(page);
    await page.route(
      (url) => sceneChunk.has(url.pathname),
      (route) => route.abort(),
    );
    await page.goto("/play");
    await expect(page.getByText("Trình duyệt chưa hiển thị được cảnh 3D.")).toBeVisible();
    await expect(loader(page)).toHaveCount(0);
  });

  for (const viewport of VIEWPORTS) {
    test.describe(`while the scene chunk downloads, at ${viewport.width}×${viewport.height}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });
      // The desktop project checks 1280×800, the (touch) mobile project 375×812.
      test.skip(
        ({ isMobile }) => isMobile !== (viewport.project === "mobile"),
        "One project per viewport.",
      );

      test("shows step 2 without covering the HUD, with few announcements", async ({ page }) => {
        // Software compositing redraws the looping logo block every frame; axe is slow on top.
        test.slow();
        await mockApi(page);
        const release = await holdScene(page);
        await page.goto("/play");
        await expect(loader(page)).toHaveCount(1);
        await expect(loader(page).getByText("Đang tải bộ dựng 3D")).toBeVisible();
        await expect(loader(page).getByText("Bước 2/5")).toBeVisible();

        const card = await loader(page).getByRole("region").boundingBox();
        expect(card).not.toBeNull();
        for (const control of [
          page.getByRole("button", { name: "Các khu" }),
          page.getByRole("link", { name: "Về trang chủ" }),
        ]) {
          await expect(control).toBeVisible();
          const box = await control.boundingBox();
          if (!card || !box) continue;
          const apart =
            box.x + box.width <= card.x ||
            card.x + card.width <= box.x ||
            box.y + box.height <= card.y ||
            card.y + card.height <= box.y;
          expect(apart, `${JSON.stringify(box)} overlaps the card`).toBe(true);
        }

        const changes = await page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const region = document.querySelector("[data-scene-loader] [role=status]");
              let count = 0;
              const observer = new MutationObserver(() => (count += 1));
              if (region)
                observer.observe(region, { childList: true, characterData: true, subtree: true });
              setTimeout(() => {
                observer.disconnect();
                resolve(count);
              }, 3000);
            }),
        );
        expect(changes).toBeLessThanOrEqual(2);

        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(
          violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map((v) => `${v.id}: ${v.nodes.map((node) => node.target.join(" ")).join(", ")}`),
        ).toEqual([]);
        release();
      });

      test("draws the board exactly where the 3D board will be", async ({ page }) => {
        await mockApi(page);
        const release = await holdScene(page);
        await page.goto("/play");
        await expect(page.locator('[data-bp="board"]')).toBeAttached();
        expect(await loader(page).boundingBox()).toEqual(
          await page.locator("[data-campus-scene]").boundingBox(),
        );
        const corners = [
          [BASE.minX, BASE.minZ],
          [BASE.maxX, BASE.minZ],
          [BASE.maxX, BASE.maxZ],
          [BASE.minX, BASE.maxZ],
        ].map(([x = 0, z = 0]) => groundPixel(viewport.width, viewport.height, x, z));
        const xs = corners.map((c) => c.x);
        const ys = corners.map((c) => c.y);
        const board = await page.locator('[data-bp="board"]').boundingBox();
        expect(board).not.toBeNull();
        if (board) {
          expect(Math.abs(board.x - Math.min(...xs))).toBeLessThanOrEqual(1);
          expect(Math.abs(board.y - Math.min(...ys))).toBeLessThanOrEqual(1);
          expect(Math.abs(board.x + board.width - Math.max(...xs))).toBeLessThanOrEqual(1);
          expect(Math.abs(board.y + board.height - Math.max(...ys))).toBeLessThanOrEqual(1);
        }
        release();
      });

      test("is fully drawn and still with reduced motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mockApi(page);
        const release = await holdScene(page);
        await page.goto("/play");
        await expect(page.locator(".bp-pc").first()).toBeAttached();
        await expect(page.locator(".bp-pc:not(.is-set)")).toHaveCount(0);
        // The appear delay and one-shot pops end at once; an infinite loop never would.
        await expect
          .poll(() =>
            page.evaluate(() =>
              document
                .getAnimations()
                .filter((a) => a.playState === "running")
                .map((a) => (a instanceof CSSAnimation ? a.animationName : "?")),
            ),
          )
          .toEqual([]);
        release();
      });

      test("hands over to a 3D board that starts where the blueprint's did", async ({ page }) => {
        await mockApi(page);
        const { at, edge } = viewport;
        await page.goto(at ? `/play?at=${at}&debug=frames` : "/play?debug=frames");
        await waitForIdleScene(page);
        await expect(loader(page)).toHaveCount(0);
        // A point on a back edge of the board, projected like the blueprint: 4 px above it is
        // sky (the page's own colour behind the transparent canvas), 4 px below it the board.
        const [x, z] = edge;
        const player = at ? arrivalPose(siteFor(at)).position : SPAWN;
        const point = groundPixel(viewport.width, viewport.height, x, z, player);
        const pixel = async (px: number, py: number) => {
          const shot = await page.screenshot({
            clip: { x: Math.round(px), y: Math.round(py), width: 1, height: 1 },
            scale: "css",
          });
          return shot.toString("base64");
        };
        const sky = await pixel(2, at ? 100 : viewport.height - 2);
        expect(await pixel(point.x, point.y - 4)).toBe(sky);
        expect(await pixel(point.x, point.y + 4)).not.toBe(sky);
      });
    });
  }

  test.describe("before any JS runs", () => {
    test.use({ javaScriptEnabled: false });

    test("paints step 1 on the sky colour, not white", async ({ page }) => {
      await page.goto("/play");
      await expect(loader(page)).toHaveCount(1);
      await expect(loader(page).getByText("Đang mở sa bàn")).toBeVisible();
      await expect(loader(page).getByText("Bước 1/5")).toBeVisible();
      const [background, sky] = await loader(page).evaluate((element) => {
        const probe = document.createElement("div");
        probe.className = "bg-scene";
        document.body.append(probe);
        const colours = [
          getComputedStyle(element).backgroundColor,
          getComputedStyle(probe).backgroundColor,
        ];
        probe.remove();
        return colours;
      });
      expect(background).toBe(sky);
      expect(background).not.toBe("rgb(255, 255, 255)");
    });
  });
});
