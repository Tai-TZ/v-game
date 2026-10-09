import { expect, mockApi, seedDetail, test } from "./fixtures";

test.describe("zone page", () => {
  test("lists the library's three levels in order, each with a way into its workbench", async ({
    page,
    consoleErrors,
  }) => {
    await mockApi(page);
    await page.goto("/play/library");

    await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
    const levels = page.locator("main ol > li");
    await expect(levels).toHaveCount(3);
    await expect(levels.getByRole("heading", { level: 2 })).toHaveText([
      "Thôi bịa điều luật",
      "Lược dao chunk",
      "Hỏi bằng số điều",
    ]);
    await expect(levels.nth(2).getByText("Sự cố", { exact: true })).toBeVisible();
    await expect(levels.nth(0).getByText("Sự cố", { exact: true })).toHaveCount(0);
    const enter = levels.getByRole("link", { name: /^Vào màn / });
    await expect(enter).toHaveCount(3);
    await expect(enter.nth(0)).toHaveAttribute("href", "/play/library/grounded-citation");
    await expect(enter.nth(2)).toHaveAccessibleName("Vào màn Hỏi bằng số điều");

    await page.getByRole("main").getByRole("link", { name: "Về khuôn viên" }).click();
    await expect(page).toHaveURL(/\/play\?at=library$/);
    await expect(page.locator("canvas")).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("shows a coming-soon zone as locked", async ({ page }) => {
    await mockApi(page);
    await page.goto("/play/watchtower");
    await expect(page.getByRole("heading", { level: 1, name: "Tháp canh" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Khu này sắp mở" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Đang xây" })).toHaveCount(0);
  });

  test("explains an unknown zone", async ({ page }) => {
    await mockApi(page);
    await page.goto("/play/abc");
    await expect(
      page.getByRole("heading", { level: 1, name: "Không tìm thấy khu này" }),
    ).toBeVisible();
    await expect(page.getByText("Đường dẫn không khớp khu nào trong khuôn viên.")).toBeVisible();
  });

  test("shows an API error with a retry that recovers", async ({ page }) => {
    let fail = true;
    await mockApi(page, { detail: (id) => (fail ? { status: 500 } : seedDetail(id)) });
    await page.goto("/play/library");
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("button", { name: "Thử lại" })).toBeVisible();

    fail = false;
    await alert.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
  });
});
