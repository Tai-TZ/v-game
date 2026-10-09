// QA findings (2026-10-07). Each test fails on the current build and should pass once fixed.
import { expect, mockApi, test, zoneList } from "./fixtures";

test.describe("QA regressions", () => {
  test("a viewer with a saved non-default theme loads pages without a hydration error", async ({
    page,
    consoleErrors,
  }) => {
    await mockApi(page);
    // A viewer who switched theme on an earlier visit (key from app/features/theme/paths.ts).
    await page.addInitScript(() => window.localStorage.setItem("vg-theme", "town"));
    for (const path of ["/", "/play", "/play/library"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "town");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      // The transition guard set by the bootstrap script must lift once town.css applies.
      await expect(page.locator("html")).not.toHaveClass(/vg-theme-loading/);
    }
    // Today: "Minified React error #418" (the bootstrap script rewrites the <link href> React hydrates).
    expect(consoleErrors).toEqual([]);
  });

  test("retrying the zone list keeps focus inside the open panel", async ({ page }) => {
    let fail = true;
    await mockApi(page, {
      list: () => (fail ? { status: 500 } : { status: 200, body: zoneList() }),
    });
    await page.goto("/play");
    await page.getByRole("button", { name: "Các khu" }).click();
    await page.getByRole("button", { name: "Thử lại" }).focus();
    fail = false;
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Vào Thư viện" })).toBeVisible();
    // Today focus falls to <body>, where arrow keys move the player behind the open panel.
    expect(
      await page.evaluate(
        () => document.getElementById("hub-zone-list")?.contains(document.activeElement) ?? false,
      ),
    ).toBe(true);
  });

  test("a focus ring shows in its own colour at once, without fading in", async ({ page }) => {
    await mockApi(page);
    await page.goto("/play/library");
    const back = page.getByRole("banner").getByRole("link").first();
    await back.focus();
    // transition-colors also animates outline-color: the ring faded in from the text colour.
    expect(await back.evaluate((el) => getComputedStyle(el).transitionProperty)).not.toMatch(
      /outline/,
    );
  });
});
