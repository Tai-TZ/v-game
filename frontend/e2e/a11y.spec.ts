import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, mockApi, mockWorkbenchApi, npcNames, test, titleOf } from "./fixtures";

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

    test("campus hub HUD, with and without the dialogs", async ({ page }) => {
      await mockApi(page);
      await page.goto("/play");
      await expect(page.locator("canvas")).toBeVisible();
      // Mid-fade, the loader card's text is translucent and axe reads it as low contrast.
      await expect(page.locator("[data-scene-loader]")).toHaveCount(0);
      // The view buttons (orbit-camera §2.3) are in the scan, the compass at rest and turned.
      const views = page.getByRole("group", { name: "Góc nhìn" });
      await expect(views.getByRole("button")).toHaveCount(3);
      expect(await seriousViolations(page)).toEqual([]);
      await views.getByRole("button", { name: "Xoay theo chiều kim đồng hồ" }).click();
      await expect(views.getByRole("button", { name: "Về góc nhìn mặc định" })).toHaveAttribute(
        "aria-disabled",
        "false",
      );
      await page.getByRole("button", { name: "Các khu" }).click();
      await expect(page.getByRole("link", { name: "Vào Thư viện" })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);

      await page.getByRole("button", { name: "Nói chuyện với cô Lan", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Cô Lan" })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);

      // An NPC's dialog (npc-cast v0.4 §9), the guard's with its zone card.
      await page.keyboard.press("Escape");
      const { guard } = await npcNames(page);
      await page.getByRole("button", { name: `Nói chuyện với ${guard.name}` }).click();
      await expect(page.getByRole("dialog", { name: titleOf(guard.name) })).toBeVisible();
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

    test("workbench L3 while editing and with results", async ({ page }) => {
      await mockWorkbenchApi(page);
      await page.goto("/play/library/article-number-lookup");
      await expect(page.getByRole("heading", { level: 1, name: "Hỏi bằng số điều" })).toBeVisible();
      await page.getByRole("switch", { name: "Gắn Phễu" }).check();
      expect(await seriousViolations(page)).toEqual([]);

      await page.getByRole("switch", { name: "Gắn Tủ ngăn kéo" }).check();
      await page.getByRole("button", { name: "Mở ca" }).click();
      await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
      for (const details of await page.locator("details").all()) {
        await details.evaluate((element) => element.setAttribute("open", ""));
      }
      expect(await seriousViolations(page)).toEqual([]);
    });

    test("library zone page", async ({ page }) => {
      await mockApi(page);
      await page.goto("/play/library");
      await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}
