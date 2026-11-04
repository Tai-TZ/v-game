import type { Page } from "@playwright/test";

import { CARDS, PLACES } from "../app/features/micro/dataKinds";
import { FUSED, PASSAGES, rawSumOrder, LISTS } from "../app/features/micro/rrf";
import { expect, mockWorkbenchApi, test } from "./fixtures";

/**
 * The Library's two warm-ups (plan v0.7 4.5, roadmap-v0.4 B8): "Ba loại dữ liệu" before L1 and
 * "Tự tay trộn RRF" before L3, each reached from its level's brief and from the zone page. A
 * lesson calls no API and stores no progress; the right answers come from the lesson modules,
 * which derive them, so nothing here types an expected number.
 */
const L1 = "/play/library/grounded-citation";
const L3 = "/play/library/article-number-lookup";

/** API requests made from now on: a micro lesson makes none. */
function apiCalls(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/api/")) calls.push(pathname);
  });
  return calls;
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const placeName = (id: string) => PLACES.find((p) => p.id === id)?.name ?? "";
const label = (id: string) => PASSAGES.find((p) => p.id === id)?.label ?? id;

for (const viewport of [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
] as const) {
  test.describe(`library warm-ups at ${viewport.width} px`, () => {
    test.use({ viewport });

    test("sorts the nine cards from L1's brief, then goes back to the level", async ({
      page,
      consoleErrors,
    }) => {
      await mockWorkbenchApi(page);
      await page.goto(L1);
      await page.getByRole("link", { name: "Khởi động 2 phút: Ba loại dữ liệu" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Ba loại dữ liệu" })).toBeFocused();
      const calls = apiCalls(page);
      // Everything into the vector store: the store's own cards are right, the rest went there
      // by mistake, which is the kind the lesson is about.
      for (const card of await page.locator("[data-card]").all()) {
        await card.getByRole("radio", { name: "Kho vector" }).check({ force: true });
      }
      await page.getByRole("button", { name: "Kiểm tra" }).click();
      const grade = page.locator("[data-grade]");
      await expect(grade).toBeFocused();
      const store = CARDS.filter((c) => c.place === "kho_vector").length;
      await expect(grade).toHaveAttribute("data-right", String(store));
      await expect(grade).toContainText(
        `${CARDS.length - store} thẻ nhầm vào kho vector · 0 thẻ nhồi vào lời dặn · 0 thẻ ép thành tra cứu`,
      );
      await expect(grade.locator("[data-miss-lesson]")).toHaveCount(1);
      await expect(page.locator('[data-card][data-verdict="vao_kho"]')).toHaveCount(
        CARDS.length - store,
      );
      expect(await noSideScroll(page)).toBe(0);
      expect(calls).toEqual([]);
      expect(await page.evaluate(() => localStorage.getItem("vg-progress-v1"))).toBeNull();
      await grade.getByRole("link", { name: "Vào màn Thôi bịa điều luật" }).click();
      await expect(page).toHaveURL(L1);
      expect(consoleErrors).toEqual([]);
    });

    test("mixes the two lists by hand from L3's brief, then checks the order", async ({
      page,
      consoleErrors,
    }) => {
      await mockWorkbenchApi(page);
      await page.goto(L3);
      await page.getByRole("link", { name: "Khởi động 2 phút: Tự tay trộn RRF" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Tự tay trộn RRF" })).toBeFocused();
      const calls = apiCalls(page);
      for (const chip of await page.locator("[data-chip]").all()) await chip.click();
      await expect(page.locator('[data-chip][aria-pressed="true"]')).toHaveCount(
        LISTS.reduce((n, l) => n + l.hits.length, 0),
      );
      for (const f of FUSED) {
        await page.locator(`[data-fused="${f.passage}"]`).getByRole("button").click();
      }
      await page.getByRole("button", { name: "Kiểm tra" }).click();
      const grade = page.locator("[data-grade]");
      await expect(grade).toBeFocused();
      await expect(grade).toHaveAttribute("data-right", String(FUSED.length));
      await expect(page.locator('[data-fused][data-verdict="right"]')).toHaveCount(FUSED.length);
      // What adding the raw scores would have put first, which the Phễu does not.
      const raw = rawSumOrder(LISTS)[0]?.passage ?? "";
      await expect(grade.locator("[data-raw-order] li").first()).toHaveAttribute(
        "data-passage",
        raw,
      );
      await expect(grade.locator("[data-fused-order] li").first()).toContainText(
        label(FUSED[0]?.passage ?? ""),
      );
      expect(await noSideScroll(page)).toBe(0);
      expect(calls).toEqual([]);
      expect(await page.evaluate(() => localStorage.getItem("vg-progress-v1"))).toBeNull();
      await grade.getByRole("link", { name: "Vào màn Hỏi bằng số điều" }).click();
      await expect(page).toHaveURL(L3);
      expect(consoleErrors).toEqual([]);
    });
  });
}

test.describe("library warm-ups", () => {
  test("are both on the zone page, each just before its level", async ({ page, consoleErrors }) => {
    await mockWorkbenchApi(page);
    await page.goto("/play/library");
    const rows = page.locator("main ol > li");
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0)).toHaveAttribute("data-warmup-row", "");
    await expect(rows.nth(1)).toHaveAttribute("data-level", "grounded-citation");
    await expect(rows.nth(3)).toHaveAttribute("data-warmup-row", "");
    await expect(rows.nth(4)).toHaveAttribute("data-level", "article-number-lookup");

    await page.getByRole("link", { name: "Làm bài khởi động Ba loại dữ liệu" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ba loại dữ liệu" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link")).toHaveAccessibleName(
      "Về màn Thôi bịa điều luật",
    );
    await page.goBack();
    await page.getByRole("link", { name: "Làm bài khởi động Tự tay trộn RRF" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Tự tay trộn RRF" })).toBeVisible();
    await expect(page).toHaveURL("/play/library/vi-mo/tu-tay-tron-rrf");
    expect(consoleErrors).toEqual([]);
  });

  test("answers a library lesson asked for under another zone as not found", async ({ page }) => {
    await mockWorkbenchApi(page);
    await page.goto("/play/watchtower/vi-mo/tu-tay-tron-rrf");
    await expect(
      page.getByRole("heading", { level: 1, name: "Không tìm thấy trang" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Tự tay trộn RRF" })).toHaveCount(0);
  });

  test("works from the keyboard alone", async ({ page }) => {
    await mockWorkbenchApi(page);
    await page.goto("/play/library/vi-mo/ba-loai-du-lieu");
    const first = page.locator("[data-card]").first();
    await first.getByRole("radio", { name: placeName("kho_vector") }).focus();
    await page.keyboard.press("Space");
    await expect(first.getByRole("radio", { name: placeName("kho_vector") })).toBeChecked();
    // Arrow keys move the pick within one card, as a radio group should.
    await page.keyboard.press("ArrowRight");
    await expect(first.getByRole("radio", { name: placeName("tra_cuu") })).toBeChecked();

    await page.goto("/play/library/vi-mo/tu-tay-tron-rrf");
    const chip = page.locator("[data-chip]").first();
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(page.locator("[data-chip]").nth(1)).toHaveAttribute("aria-pressed", "true");
  });

  test("keeps projector mode on a lesson page", async ({ page }) => {
    await mockWorkbenchApi(page);
    await page.goto("/play/library/vi-mo/tu-tay-tron-rrf?chieu=1");
    await expect(page.locator("html")).toHaveClass(/\bchieu\b/);
    await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();
    expect(await noSideScroll(page)).toBe(0);
  });
});
