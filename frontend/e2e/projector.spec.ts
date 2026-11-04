import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { parseSse, readText, sseText } from "../app/features/workbench/test-fixtures";
import { expect, mockWorkbenchApi, test } from "./fixtures";

// Projector mode, lesson-plan appendix R1-R10 (roadmap-v0.4 B7).

const L1 = "/play/library/grounded-citation";
const L3 = "/play/library/article-number-lookup";
const W1 = "/play/watchtower/direct-injection";
const w1Stream = (name: "starter" | "reference") => readText("e2e", "data", `run-w1-${name}.sse`);

// R9 "cả hai theme": the theme packs, read from the repo rather than named here (ADR 0002).
const THEMES = (
  JSON.parse(readFileSync("public/themes/index.json", "utf8")) as { themes: { id: string }[] }
).themes.map((theme) => theme.id);

async function seriousViolations(page: Page) {
  // At rest only: see the same wait in a11y.spec.ts.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const px = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

/** How far the page scrolls sideways; 0 or less is none (R10). */
const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/**
 * R10, "every control by keyboard": the shown controls Tab never lands on, by name. A control by
 * role counts too (the machine's toys are SVG buttons), so one dropped from the tab order shows.
 * An unchecked radio is left out -- its group is one stop, and the arrow keys walk it -- as is
 * anything inside a closed disclosure, whose summary is the stop.
 */
async function missedByTab(page: Page) {
  const stops = await page.evaluate(() => {
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, summary, [role="button"], [role="switch"], [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (el) =>
        el.checkVisibility() &&
        !el.matches(":disabled") &&
        el.getAttribute("aria-disabled") !== "true" &&
        !(el instanceof HTMLInputElement && el.type === "radio" && !el.checked),
    );
    controls.forEach((el, at) => (el.dataset.tabStop = String(at)));
    (document.activeElement as HTMLElement | null)?.blur();
    return controls.length;
  });
  const reached = new Set<string>();
  for (let press = 0; press < stops + 5; press += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.tabStop,
    );
    if (stop !== undefined) reached.add(stop);
  }
  return page.evaluate(
    (got) =>
      [...document.querySelectorAll<HTMLElement>("[data-tab-stop]")]
        .filter((el) => !got.includes(el.dataset.tabStop ?? ""))
        .map((el) => el.getAttribute("aria-label") ?? el.textContent.trim()),
    [...reached],
  );
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  for (const theme of THEMES) {
    test(`reads from the back row at ${viewport.width}×${viewport.height}, theme ${theme}`, async ({
      page,
      consoleErrors,
    }, testInfo) => {
      // A projector is a laptop's second screen: the phone project has nothing to add here, and
      // its emulated device cannot take a 1920 px full-page capture.
      test.skip(testInfo.project.name !== "desktop", "A projector hangs off a desktop.");
      await page.setViewportSize(viewport);
      await page.addInitScript((id) => window.localStorage.setItem("vg-theme", id), theme);
      await mockWorkbenchApi(page);
      await page.goto(`${L1}?chieu=1`);
      await expect(page.locator("html")).toHaveClass(/\bchieu\b/);

      // R4: the room's guess, with big letters and nothing to type.
      const hands = page.getByRole("region", { name: "Cả lớp đoán" });
      await expect(hands).toBeVisible();
      for (const letter of ["A", "B", "C"])
        await expect(hands.getByText(letter, { exact: true })).toBeVisible();

      // R2: body text at least 24 px, headings at least 40 px.
      expect(await px(page, "#wb-quota p")).toBeGreaterThanOrEqual(24);
      expect(await px(page, "main h1")).toBeGreaterThanOrEqual(40);
      expect(await px(page, "#wb-open-title")).toBeGreaterThanOrEqual(40);

      // R3: one column, nothing of a pair's own (the JSON log, the guess slip).
      await expect(page.getByText("Xem cấu hình JSON")).toBeHidden();
      await expect(page.getByText("Đoán trước khi mở ca")).toBeHidden();
      await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();

      // R9, R10: contrast and the rest of axe, no sideways scroll.
      expect(await seriousViolations(page)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await testInfo.attach(`chieu-${viewport.width}-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      expect(consoleErrors).toEqual([]);
    });
  }
}

test("covers the recorded run until the teacher opens it from the keyboard (R4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockWorkbenchApi(page);
  await page.goto(`${L1}?chieu=1`);
  await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();

  const table = page.getByRole("region", { name: "Bảng câu" });
  await expect(table.getByText("Đã chấm").first()).toBeVisible();
  await expect(table.getByText(/Đạt|Trượt/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeHidden();

  // The way in takes focus, so Enter (or Space) is all the teacher needs.
  const reveal = page.getByRole("button", { name: "Mở kết quả" });
  await expect(reveal).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
  await expect(table.getByText("Đã chấm")).toHaveCount(0);
  // R3: the score stays; a pair's history and cô Lan's hints do not.
  await expect(page.getByText("Xem vết chạy").first()).toBeHidden();
});

test("leaves the mode and does not remember it (R1)", async ({ page }) => {
  await mockWorkbenchApi(page);
  await page.goto(`${L1}?chieu=1`);
  await page.getByRole("button", { name: "Thoát chế độ chiếu" }).click();
  await expect(page).toHaveURL(new RegExp(`${L1}$`));
  await expect(page.locator("html")).not.toHaveClass(/\bchieu\b/);
  await expect(page.getByRole("region", { name: "Cả lớp đoán" })).toHaveCount(0);

  await page.goto(L1);
  await expect(page.locator("html")).not.toHaveClass(/\bchieu\b/);
});

test("works on the zone page too (R1)", async ({ page }) => {
  await mockWorkbenchApi(page);
  await page.goto("/play/library?chieu=1");
  await expect(page.locator("html")).toHaveClass(/\bchieu\b/);
  await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();
});

test("says the server is waking and still offers the recorded run (R6)", async ({ page }) => {
  await mockWorkbenchApi(page);
  // Registered last, so it wins over the fixture's quota route.
  await page.route(
    (url) => url.pathname === "/api/quota",
    (route) => route.fulfill({ status: 503, json: {} }),
  );
  await page.goto(`${L1}?chieu=1`);
  await expect(page.getByText("Đang đánh thức máy chủ")).toBeVisible();
  await expect(page.getByText("Máy chiếu còn 40 lời gọi hôm nay (ước tính)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lượt đã ghi" })).toBeVisible();
});

// Watchtower W1 (plan v0.7 1.5): the desk and its tool branch, the receipt, the ledger, W1's
// recorded run, and every part added to the bench since the L1 check above.
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const) {
  for (const theme of THEMES) {
    test(`reads W1 from the back row at ${viewport.width}×${viewport.height}, theme ${theme}`, async ({
      page,
      consoleErrors,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "A projector hangs off a desktop.");
      await page.setViewportSize(viewport);
      await page.addInitScript((id) => window.localStorage.setItem("vg-theme", id), theme);
      await mockWorkbenchApi(page);
      await page.goto(`${W1}?chieu=1`);
      await expect(page.locator("html")).toHaveClass(/\bchieu\b/);

      // R4: the room is asked the desk's own questions, each answer under a big letter.
      const hands = page.getByRole("region", { name: "Cả lớp đoán" });
      await expect(hands.locator('[data-hand-ask="net_catches"] [data-hand-letter]')).toHaveText([
        "A",
        "B",
        "C",
        "D",
      ]);
      await expect(hands).not.toContainText("quy chế");

      // R2: headings at least 40 px; the receipt, the pool, the room's question and the machine's
      // readout at least 24.
      for (const heading of ["main h1", "#wb-bench-title", "#wb-open-title"])
        expect(await px(page, heading)).toBeGreaterThanOrEqual(40);
      for (const body of [
        "[data-scene-receipt] li",
        "#wb-quota p",
        "[data-hand-ask] p",
        "[data-beat-readout]",
      ])
        expect(await px(page, body)).toBeGreaterThanOrEqual(24);

      // R3: nothing of a pair's own, and no pinned link to Mở ca over the room's view.
      await expect(page.getByText("Đoán trước khi mở ca")).toBeHidden();
      await expect(page.getByText("Xem cấu hình JSON")).toBeHidden();
      await expect(page.locator("[data-jump-open]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();

      // R9, R10 on the bench (the machine's toys are controls too), then on the recorded run's
      // results.
      expect(await seriousViolations(page)).toEqual([]);
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      expect(await missedByTab(page)).toEqual([]);
      await testInfo.attach(`chieu-w1-${viewport.width}-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });

      await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();
      await page.getByRole("button", { name: "Mở kết quả" }).click();
      await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
      expect(await px(page, "#wb-results")).toBeGreaterThanOrEqual(40);
      await expect(page.getByText("Xem vết chạy").first()).toBeHidden();
      expect(await seriousViolations(page)).toEqual([]);
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      expect(await missedByTab(page)).toEqual([]);

      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(consoleErrors).toEqual([]);
    });
  }
}

