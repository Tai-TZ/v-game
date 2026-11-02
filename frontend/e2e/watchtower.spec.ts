import { readText } from "../app/features/workbench/test-fixtures";
import { expect, mockWorkbenchApi, test } from "./fixtures";

/**
 * Watchtower W1 on the bench (watchtower.md §3), reached from the open zone page; W2 and W3 are
 * listed there as coming. The streams are the engine's own runs of the starter and the
 * reference graph with a scripted model (e2e/data/README.md).
 */
const W1 = "/play/watchtower/direct-injection";
const stream = (name: "starter" | "reference") => readText("e2e", "data", `run-w1-${name}.sse`);

test.describe("watchtower W1", () => {
  test("warms up on the tool-risk ladder from the brief, then goes back to the level", async ({
    page,
    consoleErrors,
  }) => {
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto(W1);
    await page.getByRole("link", { name: "Khởi động 2 phút: Thang rủi ro tool" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Thang rủi ro tool" })).toBeVisible();
    // Every job set to "Tự chạy": the read-only ones are right, the rest let something through.
    for (const card of await page.locator("[data-card]").all()) {
      await card.getByText("Tự chạy", { exact: true }).click();
    }
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    const grade = page.locator("[data-grade]");
    await expect(grade).toBeFocused();
    await expect(grade).toHaveAttribute("data-right", "3");
    await expect(grade).toContainText("5 việc để lọt · 0 việc hỏi thừa");
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(scroll).toBe(0);
    await grade.getByRole("link", { name: "Vào màn Cổng thành" }).click();
    await expect(page).toHaveURL(W1);
    expect(consoleErrors).toEqual([]);
  });

  test("answers an unknown micro lesson as not found", async ({ page }) => {
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto("/play/watchtower/vi-mo/khong-co");
    await expect(page.getByRole("heading", { level: 1, name: "Thang rủi ro tool" })).toHaveCount(0);
  });

  test("is reached from the zone page, where the levels still coming have no way in", async ({
    page,
    consoleErrors,
  }) => {
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto("/play/watchtower");
    const coming = page.locator('[data-level-status="coming_soon"]');
    await expect(coming).toHaveCount(2);
    await expect(coming.getByRole("link")).toHaveCount(0);
    await page.getByRole("link", { name: "Vào màn Cổng thành" }).click();
    await expect(page).toHaveURL(W1);
    await expect(page.locator("[data-scene-total]")).toHaveText(/HOÀN TIỀN 5\.000\.000 đ/);
    expect(consoleErrors).toEqual([]);
  });

  test("builds the desk's fences with the toys and reads the ledger of a run", async ({
    page,
    consoleErrors,
  }) => {
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto(W1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-scene-total]")).toHaveText(/HOÀN TIỀN 5\.000\.000 đ/);

    // The starter: no bell, so the tool branch runs red straight to the ledger.
    const branch = page.locator("[data-pipe-branch]");
    await expect(branch).toHaveCount(2);
    for (const pipe of await branch.all())
      await expect(pipe).toHaveAttribute("data-pipe", "unguarded");

    // The net opens first: a phrase is pressed into it from the tray.
    await page.getByRole("switch", { name: "Gắn Lưới cụm từ" }).check();
    const phrase = page.getByRole("button", { name: "quản trị viên", exact: true });
    await phrase.click();
    await expect(phrase).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-gauge-phrase]")).toHaveCount(1);

    // The bell, attached from its socket on the machine, gates the branch.
    await page.getByRole("button", { name: "Gắn Chuông duyệt" }).click();
    for (const pipe of await branch.all()) await expect(pipe).toHaveAttribute("data-pipe", "gated");

    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" })).toBeFocused();
    await expect(page.getByText("0/3 sao", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Anh Quân chẩn đoán" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("hears anh Quân's win line after a three-star run", async ({ page, consoleErrors }) => {
    await mockWorkbenchApi(page, { events: () => stream("reference") });
    await page.goto(W1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByText("3/3 sao", { exact: true })).toBeVisible();
    await expect(page.getByText(/Không chặn nhầm ai, không hỏi thừa ai/)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
