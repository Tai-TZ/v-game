import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, mockApi, test, waitForIdleScene } from "./fixtures";

const CLIENT_DIR = path.resolve(import.meta.dirname, "..", "build", "client");

test.describe("scene loader", () => {
  test("pre-rendered pages carry no inline styles (CSP style-src 'self')", () => {
    for (const file of ["index.html", "play/index.html", "__spa-fallback.html"]) {
      const html = readFileSync(path.join(CLIENT_DIR, file), "utf8");
      expect(html, file).not.toMatch(/\sstyle=/);
      expect(html, file).not.toMatch(/<style[\s>]/);
    }
  });

  test("marks every load stage in order and leaves an idle scene idle", async ({
    page,
    consoleErrors,
  }) => {
    await mockApi(page);
    await page.goto("/play?debug=frames");
    const frames = await waitForIdleScene(page);
    const marks = await page.evaluate(() =>
      performance
        .getEntriesByType("mark")
        .map((mark) => mark.name)
        .filter((name) => name.startsWith("vg-scene-")),
    );
    expect(marks).toEqual(["vg-scene-1", "vg-scene-2", "vg-scene-3", "vg-scene-4", "vg-scene-5"]);
    const before = await frames();
    // Measuring idleness needs time to pass; no state is being waited for here.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    expect(await frames()).toBe(before);
    expect(consoleErrors).toEqual([]);
  });

  test.describe("before any JS runs", () => {
    test.use({ javaScriptEnabled: false });

    test("paints the loader on the sky colour, not white", async ({ page }) => {
      await page.goto("/play");
      const loader = page.locator("main");
      await expect(loader).toHaveCount(1);
      await expect(loader.getByText("Đang tải khuôn viên")).toBeVisible();
      const [background, sky] = await loader.evaluate((element) => {
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
