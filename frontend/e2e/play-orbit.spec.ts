import type { Page } from "@playwright/test";

import {
  cameraCentre,
  desiredCentre,
  toScreen,
  VIEW_CONTROLS,
  viewFor,
  type View,
} from "../app/features/campus/camera";
import { SPAWN, type Vec2 } from "../app/features/campus/layout";
import { expect, mockApi, test, waitForIdleScene } from "./fixtures";

/*
 * Turning the campus view (orbit-camera §2, §9). `?debug=frames` writes the view's yaw in
 * degrees ([0, 360)) to <html data-yaw> and the player's ground position to data-player.
 */

const deg = (d: number) => (d * Math.PI) / 180;

const yawOf = async (page: Page) => Number(await page.locator("html").getAttribute("data-yaw"));

async function playerOf(page: Page): Promise<Vec2> {
  const [x = 0, z = 0] = ((await page.locator("html").getAttribute("data-player")) ?? "")
    .split(",")
    .map(Number);
  return { x, z };
}

/** Waits for the view to rest at `degrees` (±1). */
async function expectYaw(page: Page, degrees: number) {
  await waitForIdleScene(page);
  const off = (await yawOf(page)) - degrees;
  expect(Math.abs((((off % 360) + 540) % 360) - 180)).toBeLessThanOrEqual(1);
}

/** Pixel of a world point in the overview at `yaw` (camera.ts; follow would need its history). */
function overviewPixel(view: View, yaw: number, x: number, y: number, z: number) {
  const centre = cameraCentre(desiredCentre(SPAWN_SCREEN, SPAWN_SCREEN, view, false, yaw), view);
  const p = toScreen(x, y, z, yaw);
  return {
    x: view.width / 2 + (p.sx - centre.sx) * view.zoom,
    y: view.height / 2 - (p.sy - centre.sy) * view.zoom,
  };
}
const SPAWN_SCREEN = toScreen(SPAWN.x, 0, SPAWN.z);
/** Open lawn east of the spawn: a press there that does not drag walks the player. */
const LAWN = { x: 1.2, z: 0.6 };

const viewButton = (page: Page, name: string) =>
  page.getByRole("group", { name: "Góc nhìn" }).getByRole("button", { name, exact: true });
const COMPASS = "Về góc nhìn mặc định";

test.describe("campus view, desktop", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Pixels are for the 1280×800 overview.");
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
  });

  test("turns with a drag, settles and rests, without walking", async ({ page, consoleErrors }) => {
    test.slow();
    const view = viewFor(1280, 800);
    const start = overviewPixel(view, deg(45), LAWN.x, 0, LAWN.z);
    const before = await playerOf(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 150, start.y, { steps: 10 });
    await page.mouse.move(start.x - 300, start.y, { steps: 10 });
    await page.mouse.up();
    // 300 px at 0.3°/px, then the release settles on the 135° diagonal.
    await expectYaw(page, 135);
    expect(await playerOf(page)).toEqual(before);
    const frames = await page.evaluate(() => Number(document.documentElement.dataset.frames));
    // Measuring idleness needs time to pass; no state is being waited for here.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    expect(await page.evaluate(() => Number(document.documentElement.dataset.frames))).toBe(frames);
    await expect(viewButton(page, COMPASS)).toHaveAttribute("aria-disabled", "false");
    expect(consoleErrors).toEqual([]);
  });

  test("walks on a press that moves less than the slop, not after a drag", async ({ page }) => {
    const view = viewFor(1280, 800);
    const lawn = overviewPixel(view, deg(45), LAWN.x, 0, LAWN.z);
    const before = await playerOf(page);

    // A 200 px drag released over the ground: the click after it does nothing.
    await page.mouse.move(lawn.x + 100, lawn.y);
    await page.mouse.down();
    await page.mouse.move(lawn.x - 100, lawn.y, { steps: 8 });
    await page.mouse.up();
    await waitForIdleScene(page);
    expect(await playerOf(page)).toEqual(before);

    await viewButton(page, COMPASS).click();
    await expectYaw(page, 45);
    // A 3 px nudge is still a click.
    await page.mouse.move(lawn.x, lawn.y);
    await page.mouse.down();
    await page.mouse.move(lawn.x + 3, lawn.y, { steps: 2 });
    await page.mouse.up();
    await waitForIdleScene(page);
    expect(await playerOf(page)).not.toEqual(before);
  });

  test("turns 90° with , and . and the buttons; the compass brings it home", async ({ page }) => {
    const compass = viewButton(page, COMPASS);
    await expect(compass).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press(".");
    await expectYaw(page, 135);
    await page.keyboard.press(",");
    await expectYaw(page, 45);
    await viewButton(page, "Xoay theo chiều kim đồng hồ").click();
    await expectYaw(page, 135);
    await page.keyboard.press(".");
    await expectYaw(page, 225);
    await viewButton(page, "Xoay ngược chiều kim đồng hồ").click();
    await viewButton(page, "Xoay theo chiều kim đồng hồ").click();
    await expectYaw(page, 225);

    await compass.focus();
    await page.keyboard.press("Enter");
    await expectYaw(page, 45);
    await expect(compass).toHaveAttribute("aria-disabled", "true");
    await expect(compass).toBeFocused();
  });

  test("walks up the screen with ArrowUp in a turned view", async ({ page }) => {
    test.slow();
    await page.keyboard.press(".");
    await expectYaw(page, 135);
    const yaw = deg(135);
    const before = await playerOf(page);
    await page.keyboard.down("ArrowUp");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    await page.keyboard.up("ArrowUp");
    await waitForIdleScene(page);
    const after = await playerOf(page);
    const a = toScreen(before.x, 0, before.z, yaw);
    const b = toScreen(after.x, 0, after.z, yaw);
    expect(b.sy - a.sy).toBeGreaterThan(0.5);
    expect(Math.abs(b.sx - a.sx)).toBeLessThan(0.1);
  });

  test("still walks to a building from its label in a turned view", async ({ page }) => {
    test.slow();
    await page.keyboard.press(".");
    await page.keyboard.press(".");
    await expectYaw(page, 225);
    await page.locator("button", { hasText: "Chợ model" }).click();
    await expect(
      page.locator('[aria-live="polite"]').getByText("Chợ model · Sắp mở", { exact: true }),
    ).toBeVisible();
  });

  test("keeps the view buttons inside their corner", async ({ page }) => {
    const box = await page.getByRole("group", { name: "Góc nhìn" }).boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(1280 - VIEW_CONTROLS.width);
      expect(box.y).toBeGreaterThanOrEqual(800 - VIEW_CONTROLS.height);
      expect(box.x + box.width).toBeLessThanOrEqual(1280);
      expect(box.y + box.height).toBeLessThanOrEqual(800);
    }
  });
});

