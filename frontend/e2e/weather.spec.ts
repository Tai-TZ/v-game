import type { Page } from "@playwright/test";

import { HUD_CORNER } from "../app/features/campus/camera";
import {
  expect,
  fulfillWeather,
  mockApi,
  OPEN_METEO,
  OPEN_METEO_CORS,
  test,
  waitForIdleScene,
  type WMO,
} from "./fixtures";

/*
 * Live sky and weather on /play (campus v0.4 W7). The fixture's "Cố định ban ngày" is off here:
 * the clock is pinned (Date only; timers run) and each test answers Open-Meteo itself.
 */
test.use({ hubDisplay: "live" });

/** A moment in Hanoi (+07:00 all year). */
const hanoi = (hm: string) => new Date(`2026-10-08T${hm}:00+07:00`);

async function weather(page: Page, condition: keyof typeof WMO, status = 200) {
  await page.route(OPEN_METEO, (route) =>
    status === 200
      ? fulfillWeather(route, condition, 24.6)
      : // Open-Meteo's per-IP limit (what Render's shared IP hit every time).
        route.fulfill({
          status,
          headers: OPEN_METEO_CORS,
          json: { error: true, reason: "Minutely API request limit exceeded." },
        }),
  );
}

const chip = (page: Page) => page.getByRole("button", { name: /°C|Thời tiết/ });