test("covers W1's recorded run, ledger and answer board too, while the server wakes (R4, R6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockWorkbenchApi(page);
  await page.route(
    (url) => url.pathname === "/api/quota",
    (route) => route.fulfill({ status: 503, json: {} }),
  );
  await page.goto(`${W1}?chieu=1`);
  await expect(page.getByText("Đang đánh thức máy chủ")).toBeVisible();
  await expect(page.getByText("Máy chiếu còn 40 lời gọi hôm nay (ước tính)")).toBeVisible();
  await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();

  const table = page.getByRole("region", { name: "Bảng câu" });
  await expect(table.getByText("Đã chấm")).toHaveCount(12);
  await expect(table.getByText(/Đạt|Trượt/)).toHaveCount(0);
  // The machine draws nothing of the run either: no verdict on the board, no line in the ledger.
  const machine = page.locator("[data-machine-figure]");
  await expect(machine.locator("[data-verdict]")).toHaveCount(0);
  await expect(machine.locator("[data-gauge-entry]")).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Mở kết quả" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
  await expect(page.getByText("Lượt chạy đã ghi").first()).toBeVisible();
  await expect(machine.locator("[data-verdict]")).toHaveCount(1);
  // Case #2, a refund the desk paid with no bell: its line is in the ledger, and "Sổ ghi" reads
  // it out at the projector's size. (The log keeps the steps of sample cases only.)
  await table.getByRole("button", { name: /^#2 · / }).click();
  await expect(machine.locator('[data-gauge-entry="executed"]')).toHaveCount(1);
  await machine.locator('[data-beat="tool_refund"]').click();
  await expect(machine.locator("[data-beat-readout]")).toContainText("Sổ:");
  expect(await px(page, "[data-beat-readout]")).toBeGreaterThanOrEqual(24);
});

test("keeps star 2's budget meter off a live W1 star run until the reveal (R4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  // Every case graded and its tokens in, nothing scored: the stream then holds the run open.
  const frames = parseSse(w1Stream("starter"));
  const graded = sseText(
    frames.slice(
      0,
      frames.findIndex((f) => f.event === "run.scored"),
    ),
  );
  await mockWorkbenchApi(page, {
    events: (n) => (n === 1 ? graded : new Promise<string>(() => undefined)),
  });
  await page.goto(`${W1}?chieu=1`);
  await page.getByRole("button", { name: "Mở ca" }).click();
  await expect(page.getByText("12/12 câu đã chấm")).toBeVisible();
  await expect(page.getByRole("region", { name: "Bảng câu" }).getByText("Đã chấm")).toHaveCount(12);
  await expect(page.locator("[data-budget-meter]")).toHaveCount(0);
  await expect(page.getByText(/ngân sách sao 2/)).toHaveCount(0);
});

