import type { Page } from "@playwright/test";

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
      await card.getByRole("radio", { name: "Tự chạy", exact: true }).check({ force: true });
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

  test("keeps the picked lane at full strength once the ladder is checked", async ({ page }) => {
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto("/play/watchtower/vi-mo/thang-rui-ro-tool");
    await expect(page.getByRole("heading", { level: 1, name: "Thang rủi ro tool" })).toBeVisible();
    for (const card of await page.locator("[data-card]").all()) {
      await card.getByRole("radio", { name: "Tự chạy", exact: true }).check({ force: true });
    }
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    const picked = page.locator("[data-card]").first().locator("input:checked + span");
    await expect(picked).toHaveCSS("opacity", "1");
  });

  test("plays W1's recorded starter run with the API down, bad refunds and all", async ({
    page,
  }) => {
    await mockWorkbenchApi(page, {
      post: () => ({ status: 503, body: { detail: "Máy chủ đang ngủ." } }),
    });
    await page.goto(W1);
    await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" })).toBeVisible();
    await expect(page.locator("article[id^='cau-']")).toHaveCount(12);
    await expect(page.getByText(/khoản hoàn sai chạy thẳng/).first()).toBeVisible();
    const progress = await page.evaluate(() => window.localStorage.getItem("vg-progress-v1"));
    expect(progress).toBeNull();
  });

  test("keeps the machine's steps on one row and its view toggles in the caption, at 375 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto(W1);
    const steps = page.getByRole("list", { name: "Cho câu hỏi chạy qua máy" });
    await expect(steps).toBeVisible();
    const items = await steps
      .getByRole("button")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(items).size).toBe(1); // one row, scrolled sideways rather than wrapped
    const caption = page.locator("[data-machine-figure] figcaption");
    const toggle = page.getByRole("button", { name: "Nhìn xuyên" });
    const [cap, tog] = [await caption.boundingBox(), await toggle.boundingBox()];
    expect(Math.abs((cap?.y ?? 0) - (tog?.y ?? 999))).toBeLessThan(44);
    expect(tog?.height ?? 0).toBeGreaterThanOrEqual(44);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(scroll).toBe(0);
  });

  test("answers an unknown micro lesson as not found", async ({ page }) => {
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto("/play/watchtower/vi-mo/khong-co");
    await expect(
      page.getByRole("heading", { level: 1, name: "Không tìm thấy trang" }),
    ).toBeVisible();
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

// Plan v0.7 3.2: the cases fold into tiles that open on a press. On the starter run the twelve
// full cards spanned 1.365 px at 1280×800 and 3.101 px at 375×812 (screenshot audit); the closed
// tiles span 286 and 624 px. The bounds leave room for a font or a theme, not for a card.
test.describe("the W1 cases as tiles (plan v0.7 3.2)", () => {
  const results = async (page: Page) => {
    await mockWorkbenchApi(page, { events: () => stream("starter") });
    await page.goto(W1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" })).toBeFocused();
  };

  for (const [width, height, most] of [
    [1280, 800, 400],
    [375, 812, 850],
  ] as const) {
    test(`folds the twelve cases into closed tiles at ${width} px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Both widths are set here.");
      await page.setViewportSize({ width, height });
      await results(page);
      const tiles = page.locator("article[id^='cau-']");
      await expect(tiles).toHaveCount(12);
      await expect(page.locator("[data-case-open]")).toHaveCount(0);
      const grid = await page.locator("[data-case-grid]").boundingBox();
      expect(grid?.height ?? Infinity).toBeLessThan(most);
      const heights = await tiles.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().height),
      );
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
        .toBe(0);
    });
  }

  test("reads a tile out as its title, a pause, then its verdict", async ({ page }) => {
    await results(page);
    const title = (await page.locator("#cau-9-title").textContent()) ?? "";
    // Chromium's own name for it, not a library's: the accessibility tree over CDP.
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "#cau-9 h4 button",
    });
    const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
      nodeId,
      fetchRelatives: false,
    });
    expect(String(nodes[0]?.name?.value)).toBe(`${title}, Trượt`);
  });

  test("lets find-in-page reach a closed case, and opens its tile on the match", async ({
    page,
  }) => {
    await results(page);
    const nine = page.locator("#cau-9");
    const body = page.locator("#cau-9-body");
    await expect(body).toHaveAttribute("hidden", "until-found");
    await expect(body).toBeHidden();
    // Chromium's own until-found: a text fragment is found the way find-in-page finds it, and
    // fires beforematch on the closed body before it shows it.
    const question = (await body.locator("p").first().textContent()) ?? "";
    expect(question.length).toBeGreaterThan(8);
    const fired = body.evaluate(
      (el) =>
        new Promise<boolean>((done) => {
          el.addEventListener("beforematch", () => done(true));
          setTimeout(() => done(false), 5000);
        }),
    );
    await page.evaluate(
      (text) => {
        window.location.hash = `:~:text=${encodeURIComponent(text)}`;
      },
      question.slice(0, 40),
    );
    expect(await fired).toBe(true);
    await expect(nine).toHaveAttribute("data-case-open", "");
    await expect(nine.locator("h4 button")).toHaveAttribute("aria-expanded", "true");
    await expect(body).toBeVisible();
    await expect(body).not.toHaveAttribute("hidden");
  });

  test("opens case #9 from the trace book, and again from the diagnosis", async ({ page }) => {
    await results(page);
    const nine = page.locator("#cau-9");
    const criteria = nine.getByRole("list", { name: "Tiêu chí" });
    await expect(criteria).toBeHidden();

    const book = page.getByRole("group", { name: "Sổ truy vết" });
    await book.getByRole("link", { name: "Xem câu #9" }).click();
    await expect(page).toHaveURL(/#cau-9$/);
    await expect(nine).toHaveAttribute("data-case-open", "");
    await expect(criteria).toBeVisible();
    await expect(criteria).toBeInViewport();
    // Open, the case takes the grid's whole row.
    const width = async (selector: string) =>
      Math.round((await page.locator(selector).boundingBox())?.width ?? 0);
    expect(await width("#cau-9")).toBe(await width("[data-case-grid]"));

    // Closed by its own button, then opened by the diagnosis's link to the same address: no
    // hashchange comes, so the click alone has to open it.
    const toggle = nine.locator("h4 button");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(criteria).toBeHidden();
    await book.getByRole("button", { name: "Bỏ qua, xem chẩn đoán" }).click();
    const diagnosis = page.getByRole("list", { name: "Anh Quân chẩn đoán" });
    await diagnosis.getByRole("link", { name: "Xem câu #9" }).click();
    await expect(criteria).toBeVisible();
    await expect(criteria).toBeInViewport();
  });

  test("lands on a tile that moves to a row of its own as it opens", async ({ page }) => {
    await results(page);
    // #10 sits in the second column: open, it takes the next row, and the page scrolls there.
    await page
      .getByRole("group", { name: "Sổ truy vết" })
      .getByRole("link", { name: "Xem câu #10" })
      .click();
    const ten = page.locator("#cau-10");
    await expect(ten).toHaveAttribute("data-case-open", "");
    // Its top at the top of the screen (scroll-mt-4): opened only after the browser scrolled,
    // it would sit a whole row of tiles lower.
    const top = () => ten.evaluate((el) => el.getBoundingClientRect().top);
    await expect.poll(top).toBeLessThan(40);
    expect(await top()).toBeGreaterThanOrEqual(0);
    await expect(ten.getByRole("list", { name: "Tiêu chí" })).toBeInViewport();
  });

  test("keeps the tiles legible on the projector, two to a row at 1280×720", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "A projector hangs off a desktop.");
    await page.setViewportSize({ width: 1280, height: 720 });
    await mockWorkbenchApi(page);
    await page.goto(`${W1}?chieu=1`);
    await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();
    await page.getByRole("button", { name: "Mở kết quả" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
    const grid = page.locator("[data-case-grid]");
    const columns = await grid.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    expect(columns).toBe(2);
    // R2: the tile's words at body size, 24 px or more.
    const size = await page
      .locator("#cau-1 h4 button")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(24);
    // At rest: the "Bảng câu" rows turn over as the results open (N18), and a row mid-turn
    // reaches past the edge for a moment.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBe(0);
  });
});
