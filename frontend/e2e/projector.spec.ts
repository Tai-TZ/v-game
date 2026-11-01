import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, mockWorkbenchApi, test } from "./fixtures";

// Projector mode, lesson-plan appendix R1-R10 (roadmap-v0.4 B7).

const L1 = "/play/library/grounded-citation";

// R9 "cả hai theme": the theme packs, read from the repo rather than named here (ADR 0002).
const THEMES = (
  JSON.parse(readFileSync("public/themes/index.json", "utf8")) as { themes: { id: string }[] }
).themes.map((theme) => theme.id);

async function seriousViolations(page: Page) {
  // At rest only: see the same wait in a11y.spec.ts.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const px = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  for (const theme of THEMES) {
    test(`reads from the back row at ${viewport.width}×${viewport.height}, theme ${theme}`, async ({
      page,
      consoleErrors,
    }, testInfo) => {
      // A projector is a laptop's second screen: the phone project has nothing to add here, and
      // its emulated device cannot take a 1920 px full-page capture.
      test.skip(testInfo.project.name !== "desktop", "A projector hangs off a desktop.");
      await page.setViewportSize(viewport);
      await page.addInitScript((id) => window.localStorage.setItem("vg-theme", id), theme);
      await mockWorkbenchApi(page);
      await page.goto(`${L1}?chieu=1`);
      await expect(page.locator("html")).toHaveClass(/\bchieu\b/);

      // R4: the room's guess, with big letters and nothing to type.
      const hands = page.getByRole("region", { name: "Cả lớp đoán" });
      await expect(hands).toBeVisible();
      for (const letter of ["A", "B", "C"])
        await expect(hands.getByText(letter, { exact: true })).toBeVisible();

      // R2: body text at least 24 px, headings at least 40 px.
      expect(await px(page, "#wb-quota p")).toBeGreaterThanOrEqual(24);
      expect(await px(page, "main h1")).toBeGreaterThanOrEqual(40);
      expect(await px(page, "#wb-open-title")).toBeGreaterThanOrEqual(40);

      // R3: one column, nothing of a pair's own (the JSON log, the guess slip).
      await expect(page.getByText("Xem cấu hình JSON")).toBeHidden();
      await expect(page.getByText("Đoán trước khi mở ca")).toBeHidden();
      await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();

      // R9, R10: contrast and the rest of axe, no sideways scroll.
      expect(await seriousViolations(page)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await testInfo.attach(`chieu-${viewport.width}-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      expect(consoleErrors).toEqual([]);
    });
  }
}

test("covers the recorded run until the teacher opens it from the keyboard (R4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockWorkbenchApi(page);
  await page.goto(`${L1}?chieu=1`);
  await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();

  const table = page.getByRole("region", { name: "Bảng câu" });
  await expect(table.getByText("Đã chấm").first()).toBeVisible();
  await expect(table.getByText(/Đạt|Trượt/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeHidden();

  // The way in takes focus, so Enter (or Space) is all the teacher needs.
  const reveal = page.getByRole("button", { name: "Mở kết quả" });
  await expect(reveal).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
  await expect(table.getByText("Đã chấm")).toHaveCount(0);
  // R3: the score stays; a pair's history and cô Lan's hints do not.
  await expect(page.getByText("Xem vết chạy").first()).toBeHidden();
});

test("leaves the mode and does not remember it (R1)", async ({ page }) => {
  await mockWorkbenchApi(page);
  await page.goto(`${L1}?chieu=1`);
  await page.getByRole("button", { name: "Thoát chế độ chiếu" }).click();
  await expect(page).toHaveURL(new RegExp(`${L1}$`));
  await expect(page.locator("html")).not.toHaveClass(/\bchieu\b/);
  await expect(page.getByRole("region", { name: "Cả lớp đoán" })).toHaveCount(0);

  await page.goto(L1);
  await expect(page.locator("html")).not.toHaveClass(/\bchieu\b/);
});

test("works on the zone page too (R1)", async ({ page }) => {
  await mockWorkbenchApi(page);
  await page.goto("/play/library?chieu=1");
  await expect(page.locator("html")).toHaveClass(/\bchieu\b/);
  await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();
});

test("says the server is waking and still offers the recorded run (R6)", async ({ page }) => {
  await mockWorkbenchApi(page);
  // Registered last, so it wins over the fixture's quota route.
  await page.route(
    (url) => url.pathname === "/api/quota",
    (route) => route.fulfill({ status: 503, json: {} }),
  );
  await page.goto(`${L1}?chieu=1`);
  await expect(page.getByText("Đang đánh thức máy chủ")).toBeVisible();
  await expect(page.getByText("Máy chiếu còn 40 lời gọi hôm nay (ước tính)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lượt đã ghi" })).toBeVisible();
});