test("raises W1's world flag only once the teacher opens the results (R4)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockWorkbenchApi(page, { events: () => w1Stream("reference") });
  await page.goto(`${W1}?chieu=1`);
  await page.getByRole("button", { name: "Mở ca" }).click();
  // Three stars, scored and finished, and the receipt is still unstamped for the room.
  await expect(page.getByRole("button", { name: "Mở kết quả" })).toBeFocused();
  await expect(page.locator("[data-scene-won]")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByText("3/3 sao", { exact: true })).toBeVisible();
  await expect(page.locator("[data-scene-won]")).toHaveText("ĐÃ CHẶN");
});

test("leaves a pair's slip and cô Lan's hints off a projector run (R3, R8)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  // A slip drafted on this machine before it went up on the projector.
  const draft = JSON.stringify({ passed: 9, failing: [9], bets: {}, asks: { net_catches: 2 } });
  await page.addInitScript((slip) => {
    window.localStorage.setItem("vg.guess.v1.direct-injection", slip);
  }, draft);
  await mockWorkbenchApi(page, { events: () => w1Stream("starter") });
  await page.goto(`${W1}?chieu=1`);
  await page.getByRole("button", { name: "Mở ca" }).click();
  await page.getByRole("button", { name: "Mở kết quả" }).click();
  await expect(page.getByText("0/3 sao", { exact: true })).toBeVisible();

  // The room guessed by hand: the draft neither rode the run nor left with it.
  await expect(page.getByRole("heading", { name: "Phiếu đoán của bạn" })).toHaveCount(0);
  expect(
    await page.evaluate(() => window.localStorage.getItem("vg.guess.v1.direct-injection")),
  ).toBe(draft);
  // A failed star run has hints, but they are the pairs' to open: no way down to a hidden ladder.
  const actions = page.locator("[data-after-run-actions]");
  await expect(actions.getByRole("button", { name: "Chỉnh rồi chạy lại" })).toBeVisible();
  await expect(actions.getByRole("link", { name: "Xem gợi ý" })).toHaveCount(0);
  await expect(page.locator("#wb-hints")).toBeHidden();
});