test.describe("live sky", () => {
  const CASES = [
    // [time, condition, data-sky, data-clouds, chip text, overlay parts]
    ["10:00", "clear", "day", "none", "Trời quang", []],
    ["10:00", "partly_cloudy", "day", "some", "Ít mây", []],
    ["10:00", "cloudy", "day", "full", "Nhiều mây", []],
    ["10:00", "fog", "day", "full", "Sương mù", [".weather-fog"]],
    ["10:00", "drizzle", "day", "full", "Mưa phùn", [".weather-rain"]],
    ["10:00", "rain", "day", "full", "Mưa", [".weather-rain"]],
    [
      "10:00",
      "thunderstorm",
      "day",
      "full",
      "Mưa dông",
      [".weather-rain[data-dense]", ".weather-storm", ".weather-flash"],
    ],
    ["05:40", "clear", "dawn", "none", "Trời quang", []],
    ["17:30", "clear", "dusk", "none", "Trời quang", []],
    ["21:00", "clear", "night", "none", "Trời quang", []],
  ] as const;

  for (const [time, condition, sky, clouds, text, parts] of CASES) {
    test(`${condition} at ${time}`, async ({ page, consoleErrors }) => {
      await page.clock.setFixedTime(hanoi(time));
      await mockApi(page);
      await weather(page, condition);
      await page.goto("/play");
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-sky", sky);
      await expect(main).toHaveAttribute("data-clouds", clouds);
      await expect(page.getByRole("button", { name: `25°C, ${text}, Hà Nội` })).toBeVisible();
      await expect(page.locator(".weather-layer > *")).toHaveCount(parts.length);
      for (const part of parts) await expect(page.locator(part)).toHaveCount(1);
      expect(consoleErrors).toEqual([]);
    });
  }

  test("tints the night fog with the night cloud, not the day sky", async ({ page }) => {
    await page.clock.setFixedTime(hanoi("21:00"));
    await mockApi(page);
    await weather(page, "fog");
    await page.goto("/play");
    await expect(page.locator("main")).toHaveAttribute("data-sky", "night");
    // --color-scene declared on :root resolved there, so the fog always mixed the day sky.
    const { fog, cloud } = await page.locator(".weather-fog").evaluate((el) => {
      const paint = (parent: Element, colour: string) => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = colour;
        parent.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      };
      return {
        fog: paint(el, "var(--color-scene)"),
        cloud: paint(document.body, "var(--vg-scene-cloud-night)"),
      };
    });
    expect(fog).toBe(cloud);
  });

  test("draws no WebGL frame while a night storm rains", async ({ page, consoleErrors }) => {
    await page.clock.setFixedTime(hanoi("21:00"));
    await mockApi(page);
    await weather(page, "thunderstorm");
    await page.goto("/play?debug=frames");
    await expect(page.locator("main")).toHaveAttribute("data-sky", "night");
    const frames = await waitForIdleScene(page);
    const before = await frames();
    const running = () =>
      page
        .locator(".weather-rain")
        .evaluate(
          (el) =>
            el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
        );
    expect(await running()).toBeGreaterThan(0);
    // Measuring idleness needs time to pass; no state is being waited for here.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 3000)));
    expect(await frames()).toBe(before);
    expect(await running()).toBeGreaterThan(0);
    expect(consoleErrors).toEqual([]);
  });

  test("keeps the lightning under the WCAG 2.3.1 flash threshold", async ({ page }) => {
    await page.clock.setFixedTime(hanoi("21:00"));
    await mockApi(page);
    await weather(page, "thunderstorm");
    await page.goto("/play");
    await expect(page.locator(".weather-flash")).toHaveCount(1);
    const { keyframes, duration } = await page.locator(".weather-flash").evaluate((el) => {
      const [animation] = el.getAnimations();
      const effect = animation?.effect as KeyframeEffect | null | undefined;
      return {
        keyframes: (effect?.getKeyframes() ?? []).map((k) => ({
          offset: k.computedOffset,
          opacity: Number(k.opacity),
        })),
        duration: Number(effect?.getTiming().duration ?? 0),
      };
    });
    expect(keyframes.length).toBeGreaterThan(2);
    expect(Math.max(...keyframes.map((k) => k.opacity))).toBeLessThanOrEqual(0.08);
    // Rises (an opacity going up) per second, over any 1 s window of the cycle.
    const rises = keyframes
      .slice(1)
      .filter((k, i) => k.opacity > (keyframes[i]?.opacity ?? 0))
      .map((k) => k.offset * duration);
    for (const start of rises) {
      expect(rises.filter((t) => t >= start && t < start + 1000).length).toBeLessThanOrEqual(2);
    }
  });

  test("stills the rain and drops the lightning with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.setFixedTime(hanoi("21:00"));
    await mockApi(page);
    await weather(page, "thunderstorm");
    await page.goto("/play");
    const rain = page.locator(".weather-rain");
    await expect(rain).toHaveCount(1);
    await expect
      .poll(() =>
        rain.evaluate(
          (el) =>
            el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
        ),
      )
      .toBe(0);
    await expect(page.locator(".weather-flash")).toBeHidden();
  });

  test("fixes the daytime look from the keyboard, and keeps it", async ({
    page,
    consoleErrors,
  }) => {
    test.slow(); // a re-bake, a reload and a walk to Lan on software WebGL
    await page.clock.setFixedTime(hanoi("21:00"));
    await mockApi(page);
    await weather(page, "rain");
    await page.goto("/play");
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-sky", "night");
    const button = page.getByRole("button", { name: "25°C, Mưa, Hà Nội" });
    await button.focus();
    await page.keyboard.press("Enter");
    const popover = page.locator("#hub-weather");
    await expect(popover.getByRole("heading", { name: "Thời tiết ở Hà Nội" })).toBeVisible();
    await expect(popover.getByText("21:00 · Tối")).toBeVisible();
    await expect(popover.getByText("25°C · Mưa · Cập nhật 21:00")).toBeVisible();
    await expect(popover.getByText(/tải thẳng từ Open-Meteo/)).toBeVisible();
    await expect(popover.getByRole("link", { name: /Open-Meteo\.com/ })).toBeVisible();

    await popover.getByRole("radio", { name: "Cố định ban ngày" }).focus();
    await page.keyboard.press("Space");
    await expect(main).toHaveAttribute("data-sky", "day");
    await expect(main).toHaveAttribute("data-clouds", "none");
    await expect(page.locator(".weather-layer")).toHaveCount(0);
    await expect(button).toBeVisible(); // still the real weather

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(button).toBeFocused();

    await page.reload();
    await expect(main).toHaveAttribute("data-sky", "day");
    await expect(page.locator(".weather-layer")).toHaveCount(0);

    // A conversation closes the popover (it would sit over the dialog in the top layer).
    await chip(page).click();
    await expect(popover).toBeVisible();
    // No pointerdown: a real click outside light-dismisses the popover, and below sm the open
    // popover covers the badge. This proves the store's dialog closes it, on both projects.
    await page.locator('[data-badge="lan"]').dispatchEvent("click");
    await expect(page.getByRole("dialog", { name: "Cô Lan" })).toBeVisible();
    await expect(popover).toBeHidden();
    expect(consoleErrors).toEqual([]);
  });

  test("shows the hour's sky when Open-Meteo refuses (429)", async ({ page, consoleErrors }) => {
    await page.clock.setFixedTime(hanoi("21:00"));
    await mockApi(page);
    await weather(page, "rain", 429);
    await page.goto("/play?debug=frames");
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-sky", "night");
    await expect(main).toHaveAttribute("data-clouds", "none");
    await expect(page.getByRole("button", { name: "Thời tiết Hà Nội" })).toBeVisible();
    await chip(page).click();
    await expect(page.getByText("Chưa có thời tiết")).toBeVisible();
    await page.keyboard.press("Escape");
    await waitForIdleScene(page);
    expect(consoleErrors).toEqual([]);
  });

  test("changes the scene once when slow weather arrives, then rests", async ({
    page,
    consoleErrors,
  }) => {
    test.slow();
    await page.clock.setFixedTime(hanoi("21:00"));
    await mockApi(page);
    // Held until the scene is idle: a slow network answers late (within FETCH_TIMEOUT_MS, 60 s).
    let answer: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (answer = resolve));
    await page.route(OPEN_METEO, async (route) => {
      await held;
      await fulfillWeather(route, "rain");
    });
    await page.goto("/play?debug=frames");
    const frames = await waitForIdleScene(page);
    await expect(page.locator("main")).toHaveAttribute("data-clouds", "none");
    await chip(page).click();
    await expect(page.getByText("Đang tải thời tiết")).toBeVisible();
    await page.keyboard.press("Escape");
    await waitForIdleScene(page);
    const before = await frames();
    answer();
    await expect(page.locator("main")).toHaveAttribute("data-clouds", "full");
    await waitForIdleScene(page);
    const after = await frames();
    expect(after).toBeGreaterThan(before);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1500)));
    expect(await frames()).toBe(after);
    expect(consoleErrors).toEqual([]);
  });
});

