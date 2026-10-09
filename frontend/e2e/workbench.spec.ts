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

    // The reference solution, built with the toys.
    await page.getByRole("switch", { name: "Gắn Vòm Sao" }).check();
    await page.getByRole("slider", { name: /Móc kéo/ }).fill("3");
    await page.getByRole("switch", { name: /Máy đóng tem/ }).check();
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

    await page.getByRole("button", { name: "Chỉnh rồi chạy lại" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Bàn thợ" })).toBeFocused();
    await expect(page.getByRole("slider", { name: /Móc kéo/ })).toHaveValue("3");
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
    let loads = 0;
    await page.route("**/api/levels/*", async (route) => {
      loads += 1;
      if (loads === 1) {
        await held;
        return route.fulfill({ status: 500, json: { detail: "Lỗi" } });
      }
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
});
