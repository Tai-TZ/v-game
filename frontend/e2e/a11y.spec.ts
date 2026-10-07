import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, mockApi, test } from "./fixtures";

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
] as const;

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    );
}

for (const viewport of VIEWPORTS) {
  test.describe(`axe at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test("campus hub HUD, with and without the dialog", async ({ page }) => {
      await mockApi(page);
      await page.goto("/play");
      await expect(page.locator("canvas")).toBeVisible();
      await page.getByRole("button", { name: "Các khu" }).click();
      await expect(page.getByRole("link", { name: "Vào Thư viện" })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);

      await page.getByRole("button", { name: "Nói chuyện với cô Lan", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Cô Lan" })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });

    test("landing page", async ({ page }) => {
      await mockApi(page);
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });

    test("landing and library pages with the town theme saved", async ({ page }) => {
      await mockApi(page);
      await page.addInitScript(() => window.localStorage.setItem("vg-theme", "town"));
      for (const path of ["/", "/play/library"]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", "town");
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
      }
    });

    test("library zone page", async ({ page }) => {
      await mockApi(page);
      await page.goto("/play/library");
      await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}
