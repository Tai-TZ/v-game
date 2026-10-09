import {
  cameraCentre,
  desiredCentre,
  HUD_CORNER,
  toScreen,
  viewFor,
} from "../app/features/campus/camera";
import { STARS_SAVED } from "../app/features/progress/progress";
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
    await expect(page.locator("[data-scene-loader]")).toHaveCount(0);
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

  test("walks to the back of campus and back again from the zone list", async ({
    page,
    consoleErrors,
  }) => {
    // Two walks of about 26 units each; software WebGL can drop to a few frames per second.
    test.slow();
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    const zonesButton = page.getByRole("button", { name: "Các khu" });
    const list = page.locator("#hub-zone-list");

    await zonesButton.click();
    await list.getByRole("button", { name: "Đi tới khuôn viên phía sau", exact: true }).click();
    await expect(list).toBeHidden();
    await expect(zonesButton).toBeFocused();
    await waitForIdleScene(page, 45_000);

    await zonesButton.click();
    await list.getByRole("button", { name: "Về mặt trước", exact: true }).click();
    await expect(list).toBeHidden();
    await waitForIdleScene(page, 45_000);

    await zonesButton.click();
    await expect(
      list.getByRole("button", { name: "Đi tới khuôn viên phía sau", exact: true }),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("counts a walk as busy through a stalled frame", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Checks the e2e idle signal; one project is enough.",
    );
    test.slow();
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    // Every 8th animation frame comes 700 ms late, as on a starved CI runner (software WebGL):
    // a walk then has gaps between frames longer than any quiet spell an idle check could use.
    await page.evaluate(() => {
      const raf = window.requestAnimationFrame.bind(window);
      let n = 0;
      window.requestAnimationFrame = (callback) =>
        (n += 1) % 8 ? raf(callback) : window.setTimeout(() => raf(callback), 700);
    });
    const zonesButton = page.getByRole("button", { name: "Các khu" });
    const list = page.locator("#hub-zone-list");
    await zonesButton.click();
    await list.getByRole("button", { name: "Đi tới khuôn viên phía sau", exact: true }).click();
    await waitForIdleScene(page, 45_000);
    // The list names the way back only once the player stands behind the main building.
    await zonesButton.click();
    await expect(list.getByRole("button", { name: "Về mặt trước", exact: true })).toBeVisible({
      timeout: 1000,
    });
  });

  test("walks to what the market's awning, a zone label and the librarian's badge name", async ({
    page,
    consoleErrors,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "The awning's pixel is for the 1280×800 overview.",
    );
    // Three walks; software WebGL can drop to a few frames per second.
    test.slow();
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    const hint = (text: string) =>
      page.locator('[aria-live="polite"]').getByText(text, { exact: true });

    // The south awning hangs outside the market's footprint (QA r4).
    const view = viewFor(1280, 800);
    const centre = cameraCentre(desiredCentre({ sx: 0, sy: 0 }, { sx: 0, sy: 0 }, view), view);
    const awning = toScreen(9.0, 1.5, 5.55);
    await page.mouse.click(
      view.width / 2 + (awning.sx - centre.sx) * view.zoom,
      view.height / 2 - (awning.sy - centre.sy) * view.zoom,
    );
    await expect(hint("Chợ model · Sắp mở")).toBeVisible();

    // World labels are decoration for assistive tech, but a click on one walks to its door.
    await page.locator("button", { hasText: "Tháp canh" }).click();
    await expect(hint("Tháp canh · Sắp mở")).toBeVisible();

    await page.getByText("!", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Cô Lan" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("re-bakes the campus at dusk and back, with a starred library, then rests", async ({
    page,
    consoleErrors,
  }) => {
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    const looks = (library: string) =>
      expect(page.locator("html")).toHaveAttribute(
        "data-looks",
        `library:${library} watchtower:coming_soon market:coming_soon`,
      );
    // No star yet: open, or lit while nothing saves stars (STARS_SAVED, QA r3). With the flag
    // off this pair cannot tell a broken storage → siteLooks path; flipping it checks both.
    await looks(STARS_SAVED ? "open" : "lit");
    // A library star (N9) under the progress module's storage key, read when the scene mounts.
    await page.evaluate(() =>
      localStorage.setItem(
        "vg-progress-v1",
        JSON.stringify({ library: { "grounded-citation": 1 } }),
      ),
    );
    await page.reload();
    const frames = await waitForIdleScene(page);
    await looks("lit");
    // Overlapping sun shadows darken once only through the stencil test, which needs a stencil
    // buffer; without one the test is off and fails silently (QA r2).
    const stencil = await page.evaluate(
      () => document.querySelector("canvas")?.getContext("webgl2")?.getContextAttributes()?.stencil,
    );
    expect(stencil).toBe(true);
    const light = page.getByRole("button", { name: "Hoàng hôn" });
    const duskSky = page.locator(".bg-scene-dusk");
    await expect(light).toHaveAttribute("aria-pressed", "false");
    await expect(duskSky).toHaveCount(0);

    const day = await frames();
    await light.click();
    await expect(light).toHaveAttribute("aria-pressed", "true");
    await expect(duskSky).toHaveCount(1);
    await waitForIdleScene(page);
    expect(await frames()).toBeGreaterThan(day);

    await light.click();
    await expect(light).toHaveAttribute("aria-pressed", "false");
    await expect(duskSky).toHaveCount(0);
    await waitForIdleScene(page);
    expect(consoleErrors).toEqual([]);
  });

  test("survives stored progress keyed by an inherited name", async ({ page, consoleErrors }) => {
    await page.addInitScript(() =>
      localStorage.setItem("vg-progress-v1", JSON.stringify({ constructor: { keys: 1 } })),
    );
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    // The inherited name is no library star; every open zone is lit while no star is saved.
    await expect(page.locator("html")).toHaveAttribute(
      "data-looks",
      `library:${STARS_SAVED ? "open" : "lit"} watchtower:coming_soon market:coming_soon`,
    );
    expect(consoleErrors).toEqual([]);
  });

  test("hides the dusk toggle when the scene cannot start", async ({ page }) => {
    await page.addInitScript(() => {
      // Test double: a device without WebGL.
      // eslint-disable-next-line @typescript-eslint/unbound-method -- re-bound with apply below
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof getContext>
      ) {
        return args[0].startsWith("webgl") ? null : getContext.apply(this, args);
      } as typeof getContext;
    });
    await mockApi(page);
    await page.goto("/play");
    await expect(page.getByText("Trình duyệt chưa hiển thị được cảnh 3D.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Các khu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hoàng hôn" })).toHaveCount(0);
  });

  test("keeps the top HUD inside the corners the overview leaves clear", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "The corner rule is for the desktop overview.");
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    const width = page.viewportSize()?.width ?? 0;
    const controls = [
      page.getByRole("link", { name: "Về trang chủ" }),
      page.getByRole("button", { name: "Hoàng hôn" }),
      page.getByRole("button", { name: "Các khu" }),
      page.getByRole("button", { name: /Đổi giao diện/ }),
    ];
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.y + box.height).toBeLessThanOrEqual(HUD_CORNER.height);
      const left = box.x + box.width <= HUD_CORNER.width;
      const right = box.x >= width - HUD_CORNER.width;
      expect(left || right, `${JSON.stringify(box)} outside HUD_CORNER`).toBe(true);
    }
  });

  test("keeps the two top HUD groups apart at 640 px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One narrow desktop width is enough.");
    await page.setViewportSize({ width: 640, height: 800 });
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    const light = await page.getByRole("button", { name: "Hoàng hôn" }).boundingBox();
    const zones = await page.getByRole("button", { name: "Các khu" }).boundingBox();
    expect(light && zones).toBeTruthy();
    if (!light || !zones) return;
    // Icon only below md: the gap between the groups stays well over the 8 px inside a group.
    expect(light.width).toBeLessThanOrEqual(44);
    expect(zones.x - (light.x + light.width)).toBeGreaterThanOrEqual(48);
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