test("works on the watchtower zone page, and the warm-up lesson still reads (R1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockWorkbenchApi(page);
  await page.goto("/play/watchtower?chieu=1");
  await expect(page.locator("html")).toHaveClass(/\bchieu\b/);
  await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();
  expect(await px(page, "[data-warmup-row] p")).toBeGreaterThanOrEqual(24);
  expect(await seriousViolations(page)).toEqual([]);
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  // R1 names the zone page and the bench; the micro lesson takes the class all the same.
  await page.goto("/play/watchtower/vi-mo/thang-rui-ro-tool?chieu=1");
  await expect(page.getByRole("heading", { level: 1, name: "Thang rủi ro tool" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/\bchieu\b/);
  await expect(page.getByRole("button", { name: "Thoát chế độ chiếu" })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
});

// L3 adds the hybrid bench, the dossier and an info case to what L1 already covers.
for (const theme of THEMES) {
  test(`covers L3's recorded run, info case included, then reads clean, theme ${theme} (R4, R9, R10)`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "A projector hangs off a desktop.");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript((id) => window.localStorage.setItem("vg-theme", id), theme);
    await mockWorkbenchApi(page);
    await page.goto(`${L3}?chieu=1`);
    await expect(page.locator("html")).toHaveClass(/\bchieu\b/);
    expect(await seriousViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();
    const table = page.getByRole("region", { name: "Bảng câu" });
    await expect(table.getByText("Đã chấm")).toHaveCount(13);
    await expect(table.getByText(/Đạt|Trượt|Không tính/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mở kết quả" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await sideways(page)).toBeLessThanOrEqual(0);
  });
}
