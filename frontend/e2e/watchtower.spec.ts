import { readText } from "../app/features/workbench/test-fixtures";
import { expect, mockWorkbenchApi, test } from "./fixtures";

/**
 * Watchtower W1 on the bench (watchtower.md §3). The level's zone is not open yet, so no link
 * leads here; the page opens by its address. The streams are the engine's own runs of the
 * starter and the reference graph with a scripted model (e2e/data/README.md).
 */
const W1 = "/play/watchtower/direct-injection";
const stream = (name: "starter" | "reference") => readText("e2e", "data", `run-w1-${name}.sse`);

test.describe("watchtower W1", () => {
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
