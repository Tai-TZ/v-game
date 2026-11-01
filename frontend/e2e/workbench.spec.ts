import http from "node:http";
import type { AddressInfo } from "node:net";

import type { Page } from "@playwright/test";

import { fillDefaults } from "../app/features/workbench/bench";
import type { Graph } from "../app/features/workbench/schema";
import { levelFile, parseSse, sseText, testEnv } from "../app/features/workbench/test-fixtures";
import { bundleReport, expect, mockWorkbenchApi, runId, sse, test } from "./fixtures";

const L1 = "/play/library/grounded-citation";
const L3 = "/play/library/article-number-lookup";
const fmt = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

interface Score {
  stars: number;
  normal_passed: number;
  normal_total: number;
  traps_passed: number;
  traps_total: number;
  tokens: number;
  budget: number;
}

/** What the captured reference run says, so the assertions follow the log. */
function referenceFacts() {
  const frames = parseSse(sse.reference());
  const data = (event: string) =>
    frames
      .filter((f) => f.event === event)
      .map((f) => JSON.parse(f.data) as Record<string, unknown>);
  const score = data("run.scored")[0]?.score as Score;
  const finished = data("run.finished")[0] as {
    report: { diagnosis: unknown[] };
    models: Record<string, number>;
  };
  const cases = (data("run.started")[0]?.cases as unknown[]).length;
  return { score, finished, cases };
}

const SSE_HEADERS = { "content-type": "text/event-stream", "cache-control": "no-store" };

/**
 * A real local SSE server: Chrome adds Last-Event-ID below Playwright's interception, so a
 * fulfilled route never shows it; route.continue() forwards the request with it.
 */