test("lets the page fetch Open-Meteo and nothing else outside the site (CSP)", async ({ page }) => {
  const response = await page.goto("/");
  const csp = (await response?.headerValue("content-security-policy")) ?? "";
  const connect = csp
    .split(";")
    .map((directive) => directive.trim().split(/\s+/))
    .find(([name]) => name === "connect-src");
  // An API on another origin (VITE_API_BASE_URL) may be listed too; e2e builds without one.
  expect(connect?.slice(1)).toEqual(["'self'", "https://api.open-meteo.com"]);
});

test.describe("weather chip in the HUD", () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1280, height: 720 },
  ]) {
    test(`stays inside the top-left corner at ${viewport.width}×${viewport.height}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop",
        "The corner rule is for the desktop overview.",
      );
      await page.setViewportSize(viewport);
      await mockApi(page);
      await page.goto("/play");
      const box = await chip(page).boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      expect(box.x + box.width).toBeLessThanOrEqual(HUD_CORNER.width);
      expect(box.y + box.height).toBeLessThanOrEqual(HUD_CORNER.height);
    });
  }

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 360, height: 740 },
  ]) {
    test(`is icon-only with no overlap or page scroll at ${viewport.width} px`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "One browser is enough for the layout.");
      await page.setViewportSize(viewport);
      await mockApi(page);
      await page.goto("/play");
      const box = await chip(page).boundingBox();
      const zones = await page.getByRole("button", { name: "Các khu" }).boundingBox();
      expect(box && zones).toBeTruthy();
      if (!box || !zones) return;
      expect(box.width).toBeLessThanOrEqual(44);
      expect(box.x + box.width).toBeLessThan(zones.x);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
      // The popover fits the narrow screen too.
      await chip(page).click();
      const popover = await page.locator("#hub-weather").boundingBox();
      expect(popover).not.toBeNull();
      if (popover) expect(popover.x + popover.width).toBeLessThanOrEqual(viewport.width);
    });
  }
});
