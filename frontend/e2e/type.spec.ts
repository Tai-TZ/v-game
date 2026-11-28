import { expect, mockWorkbenchApi, test } from "./fixtures";

// Task 6 of the graphics upgrade (spec 4.2.1): captions and callouts are set in a self-hosted
// IBM Plex Mono, core to the app and the same in every theme pack.

const W1 = "/play/watchtower/direct-injection";
// The Vietnamese marks that stack highest and widest on a capital or sit below the line.
const MARKS = "Ắ Ặ Ừ Ở ỹ";

test.describe("type", () => {
  test("sets captions in Plex Mono with every Vietnamese mark", async ({ page }) => {
    await mockWorkbenchApi(page, {});
    const fontUrls: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontUrls.push(request.url());
    });
    await page.goto(W1);
    await expect(page.locator("[data-beat-readout]")).toBeVisible();

    // fonts.check() is true for a family nobody declared, so the faces are asked to load too:
    // an empty list means the import is gone.
    const loaded = await page.evaluate(async (marks) => {
      const faces = await document.fonts.load('600 12px "IBM Plex Mono"', marks);
      await document.fonts.ready;
      return {
        faces: faces.map((face) => `${face.family} ${face.weight} ${face.status}`),
        check: document.fonts.check('600 12px "IBM Plex Mono"', marks),
      };
    }, MARKS);
    expect(loaded.check).toBe(true);
    expect(loaded.faces.length).toBeGreaterThan(0);
    for (const face of loaded.faces) expect(face).toMatch(/IBM Plex Mono 600 loaded$/);

    const family = await page
      .locator("[data-beat-readout]")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/^"?IBM Plex Mono"?/);

    // font-src 'self': every font file came from the page's own origin.
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
  });
});
