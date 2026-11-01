import AxeBuilder from "@axe-core/playwright";

import { expect, mockWorkbenchApi, sse, test } from "./fixtures";

// roadmap-v0.4 B4a: the hint ladder (N16) and the first-touch lines (N17).

const L1 = "/play/library/grounded-citation";

test("opens hint 1 on request and hint 2 only after a free look", async ({
  page,
  consoleErrors,
}) => {
  await mockWorkbenchApi(page, { events: () => sse.sample(false) });
  await page.goto(L1);
  await page.getByRole("button", { name: "Mở ca" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả lượt mẫu" })).toBeVisible();

  const hints = page.getByRole("region", { name: "Gợi ý" });
  await expect(hints.getByText("Gợi ý nhắm vào sao 1.", { exact: false })).toBeVisible();
  await hints.getByRole("button", { name: "Xem gợi ý 1" }).click();
  await expect(hints.getByText("câu #1", { exact: false }).first()).toBeVisible();
  // No dead button: what opens hint 2 is said in words.
  await expect(hints.getByRole("button", { name: "Xem gợi ý 2" })).toHaveCount(0);
  await expect(hints.getByText("Gợi ý 2 mở sau khi bạn nhìn thêm", { exact: false })).toBeVisible();

  // The hint's own pointer is a look: it puts case #1 on the bench.
  await hints.getByRole("button", { name: "Xem câu #1" }).click();
  await expect(page.getByText("Đang theo dõi: câu #1", { exact: false })).toBeVisible();
  await hints.getByRole("button", { name: "Xem gợi ý 2" }).click();
  await expect(hints.locator('[data-hint="2"]')).toBeVisible();
  await expect(hints.getByRole("button", { name: /Xem gợi ý/ })).toHaveCount(0);

  // The log the pilot reads: both hints, in order, aimed at star 1.
  const log = await page.evaluate(
    () =>
      (
        JSON.parse(window.localStorage.getItem("vg.hints.v1.grounded-citation") ?? "{}") as {
          log: { n: number; star: number }[];
        }
      ).log,
  );
  expect(log.map((entry) => [entry.n, entry.star])).toEqual([
    [1, 1],
    [2, 1],
  ]);
  expect(consoleErrors).toEqual([]);
});

test("says one line the first time a toy is touched, and never again", async ({ page }) => {
  await mockWorkbenchApi(page);
  await page.goto(L1);
  const dome = page.getByRole("switch", { name: "Gắn Vòm Sao" });
  await dome.check();
  const line = page.locator('[data-first-touch="vector_search"]');
  await expect(line).toBeVisible();
  await expect(line).toContainText("Vòm Sao");

  await page.reload();
  await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
  await expect(page.locator("[data-first-touch]")).toHaveCount(0);
});

test("keeps the hints off the projector (R3)", async ({ page }) => {
  await mockWorkbenchApi(page, { events: () => sse.sample(false) });
  await page.goto(`${L1}?chieu=1`);
  await page.getByRole("button", { name: "Mở ca" }).click();
  await page.getByRole("button", { name: "Mở kết quả" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả lượt mẫu" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Gợi ý" })).toBeHidden();
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
] as const) {
  test(`reads clean with both hints open at ${viewport.width} px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockWorkbenchApi(page, { events: () => sse.sample(false) });
    await page.goto(L1);
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await page.getByRole("button", { name: "Mở ca" }).click();
    const hints = page.getByRole("region", { name: "Gợi ý" });
    await hints.getByRole("button", { name: "Xem gợi ý 1" }).click();
    await hints.getByRole("button", { name: "Xem câu #1" }).click();
    await hints.getByRole("button", { name: "Xem gợi ý 2" }).click();

    const { violations } = await new AxeBuilder({ page })
      .include("#wb-hints")
      .include("[data-first-touch]")
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