async function sseServer(reply: (n: number, response: http.ServerResponse) => void) {
  const lastEventIds: (string | null)[] = [];
  const server = http.createServer((request, response) => {
    const last = request.headers["last-event-id"];
    lastEventIds.push(typeof last === "string" ? last : null);
    reply(lastEventIds.length, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    lastEventIds,
    attach: (page: Page) =>
      page.route("**/api/runs/*/events", (route) =>
        route.continue({ url: `http://127.0.0.1:${port}/events` }),
      ),
    close: () => server.close(),
  };
}

test.describe("workbench", () => {
  test("plays L1 from the zone page to stars, then keeps the graph", async ({
    page,
    consoleErrors,
  }) => {
    const mock = await mockWorkbenchApi(page, { events: () => sse.reference() });
    const requested: string[] = [];
    page.on("request", (request) => requested.push(new URL(request.url()).pathname));

    await page.goto("/play/library");
    await page.getByRole("link", { name: "Vào màn Thôi bịa điều luật" }).click();
    // A client-side route change moves focus to the new page's h1 (screen readers hear it).
    await expect(page.getByRole("heading", { level: 1, name: "Thôi bịa điều luật" })).toBeFocused();

    // The reference solution, built with the toys. One toy is open at a time: the bench opens
    // on the empty search socket, and the bin and the brain are opened from the machine.
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await page.getByRole("slider", { name: /Móc kéo/ }).fill("3");
    await page.getByRole("button", { name: "Thùng Context: Chưa chạy" }).click();
    await page.getByRole("switch", { name: /Máy đóng tem/ }).check();
    await page.getByRole("button", { name: "Bộ Óc: Chưa chạy" }).click();
    await page.getByLabel("Khe thẻ 1").selectOption("G1");
    await page.getByLabel("Khe thẻ 2").selectOption("G2");
    await page.getByLabel("Khe thẻ 3").selectOption("G3");
    await page.getByRole("button", { name: "Mở ca" }).click();

    const results = page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" });
    await expect(results).toBeFocused();
    // The bench shows the followed case's grade on its answer board (§7).
    await expect(page.locator("#slot-out").getByText("Đạt", { exact: true })).toBeVisible();
    const post = mock.posts[0];
    expect(post?.contentType).toBe("application/json");
    expect(post?.key).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    const env = testEnv("grounded-citation");
    expect(fillDefaults(env.blocks, JSON.parse(post?.body ?? "{}") as Graph)).toEqual(
      fillDefaults(env.blocks, levelFile("grounded-citation").reference_graph),
    );

    const { score, finished, cases } = referenceFacts();
    await expect(page.getByText(`${score.stars}/3 sao`, { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        `${score.normal_passed}/${score.normal_total} câu thường đạt · câu #1 (Minh): `,
      ),
    ).toBeVisible();
    await expect(page.getByText(`${fmt(score.tokens)}/${fmt(score.budget)} token`)).toBeVisible();
    await expect(
      page.getByText(`${score.traps_passed}/${score.traps_total} câu bẫy đạt · `),
    ).toBeVisible();
    await expect(page.locator("article[id^='cau-']")).toHaveCount(cases);
    const diagnosis = page.getByRole("heading", { name: "Cô Lan chẩn đoán" });
    await expect(diagnosis).toBeVisible();
    if (finished.report.diagnosis.length === 0) {
      await expect(page.getByText("Không có câu nào cần chẩn đoán.")).toBeVisible();
    }
    const [model, calls] = Object.entries(finished.models)[0] ?? ["", 0];
    await expect(page.getByText(`${model} (${calls} lời gọi)`)).toBeVisible();

    // The gate frontend-architecture §12 promised: every figure carries its three parts. Until
    // today `data-vg-viz` appeared nowhere in the app, so this could never have fired.
    // The history hook is wired into the page, not only unit-tested: a scored run leaves one
    // summary behind, with the graph that ran and each case's verdict (N3).
    const history = await page.evaluate(() =>
      window.localStorage.getItem("vg.history.v1.grounded-citation"),
    );
    const kept = JSON.parse(history ?? "null") as { runs?: { cases?: unknown[] }[] } | null;
    expect(kept?.runs).toHaveLength(1);
    expect(kept?.runs?.[0]?.cases).toHaveLength(cases);

    // Picking a debrief option (N20) writes onto that same stored run, through the full
    // WorkbenchPage -> Debrief -> onDebrief -> recordExtras chain, not only the unit-tested parts.
    await page.locator('input[name="debrief-next"]').first().check();
    const afterDebrief = await page.evaluate(() => {
      const raw = window.localStorage.getItem("vg.history.v1.grounded-citation");
      return JSON.parse(raw ?? "null") as { runs?: { next?: unknown }[] } | null;
    });
    expect(afterDebrief?.runs?.[0]?.next).toBeDefined();

    // The strip is on the page, loaded at mount and refreshed by the write: one row for the
    // run that just finished.
    await expect(page.getByRole("heading", { name: "Các lượt trước" })).toBeVisible();
    await expect(page.locator("[data-run-row]")).toHaveCount(1);

    // The strip is thirteen columns wide at L1, so it is the page's widest thing by far. Measure
    // here, while it is on screen: the suite's other overflow check runs after a reload, which
    // drops the in-memory run and takes the strip with it -- so deleting the strip's scroller
    // would not have failed anything.
    const wide = page.viewportSize();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    // The width goes somewhere: inside the strip's own region, not into the page.
    expect(
      await page
        .locator('[data-vg-viz="table"] [role="region"]')
        .evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBe(true);
    if (wide) await page.setViewportSize(wide);

    // Duplicating a row loads its configuration and is not itself a run: the strip stays at one.
    await page.getByRole("button", { name: "Nhân bản cấu hình của lượt 1" }).click();
    const afterDuplicate = await page.evaluate(() => {
      const raw = window.localStorage.getItem("vg.history.v1.grounded-citation");
      return (JSON.parse(raw ?? "null") as { runs?: unknown[] } | null)?.runs?.length ?? 0;
    });
    expect(afterDuplicate).toBe(1);

    // A figure inside a collapsed <details> ("Xem vết chạy") is in the DOM but not visible, and
    // the gate is about what every figure carries, not about which disclosure happens to be
    // open. Open them all first, as the a11y suite does.
    for (const details of await page.locator("details").all()) {
      await details.evaluate((element) => element.setAttribute("open", ""));
    }
    const figures = page.locator("[data-vg-viz]");
    const count = await figures.count();
    expect(count).toBeGreaterThan(0);
    const STAMPS = [
      "Đo từ lượt của bạn",
      "Đo từ nhãn của bạn",
      "Tính sẵn từ chỉ mục",
      "Minh hoạ",
      "Lượt chạy đã ghi",
      "Mô phỏng",
      "Dữ liệu ghi sẵn",
    ];
    for (let i = 0; i < count; i++) {
      const figure = figures.nth(i);
      await expect(figure.locator("figcaption")).not.toBeEmpty();
      const text = (await figure.textContent()) ?? "";
      expect(STAMPS.filter((stamp) => text.includes(stamp))).toHaveLength(1);
      // The toggle is for a picture that needs a readable alternative (§8.2). A figure that is
      // already a table has nothing to swap to, and a button that did nothing would be worse.
      // Read the kind off the element: below 640 px every figure of the other kind is SHOWING
      // a table, so looking for one in the DOM cannot tell them apart.
      const toggle = figure.getByRole("button", { name: /^Xem dạng (bảng|hình)$/ });
      if ((await figure.getAttribute("data-vg-viz")) === "table") {
        // Both halves, or the check is the component asserting its own flag: a figure may skip
        // the toggle only by really being a table.
        await expect(figure.locator("table")).toHaveCount(1);
        await expect(toggle).toHaveCount(0);
      } else {
        await expect(toggle).toBeVisible();
        // And the toggle must actually swap the form, not merely exist.
        const before = await figure.locator("table").count();
        await toggle.click();
        await expect(figure.locator("table")).toHaveCount(before === 0 ? 1 : 0);
        await toggle.click();
      }
    }

    await page.getByRole("button", { name: "Chỉnh rồi chạy lại" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Bàn thợ" })).toBeFocused();
    // The brain is still the open toy; the dome is opened from the machine.
    await page.getByRole("button", { name: /^Vòm Sao:/ }).click();
    await expect(page.getByRole("slider", { name: /Móc kéo/ })).toHaveValue("3");
    // After a reload L1 opens on its search again, its first toy to turn.
    await page.reload();
    await expect(page.getByRole("slider", { name: /Móc kéo/ })).toHaveValue("3");
    await expect(page.getByText("Đã lưu cấu hình trên máy này.")).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(
      requested.filter((path) => bundleReport.threeChunks.some((c) => path.endsWith(c))),
    ).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("checks an invalid L3 graph before sending, then shows the server's 422 on its slot", async ({
    page,
  }) => {
    const mock = await mockWorkbenchApi(page, {
      post: () => ({
        status: 422,
        body: {
          detail: "Đồ thị chưa chạy được. Sửa các lỗi bên dưới rồi thử lại.",
          issues: [
            {
              code: "G06",
              severity: "error",
              node: "rr",
              port: null,
              message_vi: "top_n của *Xếp hạng lại* là 9 nhưng phía trước chỉ lấy 3 đoạn.",
              concept_ref: "N8.top_n",
            },
          ],
        },
      }),
    });
    await page.goto(L3);
    await page.getByRole("switch", { name: "Gắn Phễu" }).check();
    const funnel = page.locator("#slot-fu");
    await expect(funnel).toContainText("Hợp nhất kết quả gộp từ 2 đến 3 danh sách, đang có 1.");
    await expect(funnel).toContainText("Gắn thêm Tủ ngăn kéo hoặc tháo Phễu.");

    await page.getByRole("button", { name: "Mở ca" }).click();
    const summary = page
      .getByRole("alert")
      .filter({ hasText: "Còn 1 lỗi cần sửa trước khi mở ca." });
    await expect(summary).toBeFocused();
    expect(mock.posts).toHaveLength(0);
    // The error points at the fix (attach the keyword drawer), not at the funnel's own switch.
    await summary.getByRole("button", { name: /^Phễu:/ }).click();
    await expect(page.getByRole("switch", { name: "Gắn Tủ ngăn kéo" })).toBeFocused();

    await page.getByRole("switch", { name: "Gắn Tủ ngăn kéo" }).check();
    await expect(funnel).not.toContainText("gộp từ 2 đến 3 danh sách");
    await page.getByRole("switch", { name: "Gắn Kính lúp" }).check();
    await page.getByRole("button", { name: "Mở ca" }).click();

    const serverSummary = page
      .getByRole("alert")
      .filter({ hasText: "Đồ thị chưa chạy được. Sửa các lỗi bên dưới rồi thử lại." });
    await expect(serverSummary).toBeFocused();
    await expect(page.locator("#slot-rr")).toContainText(
      "top_n của Xếp hạng lại là 9 nhưng phía trước chỉ lấy 3 đoạn.",
    );
    await serverSummary.getByRole("button", { name: /^Kính lúp:/ }).click();
    await expect(page.locator("#slot-rr").getByRole("slider")).toBeFocused();
  });

  test("answers 429 with the server's words and retries with the same key", async ({ page }) => {
    const mock = await mockWorkbenchApi(page, {
      post: (n) =>
        n === 1
          ? { status: 429, body: { detail: "Đang có nhiều lượt chạy, bạn thử lại sau ít phút." } }
          : undefined,
    });
    await page.goto(L1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    const busy = page.getByRole("alert").filter({ hasText: "Máy chủ đang bận" });
    await expect(busy).toBeFocused();
    await expect(busy).toContainText("Đang có nhiều lượt chạy, bạn thử lại sau ít phút.");
    await expect(busy).not.toContainText("giây");

    await busy.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeFocused();
    expect(mock.posts).toHaveLength(2);
    expect(mock.posts[1]?.key).toBe(mock.posts[0]?.key);
    expect(mock.posts[1]?.body).toBe(mock.posts[0]?.body);

    await page.getByRole("button", { name: "Chỉnh rồi chạy lại" }).click();
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await page.getByRole("slider", { name: /Móc kéo/ }).fill("4");
    await expect(page.getByText("Kết quả của cấu hình trước khi bạn chỉnh.")).toBeVisible();
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect.poll(() => mock.posts.length).toBe(3);
    expect(mock.posts[2]?.key).not.toBe(mock.posts[0]?.key);
  });

  test("reconnects with Last-Event-ID and never counts an event twice", async ({ page }) => {
    const frames = parseSse(sse.short());
    const cut = 9;
    let release: () => void = () => undefined;
    const seen = new Promise<void>((resolve) => {
      release = resolve;
    });
    const server = await sseServer((n, response) => {
      response.writeHead(200, SSE_HEADERS);
      if (n === 1) return response.end(`retry: 1000\n\n${sseText(frames.slice(0, cut))}`);
      // Held until the test has seen the "reconnecting" line, so no timing window matters. The
      // server replays from the start whatever Last-Event-ID says: the browser gets 1…9 twice.
      void seen.then(() => response.end(sseText(frames)));
    });
    try {
      await mockWorkbenchApi(page);
      await server.attach(page);
      await page.goto(L1);
      await page.getByRole("button", { name: "Mở ca" }).click();
      await expect(page.getByText("Mất kết nối, đang nối lại…")).toBeVisible();
      release();

      await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeVisible();
      expect(server.lastEventIds).toEqual([null, String(cut)]);
      // Tokens per case = the case's step.finished tokens, counted once.
      await expect(page.locator("#cau-1")).toContainText(`${fmt(1180 + 150)} token`);
      await expect(page.locator("#cau-2")).toContainText(`${fmt(1020 + 40)} token`);
    } finally {
      release();
      server.close();
    }
  });

  test("follows a lost run again from a full replay, counting nothing twice", async ({ page }) => {
    const frames = parseSse(sse.short());
    const cut = 9;
    const server = await sseServer((n, response) => {
      // 1: part of the run; 2: the automatic reconnect finds no run (404, the stream is lost);
      // 3: "Thử nối lại" opens a new EventSource, which the server replays from event 1.
      if (n === 2) return response.writeHead(404).end();
      response.writeHead(200, SSE_HEADERS);
      response.end(n === 1 ? `retry: 300\n\n${sseText(frames.slice(0, cut))}` : sseText(frames));
    });
    try {
      await mockWorkbenchApi(page);
      await server.attach(page);
      await page.goto(L1);
      await page.getByRole("button", { name: "Mở ca" }).click();
      const lost = page
        .getByRole("alert")
        .filter({ hasText: "Không theo dõi được lượt chạy nữa." });
      await expect(lost).toBeFocused();
      await lost.getByRole("button", { name: "Thử nối lại" }).click();

      await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeFocused();
      expect(server.lastEventIds).toEqual([null, String(cut), null]);
      await expect(page.locator("article[id^='cau-']")).toHaveCount(2);
      await expect(page.locator("#cau-1")).toContainText(`${fmt(1180 + 150)} token`);
      await expect(page.locator("#cau-2")).toContainText(`${fmt(1020 + 40)} token`);
    } finally {
      server.close();
    }
  });

  test("stops a run on request, and cancels a run the player walks away from", async ({ page }) => {
    let cancelled: () => void = () => undefined;
    const cancelSeen = new Promise<void>((resolve) => {
      cancelled = resolve;
    });
    let failFirst: () => void = () => undefined;
    const firstHeld = new Promise<void>((resolve) => {
      failFirst = resolve;
    });
    const frames = parseSse(sse.short());
    const started = frames.slice(0, 2);
    const stop = (id: number) => [
      {
        id,
        event: "step.finished",
        data: JSON.stringify({
          type: "step.finished",
          run: runId(1),
          case: "lib-l1-v01",
          node: "q",
          block: "input",
          status: "cancelled",
          summary: "Bước này bị huỷ.",
          tokens: { in: 0, out: 0 },
          ms: 3,
          facts: [],
        }),
      },
      {
        id: id + 1,
        event: "run.failed",
        data: JSON.stringify({
          type: "run.failed",
          run: runId(1),
          code: "cancelled",
          message_vi: "Lượt chạy bị dừng giữa chừng. Bạn thử chạy lại nhé.",
        }),
      },
    ];
    const mock = await mockWorkbenchApi(page, {
      events: async (n) => {
        if (n === 1) {
          await cancelSeen;
          return sseText([...started, ...stop(3)]);
        }
        // Second run: started, then silence (the browser would retry in a minute).
        return `retry: 60000\n\n${sseText(frames.slice(0, 1))}`;
      },
      // The first stop is held, then fails; the next ones work.
      cancel: async (n) => {
        if (n === 1) {
          await firstHeld;
          return 500;
        }
        cancelled();
        return 202;
      },
    });

    await page.goto(L1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    // Inline confirms take focus, and give it back to the button that opened them (§9).
    const stopButton = page.getByRole("button", { name: "Dừng ca" });
    await stopButton.click();
    await expect(
      page.getByText("Dừng lượt chạy này? Các câu đã gọi AI vẫn bị tính."),
    ).toBeFocused();
    await page.getByRole("button", { name: "Chạy tiếp" }).click();
    await expect(stopButton).toBeFocused();
    // Escape backs out of an inline confirm like "Chạy tiếp" does.
    await stopButton.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Chạy tiếp" })).toHaveCount(0);
    await expect(stopButton).toBeFocused();
    await stopButton.click();
    await page.getByRole("button", { name: "Dừng lượt chạy" }).click();
    await expect(page.getByText("Đang dừng lượt chạy…")).toBeVisible();
    failFirst();
    await expect(page.getByText("Chưa dừng được lượt chạy. Bấm Dừng ca lần nữa.")).toBeVisible();
    await expect(stopButton).toBeFocused();
    await stopButton.click();
    await page.getByRole("button", { name: "Dừng lượt chạy" }).click();
    // The player's own stop is not an error: a neutral status box, in the player's words.
    const stopped = page.getByRole("status").filter({ hasText: "Đã dừng lượt chạy" });
    await expect(stopped).toBeFocused();
    await expect(stopped).toContainText("Bạn đã dừng lượt chạy. Các câu đã chấm vẫn ở bảng câu.");
    expect(mock.cancels).toEqual([runId(1), runId(1)]);
    await expect(stopped.getByRole("button", { name: "Chạy lại" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Gắn Vòm Sao" })).toBeEnabled();
    // Retrying is the fix after a failed run, so no "same config, same result" note here.
    await expect(page.getByText("Cấu hình này giống hệt lượt vừa rồi")).toHaveCount(0);

    const restore = page.getByRole("button", { name: "Khôi phục cấu hình khởi đầu" });
    await restore.click();
    await expect(
      page.getByText("Cấu hình hiện tại sẽ được thay bằng cấu hình khởi đầu của màn."),
    ).toBeFocused();
    await page.getByRole("button", { name: "Giữ cấu hình" }).click();
    await expect(restore).toBeFocused();
    await restore.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Giữ cấu hình" })).toHaveCount(0);
    await expect(restore).toBeFocused();

    await stopped.getByRole("button", { name: "Chạy lại" }).click();
    await expect(page.getByText("Bàn thợ khóa trong lúc chạy.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^#1 · Câu mẫu/ })).toBeVisible();
    await page.getByRole("banner").getByRole("link", { name: "Về danh sách màn" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
    await expect.poll(() => mock.cancels).toEqual([runId(1), runId(1), runId(2)]);
  });

  test("cancels a run whose start answers after the player left", async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mock = await mockWorkbenchApi(page, {
      post: async () => {
        await held;
        return undefined;
      },
    });
    await page.goto(L1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect.poll(() => mock.posts.length).toBe(1);
    await page.getByRole("banner").getByRole("link", { name: "Về danh sách màn" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Thư viện" })).toBeVisible();
    release();
    await expect.poll(() => mock.cancels).toEqual([runId(1)]);
    expect(mock.streams).toBe(0);
  });

  test("recovers from a lost stream when the new run cannot start", async ({ page }) => {
    const mock = await mockWorkbenchApi(page, {
      post: (n) =>
        n === 3
          ? { status: 503, body: { detail: "Chỉ mục chưa dựng xong.", code: "index_missing" } }
          : undefined,
    });
    // The server restarted: the run is gone, so every stream answers 404 (EventSource CLOSED).
    await page.route("**/api/runs/*/events", (route) =>
      route.fulfill({ status: 404, json: { detail: "Không tìm thấy lượt chạy." } }),
    );
    await page.goto(L1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    const lost = page.getByRole("alert").filter({ hasText: "Không theo dõi được lượt chạy nữa." });
    await expect(lost).toBeFocused();
    // Back to the bench without spending a new run: the lost one is cancelled.
    await lost.getByRole("button", { name: "Chỉnh cấu hình" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Bàn thợ" })).toBeFocused();
    await expect(page.getByRole("switch", { name: "Gắn Vòm Sao" })).toBeEnabled();
    expect(mock.posts).toHaveLength(1);
    await expect.poll(() => mock.cancels).toEqual([runId(1)]);

    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(lost).toBeFocused();
    await expect(lost).toContainText("Chạy lại sẽ hủy lượt này và mở ca mới");
    await lost.getByRole("button", { name: "Thử nối lại" }).click();
    await expect(lost).toBeFocused();

    await lost.getByRole("button", { name: "Chạy lại" }).click();
    const notReady = page.getByRole("alert").filter({ hasText: "Máy chủ chưa sẵn sàng chạy" });
    await expect(notReady).toBeFocused();
    await expect(notReady).toContainText("Chỉ mục chưa dựng xong.");
    expect(mock.cancels).toEqual([runId(1), runId(2)]);
    expect(mock.posts).toHaveLength(3);
    await expect(page.getByRole("switch", { name: "Gắn Vòm Sao" })).toBeEnabled();
  });

  test("groups cô Lan's diagnosis by lesson and points at the knob to turn", async ({ page }) => {
    const diagnosis = [
      {
        case: "lib-l1-v01",
        flag: "ret.gold_rank:vector_search",
        message_vi: "Đoạn đúng của câu #1 đứng hạng 4 ở Vòm Sao, mà Móc kéo chỉ kéo 3 sao.",
      },
      {
        case: "lib-l1-t01",
        flag: "ret.gold_rank:vector_search",
        message_vi: "Đoạn đúng của câu #2 đứng hạng 6 ở Vòm Sao, mà Móc kéo chỉ kéo 3 sao.",
      },
    ];
    await mockWorkbenchApi(page, {
      events: () =>
        sse.short().replace('"diagnosis":[]', `"diagnosis":${JSON.stringify(diagnosis)}`),
    });
    await page.goto(L1);
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await page.getByRole("button", { name: "Mở ca" }).click();

    const lessons = page.getByRole("list", { name: "Cô Lan chẩn đoán" });
    await expect(lessons.getByRole("listitem")).toHaveCount(1);
    await expect(lessons).toContainText("câu #1 đứng hạng 4");
    await expect(lessons).not.toContainText("hạng 6");
    await expect(lessons.getByRole("link", { name: "câu #2" })).toHaveAttribute("href", "#cau-2");
    await lessons.getByRole("button", { name: "Xem ở Vòm Sao" }).click();
    await expect(page.getByRole("slider", { name: /Móc kéo/ })).toBeFocused();
  });

  test("comes back to the diagnosis after 'Xem câu', with focus left alone", async ({ page }) => {
    const diagnosis = [
      { case: "lib-l1-v01", flag: "llm.cite_missing", message_vi: "Câu #1 không trích nguồn." },
    ];
    await mockWorkbenchApi(page, {
      events: () =>
        sse.reference().replace('"diagnosis": []', `"diagnosis":${JSON.stringify(diagnosis)}`),
    });
    await page.goto("/play/library");
    await page.getByRole("link", { name: "Vào màn Thôi bịa điều luật" }).click();
    const title = page.getByRole("heading", { level: 1, name: "Thôi bịa điều luật" });
    await expect(title).toBeFocused();
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeFocused();

    const link = page.getByRole("link", { name: "Xem câu #1" });
    await link.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(100);
    await link.click();
    await expect(page).toHaveURL(/#cau-1$/);
    await page.goBack();
    await expect(page).toHaveURL(/grounded-citation$/);
    // A hash link and Back to it stay on the same page: no jump to the top, no focus on the h1.
    await expect
      .poll(() => page.evaluate((y) => Math.abs(window.scrollY - y), before))
      .toBeLessThan(5);
    await expect(title).not.toBeFocused();
  });

  test("says a level is loading, then moves focus to it, also after a failed load", async ({
    page,
  }) => {
    await mockWorkbenchApi(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let releaseRetry: () => void = () => undefined;
    const retryHeld = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    let loads = 0;
    await page.route("**/api/levels/*", async (route) => {
      loads += 1;
      if (loads === 1) {
        await held;
        return route.fulfill({ status: 500, json: { detail: "Lỗi" } });
      }
      await retryHeld;
      return route.fallback();
    });
    await page.goto("/play/library");
    await page.getByRole("link", { name: "Vào màn Thôi bịa điều luật" }).click();
    // The zone page stays while the level loads: it says so instead of looking dead.
    await expect(page.getByRole("status").filter({ hasText: "Đang tải trang…" })).toBeAttached();
    await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "true");
    release();

    const retry = page.getByRole("button", { name: "Thử lại" });
    await expect(
      page.getByRole("heading", { level: 1, name: "Chưa tải được màn này." }),
    ).toBeFocused();
    await expect(page.getByRole("main")).not.toHaveAttribute("aria-busy", "true");
    await retry.focus();
    await page.keyboard.press("Enter");
    // A retry is a revalidation, not a navigation: it says it is loading all the same.
    await expect(page.getByRole("status").filter({ hasText: "Đang tải trang…" })).toBeAttached();
    await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "true");
    releaseRetry();
    // "Thử lại" leaves the page with the level: focus goes to its h1, not to <body>.
    await expect(page.getByRole("heading", { level: 1, name: "Thôi bịa điều luật" })).toBeFocused();
  });

  test("sends an L3 dense-only rank lesson to the keyword drawer, not to a hook at its limit", async ({
    page,
  }) => {
    // The L3 starter (dense search only): the gold passage ranks 9th while Móc kéo stops at 5.
    const diagnosis = [
      {
        case: "lib-l1-v01",
        flag: "ret.gold_rank:vector_search",
        message_vi:
          "Đoạn Điều 47 khoản 2 đứng hạng 9 ở Vòm Sao. Điều 12 và Điều 30 chiếm chỗ trên nó.",
      },
    ];
    const note = "Xếp hạng lại giữ 3/3 đoạn nên không đổi thứ tự, nhưng vẫn tốn thời gian.";
    await mockWorkbenchApi(page, {
      post: (n) => ({
        status: 202,
        body: {
          run_id: runId(n),
          created: true,
          issues: [
            { code: "W_RERANK_NOOP", severity: "info", node: "rr", port: null, message_vi: note },
          ],
        },
      }),
      events: () =>
        sse.short().replace('"diagnosis":[]', `"diagnosis":${JSON.stringify(diagnosis)}`),
    });
    await page.goto(L3);
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeFocused();
    await expect(page.getByText(note)).toBeVisible();

    const lessons = page.getByRole("list", { name: "Cô Lan chẩn đoán" });
    // The drawer is detached: the button says the move, not "Xem ở".
    await lessons.getByRole("button", { name: "Thử gắn Tủ ngăn kéo" }).click();
    const drawer = page.getByRole("switch", { name: "Gắn Tủ ngăn kéo" });
    await expect(drawer).toBeFocused();
    // The run's notes belong to the graph that ran: the first edit clears them.
    await drawer.check();
    await expect(page.getByText(note)).toHaveCount(0);
  });

  test("keeps 'Đang chạy ca' on a 375 px screen once the run has started", async ({ page }) => {
    // The real run up to its stars arrives after the heading took focus (the server's first
    // frames come about a second after the 202), then silence. Case #1's steps fill the bench,
    // which sits above the aside below lg.
    let release: () => void = () => undefined;
    const focused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const frames = parseSse(sse.reference());
    const started = frames.slice(
      0,
      frames.findIndex((frame) => frame.event === "run.scored"),
    );
    await mockWorkbenchApi(page, {
      events: async () => {
        await focused;
        return `retry: 60000\n\n${sseText(started)}`;
      },
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(L1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    const running = page.getByRole("heading", { level: 2, name: "Đang chạy ca" });
    await expect(running).toBeFocused();
    await expect(running).toBeInViewport({ ratio: 1 });
    release();
    await expect(page.getByRole("button", { name: /^#1 · Câu mẫu/ })).toBeVisible();
    await expect(running).toBeInViewport({ ratio: 1 });
    await expect(page.getByText("10/10 câu đã chấm")).toBeInViewport();
  });

  test("keeps 375 px free of sideways scroll with the JSON and the run numbers open", async ({
    page,
  }) => {
    await mockWorkbenchApi(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(L1);
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    await page.getByText("Xem cấu hình JSON").click();
    expect(await overflow()).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeFocused();
    // Open every <details> (JSON again, numbers, traces); the closed set shrinks as we go.
    const closed = page.locator("details:not([open]) > summary");
    while ((await closed.count()) > 0) await closed.first().click();
    expect(await overflow()).toBeLessThanOrEqual(0);
    // Below lg the case table sits under the whole bench: the bench bar links to it.
    await page.getByRole("link", { name: "Đổi câu ở bảng câu" }).click();
    await expect(page.getByRole("heading", { name: "Bảng câu" })).toBeInViewport();
  });

  test("comes back to the diagnosis after 'Xem câu' on a level opened by its own link", async ({
    page,
  }) => {
    // The first page of a visit: its history entry and the hash's both have the key "default".
    const diagnosis = [
      { case: "lib-l1-v01", flag: "llm.cite_missing", message_vi: "Câu #1 không trích nguồn." },
    ];
    await mockWorkbenchApi(page, {
      events: () =>
        sse.reference().replace('"diagnosis": []', `"diagnosis":${JSON.stringify(diagnosis)}`),
    });
    await page.goto(L1);
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeFocused();
    const link = page.getByRole("link", { name: "Xem câu #1" });
    await link.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await link.click();
    await expect(page).toHaveURL(/#cau-1$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).not.toBe(before);
    await page.goBack();
    await expect(page).toHaveURL(/grounded-citation$/);
    await expect
      .poll(() => page.evaluate((y) => Math.abs(window.scrollY - y), before))
      .toBeLessThan(5);
  });

  test("keeps 'Khôi phục' shut while the graph is being sent", async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mock = await mockWorkbenchApi(page, {
      post: async () => {
        await held;
        return undefined;
      },
    });
    await page.goto(L1);
    await page.getByRole("button", { name: "Khôi phục cấu hình khởi đầu" }).click();
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect.poll(() => mock.posts.length).toBe(1);
    await expect(page.getByRole("button", { name: "Đang gửi cấu hình…" })).toBeVisible();
    // Restoring now would unlock the bench and let a second POST out beside the first.
    await expect(page.getByRole("button", { name: "Khôi phục", exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" })).toBeFocused();
    expect(mock.posts).toHaveLength(1);
  });

  test("drops the discarded-config notice once the bench saves again", async ({ page }) => {
    await mockWorkbenchApi(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(["vg", "bench", "v1", "grounded-citation"].join("."), "{broken");
    });
    await page.goto(L1);
    const discarded = page.getByText("Cấu hình đã lưu không còn hợp với màn này");
    await expect(discarded).toBeVisible();
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await expect(page.getByText("Đã lưu cấu hình trên máy này.")).toBeVisible();
    await expect(discarded).toHaveCount(0);
  });

  test("shows the loading bar on screen after 'Vào màn' far down the zone page", async ({
    page,
  }) => {
    await mockWorkbenchApi(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/levels/article-number-lookup", async (route) => {
      await held;
      return route.fallback();
    });
    await page.goto("/play/library");
    const enter = page.getByRole("link", { name: "Vào màn Hỏi bằng số điều" });
    await enter.scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 2000);
    await enter.click();
    const bar = page.locator("[data-page-loading]");
    await expect(bar).toBeInViewport();
    // Reduced motion: a still bar across the screen, not a strip stuck at a third.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const width = page.viewportSize()?.width ?? 0;
    await expect
      .poll(async () => (await bar.locator("div").boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(width - 1);
    release();
    await expect(page.getByRole("heading", { level: 1, name: "Hỏi bằng số điều" })).toBeFocused();
  });

  test("grades the guess slip after the run, with a surprise for a sure call gone wrong", async ({
    page,
    consoleErrors,
  }) => {
    await mockWorkbenchApi(page, { events: () => sse.short() });
    await page.goto(L1);
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    // N6: before any run every slot says so, in words beside its icon.
    await expect(page.locator("#slot-vs [data-state]")).toHaveText("Trạng thái khối: Chưa chạy");

    // N1 + N19: one click per answer, nothing required. The slip ships collapsed so the aside
    // keeps Mở ca on the first screen at 1280x800 (workbench-v0.1 §2.1, §19.1), and a closed
    // <details> is hidden from the accessibility tree, so getByRole cannot see inside it.
    const disclosure = page.locator("details", {
      has: page.locator("summary", { hasText: "Đoán trước khi mở ca" }),
    });
    await expect(disclosure).not.toHaveAttribute("open", "");
    // Set rather than clicked: clicking toggles, so calling this twice would close it again.
    const openSlip = () => disclosure.evaluate((d) => d.setAttribute("open", ""));
    await openSlip();
    const slip = page.getByRole("region", { name: "Đoán trước khi mở ca" });
    await slip.getByRole("group", { name: "Đạt mấy/10?" }).getByText("2", { exact: true }).click();
    const first = slip.getByRole("group", { name: "Câu #1 · Câu mẫu" });
    await first.getByText("Trượt", { exact: true }).click();
    await first.getByText("Chắc", { exact: true }).click();
    await slip.getByRole("group", { name: "Câu nào trượt?" }).getByText("#9").click();
    // The draft survives a reload, per level.
    await page.reload();
    await openSlip();
    await expect(first.getByRole("radio", { name: "Chắc", exact: true })).toBeChecked();
    await expect(slip.getByRole("checkbox", { name: "Câu #9" })).toBeChecked();

    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" })).toBeFocused();
    const result = page.getByRole("region", { name: "Phiếu đoán của bạn" });
    await expect(result).toContainText("Bạn đoán 2 câu đạt; thực tế 2/2 câu đạt. Khớp.");
    await expect(result).toContainText("Đoán sai · câu #1: bạn đoán trượt (chắc).");
    await expect(result.getByText("Bất ngờ ở câu #1")).toBeVisible();
    await expect(result).toContainText("Bạn chắc câu này sẽ trượt, nhưng nó đạt.");
    await expect(result.getByRole("link", { name: "Xem bằng chứng ở câu #1" })).toHaveAttribute(
      "href",
      "#cau-1",
    );
    // The slip left with the run: the next one starts blank.
    await openSlip();
    await expect(slip.getByRole("radio", { name: "2", exact: true })).not.toBeChecked();
    await expect(slip.getByRole("radio", { name: "Chắc" })).toHaveCount(0);
    expect(
      await page.evaluate(() => window.localStorage.getItem("vg.guess.v1.grounded-citation")),
    ).toBeNull();

    // N18: graded rows turned over (motion allowed here). One live region on the page.
    const row = page.getByRole("region", { name: "Bảng câu" }).getByRole("button").first();
    expect(await row.evaluate((el) => getComputedStyle(el).animationName)).toBe("vg-flip");
    await expect(page.locator("[aria-live]")).toHaveCount(1);

    // N6: the followed case's steps finished; a knob change marks them "run again".
    await expect(page.locator("#slot-vs [data-state]")).toHaveText("Trạng thái khối: Đạt");
    await page.getByRole("slider", { name: /Móc kéo/ }).fill("4");
    await expect(page.locator("#slot-vs [data-state]")).toHaveText("Trạng thái khối: Cần chạy lại");
    await expect(page.locator("#slot-out [data-state]")).toHaveText(
      "Trạng thái khối: Cần chạy lại",
    );
    expect(consoleErrors).toEqual([]);
  });

  test("asks why case #1 failed before cô Lan's diagnosis (L1 §11)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const diagnosis = [
      {
        case: "lib-l1-v01",
        flag: "llm.cite_missing",
        message_vi: "Câu #1 nói đúng ý, nhưng không chỉ ra lấy từ đâu.",
      },
    ];
    const passed =
      '"case":"lib-l1-v01","status":"ok","passed":true,"counted":true,"criteria":{"points":true,"cited":true,"no_fabrication":true,"no_forbidden":true},"labels":[]';
    const failed =
      '"case":"lib-l1-v01","status":"ok","passed":false,"counted":true,"criteria":{"points":true,"cited":false,"no_fabrication":true,"no_forbidden":true},"labels":["cite_missing"]';
    await mockWorkbenchApi(page, {
      events: () =>
        sse
          .short()
          .replace(passed, failed)
          .replace('"diagnosis":[]', `"diagnosis":${JSON.stringify(diagnosis)}`),
    });
    await page.goto(L1);
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeFocused();

    // The failed answer board is an error state, and its row flipped instantly (reduced motion).
    await expect(page.locator("#slot-out [data-state]")).toHaveText("Trạng thái khối: Lỗi");
    const row = page.getByRole("region", { name: "Bảng câu" }).getByRole("button").first();
    await expect(row).toContainText("Trượt");
    expect(await row.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");

    const menu = page.getByRole("group", { name: "Vì sao câu #1 sai?" });
    const lessons = page.getByRole("list", { name: "Cô Lan chẩn đoán" });
    await expect(menu).toBeVisible();
    await expect(lessons).toHaveCount(0);
    await menu.getByText("Các đoạn trong thùng không mang mã, nên không có gì để trích").click();
    await expect(page.getByText("Đúng lý do.")).toBeFocused();
    await expect(lessons).toContainText("không chỉ ra lấy từ đâu");
  });
});

test.describe("the cheap try (B5)", () => {
  test("Mở ca runs the samples first, then the star run on the very same graph", async ({
    page,
    consoleErrors,
  }) => {
    const mock = await mockWorkbenchApi(page, {
      events: (n) => (n === 1 ? sse.sample() : sse.reference()),
    });

    await page.goto("/play/library/grounded-citation");
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await page.getByRole("button", { name: "Mở ca" }).click();

    // Step one is the sample run. Assert on its summary, not on the running panel: a mocked
    // stream arrives whole, so the panel naming the step is on screen for about one frame.
    // exact:false -- the count and "không tính sao" share one paragraph, so an exact match
    // against either half finds nothing.
    await expect(page.getByRole("heading", { name: "Kết quả lượt mẫu" })).toBeVisible();
    await expect(page.getByText("3/3 câu mẫu đạt.", { exact: false })).toBeVisible();
    await expect(page.getByText("Lượt mẫu không tính sao.", { exact: false })).toBeVisible();

    // Step two starts itself once all three samples pass, and the server must see the same
    // graph both times -- that identity is what makes the second step cost 7 calls, not 10.
    await expect(page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" })).toBeFocused();
    expect(mock.posts.map((p) => p.scope)).toEqual(["mau", null]);
    expect(mock.posts[1]?.body).toBe(mock.posts[0]?.body);
    expect(mock.posts[1]?.key).not.toBe(mock.posts[0]?.key);
    // From the log, not from memory: the reference run is the one the fixture captured.
    await expect(
      page.getByText(`${referenceFacts().score.stars}/3 sao`, { exact: true }),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("holds the star run back when a sample case failed, and spends nothing more", async ({
    page,
  }) => {
    const mock = await mockWorkbenchApi(page, { events: () => sse.sample(false) });

    await page.goto("/play/library/grounded-citation");
    await page.getByRole("button", { name: "Mở ca" }).click();

    // The summary says what the gate wants, and the keyboard lands on it rather than on body.
    const summary = page.getByRole("heading", { name: "Kết quả lượt mẫu" });
    await expect(summary).toBeFocused();
    await expect(page.getByText("0/3 câu mẫu đạt.", { exact: false })).toBeVisible();
    await expect(
      page.getByText("Run chấm sao chỉ mở khi cả 3 câu mẫu đạt.", { exact: false }),
    ).toBeVisible();

    // One POST, for the samples. The expensive step is the thing the gate exists to withhold.
    expect(mock.posts.map((p) => p.scope)).toEqual(["mau"]);
    await expect(page.getByRole("heading", { name: "Kết quả ca tối nay" })).toBeHidden();
  });

  // What covers the minute a sleeping Render takes to wake (X9): with the API answering
  // nothing at all, the level still opens on a real run.
  test("plays the recorded run with the API down", async ({ page }) => {
    await mockWorkbenchApi(page, {
      post: () => ({ status: 503, body: { detail: "Máy chủ đang ngủ." } }),
    });

    await page.goto("/play/library/grounded-citation");
    await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Kết quả ca tối nay" })).toBeVisible();
    await expect(page.getByText("Lượt chạy đã ghi", { exact: false })).toBeVisible();
    await expect(page.locator("article[id^='cau-']")).toHaveCount(10);

    // It is nobody's attempt: no stars stored, no row in the regression strip.
    const kept = await page.evaluate(() => ({
      progress: window.localStorage.getItem("vg-progress-v1"),
      history: window.localStorage.getItem("vg.history.v1.grounded-citation"),
    }));
    expect(kept.progress).toBeNull();
    expect(kept.history).toBeNull();
  });

  test("walks the recorded run case by case with the scrub bar", async ({ page }) => {
    await mockWorkbenchApi(page);
    await page.goto("/play/library/grounded-citation");
    await page.getByRole("button", { name: "Xem lượt đã ghi" }).click();

    await expect(page.getByText("Câu #1/10")).toBeVisible();
    await page.getByRole("button", { name: "Tới câu sau" }).click();
    await expect(page.getByText("Câu #2/10")).toBeVisible();
    await page.getByRole("slider", { name: "Tua qua từng câu của lượt này" }).fill("7");
    await expect(page.getByText("Câu #7/10")).toBeVisible();
  });
});

test.describe("the blade's own strip (B6 N22)", () => {
  const L2 = "/play/library/chunk-tuning";

  /** The strip figure for one article. By role, so the figcaption and the table's own sr-only
   *  caption -- identical words, both in the DOM on a narrow screen -- cannot both match. */
  const strip = (page: Page, dieu: number) =>
    page.getByRole("figure").filter({ hasText: `Dải đoạn Điều ${dieu}` });

  /** The figure showing its table, whichever form it opened in. */
  const asTable = async (figure: ReturnType<typeof strip>) => {
    const toTable = figure.getByRole("button", { name: "Xem dạng bảng" });
    if (await toTable.isVisible()) await toTable.click();
    return figure.getByRole("table");
  };

  // Free, and before any run: the strip answers "what did I just do to this article" while the
  // knob is still under the hand. It reads the static data N21 ships, so no API is involved.
  test("draws the favoured article's real cuts, and follows the blade", async ({
    page,
    consoleErrors,
  }) => {
    await mockWorkbenchApi(page);
    await page.goto(L2);

    // The L2 starter is co_dinh/128/0: its search favours Điều 10 of the SUPERSEDED document
    // ("Bảo lưu kết quả học tập" -- Hà's actual question), which 128-token cuts tear into three
    // pieces across two sentences. Every fact here is asserted by strip.e2e-facts.test.tsx
    // against the shipped data, so a content change fails in seconds rather than ten minutes
    // into the Playwright run.
    //
    // Read through the TABLE, not the drawing: below 640 px `Viz` opens these figures as their
    // table alternative, so on the mobile project the bar and its two caption lines are not in
    // the DOM at all -- while the table is reachable at every width. `asTable` normalises it.
    await expect(strip(page, 10)).toBeVisible();
    // The superseded document, named as such. qcdt-2024 has its own Điều 10, and both cut into
    // three pieces with two severed sentences -- this line is what tells them apart on screen.
    await expect(strip(page, 10)).toContainText("văn bản hết hiệu lực");
    const torn = await asTable(strip(page, 10));
    await expect(torn).toContainText("«");
    await expect(torn.getByRole("row")).toHaveCount(4); // head + 3 pieces

    // Nam châm bám Điều cuts on the article boundary: Điều 12 comes back whole.
    //
    // The blade's knobs are chip radios: the input itself is `peer sr-only` and its own label
    // covers it, so `.check()` on the radio times out trying to click a hidden 1px box. The
    // house pattern (see the slip, above) is to scope to the group and click the visible words.
    // The size is a slider over four stops, so it is set from the keyboard: Home is 128, and two
    // steps right is 512.
    const pick = (group: RegExp, option: string) =>
      page.getByRole("group", { name: group }).getByText(option, { exact: true }).click();
    await pick(/Cách chia/, "Bám điều, khoản");
    const blade = page.getByRole("slider", { name: /Cỡ đoạn/ });
    await blade.focus();
    await blade.press("Home");
    await blade.press("ArrowRight");
    await blade.press("ArrowRight");
    await expect(blade).toHaveAttribute("aria-valuetext", "512 token");
    await pick(/Chồng lấp/, "10 %");
    await expect(strip(page, 12)).toBeVisible();
    // Điều 12 of the document still in force, whole, and no stale warning this time.
    await expect(strip(page, 12)).not.toContainText("văn bản hết hiệu lực");
    const whole = await asTable(strip(page, 12));
    await expect(whole.getByRole("row")).toHaveCount(2); // head + the one piece
    await expect(whole).not.toContainText("«"); // nothing severed
    await expect(whole).toContainText("Không");

    // The figure carries its three parts, and the data says where it came from: computed from
    // the shipped index, never measured from a run the player has not made.
    await expect(page.getByText("Tính sẵn từ chỉ mục", { exact: false }).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("keeps the level usable when the static data is not there", async ({ page }) => {
    await mockWorkbenchApi(page);
    await page.route("**/viz/*.json", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto(L2);

    await expect(page.getByRole("button", { name: "Mở ca" })).toBeVisible();
    await expect(page.getByRole("figure").filter({ hasText: "Dải đoạn" })).toHaveCount(0);
  });
});