test.describe("campus view, phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("names the buttons, keeps them above the hint, turns with a finger, walks on a tap", async ({
    page,
    consoleErrors,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Touch needs the mobile project.");
    test.slow();
    await mockApi(page);
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    for (const name of ["Xoay ngược chiều kim đồng hồ", COMPASS, "Xoay theo chiều kim đồng hồ"]) {
      await expect(viewButton(page, name)).toBeVisible();
    }

    // A tap beside the player (follow keeps it near the middle) still walks.
    const before = await playerOf(page);
    const view = viewFor(375, 812);
    const focus = toScreen(before.x, 0, before.z);
    const centre = cameraCentre(desiredCentre(focus, focus, view), view);
    const lawn = toScreen(LAWN.x, 0, LAWN.z);
    await page.touchscreen.tap(
      view.width / 2 + (lawn.sx - centre.sx) * view.zoom,
      view.height / 2 - (lawn.sy - centre.sy) * view.zoom,
    );
    await waitForIdleScene(page);
    expect(await playerOf(page)).not.toEqual(before);

    // One finger turns the view: pointer events as a touch screen sends them. The synthetic
    // pointer cannot be captured (useHubFrame catches that).
    const canvas = page.locator("canvas");
    const touch = { pointerType: "touch", isPrimary: true, pointerId: 7, button: 0, clientY: 500 };
    await canvas.dispatchEvent("pointerdown", { ...touch, clientX: 300 });
    for (const clientX of [280, 230, 180, 130]) {
      await canvas.dispatchEvent("pointermove", { ...touch, clientX });
    }
    await canvas.dispatchEvent("pointerup", { ...touch, clientX: 130 });
    // 150 px at 0.6°/px from the slop on: 45° + 90°.
    await expectYaw(page, 135);

    // Next to the librarian the hint shows; the buttons stay clear above it.
    await page.getByRole("button", { name: "Các khu" }).click();
    await page.getByRole("button", { name: "Nói chuyện với cô Lan", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Cô Lan" })
      .getByRole("button", { name: "Để sau" })
      .click();
    const hint = page.locator('[aria-live="polite"] button');
    await expect(hint).toBeVisible();
    const [group, hintBox] = await Promise.all([
      page.getByRole("group", { name: "Góc nhìn" }).boundingBox(),
      hint.boundingBox(),
    ]);
    expect(group && hintBox && group.y + group.height <= hintBox.y).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
