import { expect, mockApi, test, themeIds, waitForIdleScene, zoneList } from "./fixtures";

const LINE_1 =
  "Chào bạn, mình là Lan, thủ thư ca tối. Trợ lý tra cứu của thư viện vừa trả lời sai quy chế cho một bạn sinh viên, còn gán cho Điều 47 một quy định không hề có.";
const LINE_2 = "Mình cần người dạy nó tra sách trước khi trả lời. Bạn vào xem giúp mình nhé?";
const LAN_HINT = "Nhấn E hoặc chạm để nói chuyện với cô Lan";

test.describe("campus hub", () => {
  test("renders the scene without errors and draws nothing while idle", async ({
    page,
    consoleErrors,
  }) => {
    await mockApi(page);
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.goto("/play?debug=frames");
    const frames = await waitForIdleScene(page);
    const before = await frames();
    // Measuring idleness needs time to pass; no state is being waited for here.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 2000)));
    expect(await frames()).toBe(before);
    expect(before).toBeGreaterThan(0);
    expect(requested.filter((url) => url.includes("latin-ext"))).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("talks to the librarian and enters the library with the keyboard only", async ({
    page,
    consoleErrors,
  }) => {
    await mockApi(page);
    await page.goto("/play");
    const zonesButton = page.getByRole("button", { name: "Các khu" });
    await zonesButton.focus();
    await page.keyboard.press("Enter");
    await expect(zonesButton).toHaveAttribute("aria-expanded", "true");

    const talk = page.getByRole("button", { name: "Nói chuyện với cô Lan", exact: true });
    await expect(talk).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Cô Lan" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(LINE_1, { exact: true })).toBeVisible();
    await expect(dialog.getByText(LINE_2, { exact: true })).toBeVisible();
    const enter = dialog.getByRole("button", { name: "Vào Thư viện" });
    await expect(enter).toBeFocused();

    // Focus stays inside the dialog.
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Để sau" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(enter).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(talk).toBeFocused();

    // Second meeting in the same session: one line.
    await page.keyboard.press("Enter");
    await expect(dialog.getByText("Trợ lý vẫn đang chờ bạn ở quầy tra cứu.")).toBeVisible();
    await expect(enter).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/play\/library$/);
    await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("walks to the librarian with the arrow keys and opens the dialog with E", async ({
    page,
  }) => {
    // Software WebGL under parallel load can drop to a few frames per second.
    test.slow();
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);

    // From the spawn the librarian is west and a little ahead: screen up + left held together
    // walks due west past her. Both key presses are dispatched in one task; two separate CDP
    // presses leave frames in between where only one key is held, and on a slow software
    // renderer that drifts the player off the line. The keys are released in the page the moment
    // her hint appears, so the player stops beside her instead of walking on to the library.
    await page.evaluate(
      ({ hintId, codes }) => {
        const send = (type: "keydown" | "keyup") => {
          for (const code of codes) {
            document.body.dispatchEvent(
              new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }),
            );
          }
        };
        const observer = new MutationObserver(() => {
          if (!document.getElementById(hintId)) return;
          observer.disconnect();
          send("keyup");
        });
        observer.observe(document.body, { childList: true, subtree: true });
        send("keydown");
      },
      { hintId: "hub-interact-hint", codes: ["ArrowLeft", "ArrowUp"] },
    );
    const hint = page.getByRole("button", { name: LAN_HINT, exact: true });
    await expect(hint).toBeVisible({ timeout: 45_000 });
    await page.keyboard.press("e");

    const dialog = page.getByRole("dialog", { name: "Cô Lan" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(LINE_1, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(hint).toBeFocused();
  });

  test("shows the watchtower and the market as coming soon, without a way in", async ({ page }) => {
    await mockApi(page);
    await page.goto("/play");
    await page.getByRole("button", { name: "Các khu" }).click();
    const list = page.locator("#hub-zone-list");
    for (const name of ["Tháp canh", "Chợ model"]) {
      const card = list.getByRole("article").filter({ has: page.getByRole("heading", { name }) });
      await expect(card.getByText("Sắp mở")).toBeVisible();
      await expect(card.getByRole("link")).toHaveCount(0);
      await expect(card.getByRole("button")).toHaveCount(0);
    }
    const library = list
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Thư viện" }) });
    await expect(library.getByText("Đang mở")).toBeVisible();
    await expect(library.getByRole("link", { name: "Vào Thư viện" })).toHaveAttribute(
      "href",
      "/play/library",
    );
  });

  test("switches theme without reloading the page", async ({ page, consoleErrors }) => {
    expect(themeIds.length).toBeGreaterThanOrEqual(2);
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    await page.evaluate(() => {
      (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
    });
    const before = await page.locator("html").getAttribute("data-theme");

    await page.getByRole("button", { name: /Đổi giao diện/ }).click();

    await expect(page.locator("html")).not.toHaveAttribute("data-theme", before ?? "");
    expect(
      await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument),
    ).toBe(true);
    await expect(page.locator("canvas")).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("keeps the scene running when the zones API fails, and retries", async ({ page }) => {
    let fail = true;
    await mockApi(page, {
      list: () => (fail ? { status: 500 } : { status: 200, body: zoneList() }),
    });
    await page.goto("/play");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "Các khu" }).click();

    const alert = page.getByRole("alert");
    await expect(
      alert.getByText("Chưa tải được thông tin các khu.", { exact: true }),
    ).toBeVisible();
    await expect(
      alert.getByText("Cảnh vẫn dùng được. Kiểm tra kết nối rồi thử lại.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nói chuyện với cô Lan", exact: true }),
    ).toBeVisible();

    fail = false;
    await alert.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("link", { name: "Vào Thư viện" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("has no horizontal overflow at 375×812", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockApi(page);
    await page.goto("/play");
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "Các khu" }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
