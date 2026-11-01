import AxeBuilder from "@axe-core/playwright";

import { expect, mockWorkbenchApi, sse, test } from "./fixtures";

// roadmap-v0.4 §5.1: the day's pool of fresh AI calls beside Mở ca.

const L1 = "/play/library/grounded-citation";
const quota = (learnerDaily: number) => ({
  cap: 500,
  used: 0,
  remaining: 500,
  resets_at: "2026-11-02T00:00:00+00:00",
  estimate: true,
  reserve_left: 17,
  learner_daily: learnerDaily,
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
] as const) {
  test(`shows the pool and this shift's price at ${viewport.width} px`, async ({
    page,
    consoleErrors,
  }) => {
    await page.setViewportSize(viewport);
    await mockWorkbenchApi(page, { quota: quota(13) });
    await page.goto(L1);

    const pool = page.locator("#wb-quota");
    await expect(
      pool.getByText("Còn 13 lời gọi hôm nay (ước tính)", { exact: false }),
    ).toBeVisible();
    await expect(pool.getByText("Lượt này tốn tối đa 10 lời gọi.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mở ca" })).toBeEnabled();

    const { violations } = await new AxeBuilder({ page }).include("#wb-quota").analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(consoleErrors).toEqual([]);
  });
}

test("runs the samples alone when the pool covers only them, and says so", async ({ page }) => {
  const mock = await mockWorkbenchApi(page, { quota: quota(5), events: () => sse.sample() });
  await page.goto(L1);

  await expect(page.getByText("Quỹ hôm nay chỉ đủ cho 3 câu mẫu.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở ca" })).toHaveCount(0);
  await page.getByRole("button", { name: "Thử 3 câu mẫu" }).click();

  await expect(page.getByRole("heading", { name: "Kết quả lượt mẫu" })).toBeVisible();
  await expect(
    page.getByText("Cả 3 câu mẫu đạt. Quỹ hôm nay không đủ cho run chấm sao", { exact: false }),
  ).toBeVisible();
  // One POST: all three samples passed, and still no star run went out.
  expect(mock.posts.map((p) => p.scope)).toEqual(["mau"]);
  await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeHidden();
});

test("offers the free recorded run once the pool is spent", async ({ page }) => {
  const mock = await mockWorkbenchApi(page, { quota: quota(2) });
  await page.goto(L1);

  await expect(page.getByText("Quỹ hôm nay đã hết.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();
  expect(mock.posts).toEqual([]);
});
