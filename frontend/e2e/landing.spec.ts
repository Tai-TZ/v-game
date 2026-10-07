import { bundleReport, expect, mockApi, test } from "./fixtures";

test("landing page loads without any three.js or scene chunk", async ({ page, consoleErrors }) => {
  await mockApi(page);
  const requested: string[] = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(bundleReport.threeChunks.length).toBeGreaterThan(0);
  const forbidden = new Set([...bundleReport.threeChunks, ...bundleReport.sceneChunks]);
  const loaded = requested.filter((pathname) => forbidden.has(pathname.replace(/^\//, "")));
  expect(loaded).toEqual([]);
  // Vietnamese text must come from the vietnamese subset, not the 72 kB latin-ext one.
  expect(requested.filter((pathname) => pathname.includes("latin-ext"))).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
