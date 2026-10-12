import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as progress from "~/features/progress/progress";
import { PROGRESS_KEY, readProgress, recordStars } from "~/features/progress/progress";

import { starterBench } from "./bench";
import { runReducer, type RunView } from "./run";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";
import { loadHistory } from "./storage";
import { useRecordHistory, usePreview, useRecordStars, WorkbenchPage } from "./WorkbenchPage";

vi.mock("~/features/progress/progress", async (importOriginal) => {
  const actual = await importOriginal<typeof progress>();
  return { ...actual, recordStars: vi.fn(actual.recordStars) };
});

const l1 = testEnv("grounded-citation");
const DISCARDED = "Cấu hình đã lưu không còn hợp với màn này";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(recordStars).mockClear();
  window.localStorage.clear();
});

describe("WorkbenchPage", () => {
  it("drops the discarded-config notice once the bench saves again", () => {
    const starter = starterBench(l1);
    if (!starter) throw new Error("L1 starter is not drawable");
    window.localStorage.setItem("vg.bench.v1.grounded-citation", "{broken");
    render(
      <MemoryRouter>
        <WorkbenchPage env={l1} starter={starter} back="/play/library" />
      </MemoryRouter>,
    );
    expect(screen.getByText(DISCARDED, { exact: false })).toBeDefined();
    fireEvent.click(screen.getByRole("switch", { name: /Vòm Sao/ }));
    expect(screen.getByText("Đã lưu cấu hình trên máy này.")).toBeDefined();
    expect(screen.queryByText(DISCARDED, { exact: false })).toBeNull();
  });
});

describe("useRecordStars", () => {
  const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
  const scored = short.findIndex((f) => f.event === "run.scored");
  const record = (run: RunView | null, level = l1.level) =>
    renderHook((props: { run: RunView | null }) => useRecordStars(level, props.run), {
      initialProps: { run },
    });

  it("records the stars once per scored run, under the level's zone and id", () => {
    const hook = record(replay(short.slice(0, scored)));
    expect(recordStars).not.toHaveBeenCalled();
    hook.rerender({ run: replay(short.slice(0, scored + 1)) });
    hook.rerender({ run: replay(short) }); // run.finished: same run, no second call
    expect(recordStars).toHaveBeenCalledExactlyOnceWith("library", "grounded-citation", 1);
    expect(readProgress()).toEqual({ library: { "grounded-citation": 1 } });

    const next = runReducer(null, { kind: "reset", runId: "f".repeat(32) });
    hook.rerender({ run: next });
    hook.rerender({ run: replay(short, next) });
    expect(recordStars).toHaveBeenCalledTimes(2);
  });

  it("keeps going when the storage fails", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => record(replay(short))).not.toThrow();
    expect(recordStars).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("warns instead of throwing when the entry is invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => record(replay(short), { ...l1.level, zone: "Thư viện" })).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("usePreview", () => {
  /** One retrieved item in the shape the route really sends, so the parser is exercised too. */
  const item = (chunkId: string) => ({
    chunk_id: chunkId,
    rank: 1,
    score: 0.88,
    doc_id: "quy-che",
    dieu: 12,
    khoan: [1],
    hieu_luc: true,
  });

  /** Answers every preview POST with a chunk id naming the body it was asked about. */
  function serveByBody(fail = false) {
    return vi.fn((_url: string, init?: RequestInit) => {
      if (fail) return Promise.resolve(new Response("", { status: 503 }));
      // previewRetrieval always sends the graph as a JSON string, never a Blob or a stream.
      const body = typeof init?.body === "string" ? init.body : "";
      const payload = {
        case: "lib-l1-v01",
        nodes: { vs: { kind: "retrieved", items: [item(`chunk-for-${body}`)] } },
      };
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  }

  const pulled = (nodes: ReturnType<typeof usePreview>) => nodes?.vs?.items[0]?.chunk_id;

  it("draws no dome for a bench whose preview has not come back yet", async () => {
    vi.useFakeTimers();
    const fetchMock = serveByBody();
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      ({ body }: { body: string }) => usePreview("grounded-citation", "lib-l1-v01", body, true),
      { initialProps: { body: "top_k=3" } },
    );

    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(pulled(result.current)).toBe("chunk-for-top_k=3");

    // The player drags the knob: a different variant, so different chunks and different scores.
    rerender({ body: "top_k=9" });
    // Before: the dome went on drawing the 3-pull and printing its cosines beside a slot that
    // already read 9 -- a quarter of a second on a warm API, 33 s on a cold Render free one.
    expect(result.current).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(pulled(result.current)).toBe("chunk-for-top_k=9");
    vi.useRealTimers();
  });

  it("hides a failed preview, and has the old bench's picture ready if the knob goes back", async () => {
    vi.useFakeTimers();
    const good = serveByBody();
    vi.stubGlobal("fetch", good);
    const { result, rerender } = renderHook(
      ({ body }: { body: string }) => usePreview("grounded-citation", "lib-l1-v01", body, true),
      { initialProps: { body: "a" } },
    );
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(pulled(result.current)).toBe("chunk-for-a");

    const bad = serveByBody(true);
    vi.stubGlobal("fetch", bad);
    rerender({ body: "b" });
    await act(() => vi.advanceTimersByTimeAsync(400));
    // A failed preview is no preview -- and never the previous bench's, which is what the key
    // is for; nothing here needs clearing.
    expect(result.current).toBeNull();

    // Undo the knob: the picture for this exact bench is the one already measured.
    vi.stubGlobal("fetch", serveByBody(true));
    rerender({ body: "a" });
    expect(pulled(result.current)).toBe("chunk-for-a");
    vi.useRealTimers();
  });

  it("asks for nothing while the run on screen still matches the bench", async () => {
    vi.useFakeTimers();
    const fetchMock = serveByBody();
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => usePreview("grounded-citation", "lib-l1-v01", "top_k=3", false));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("usePreview stops work the bench no longer needs", () => {
  it("aborts a request already in flight when the knob moves again", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise<Response>(() => {
          /* never settles: the instance is still working on it */
        });
      }),
    );
    const { rerender, unmount } = renderHook(
      ({ body }: { body: string }) => usePreview("grounded-citation", "lib-l1-v01", body, true),
      { initialProps: { body: "top_k=3" } },
    );
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(false);

    rerender({ body: "top_k=9" });
    // The answer to the old question is already unusable; the 0,1-CPU instance should not
    // finish computing it.
    expect(signals[0]?.aborted).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(signals).toHaveLength(2);
    unmount();
    expect(signals[1]?.aborted).toBe(true);
    vi.useRealTimers();
  });
});

describe("useRecordHistory", () => {
  const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
  const scored = short.findIndex((f) => f.event === "run.scored");
  const BODY = '{"schema":1,"nodes":[],"edges":[]}';
  const record = (run: RunView | null, body: string | null = BODY) =>
    renderHook((props: { run: RunView | null }) => useRecordHistory(l1.level.id, props.run, body), {
      initialProps: { run },
    });

  it("keeps the run once it is scored, with the graph that ran and each case's verdict", () => {
    const hook = record(replay(short.slice(0, scored)));
    // Nothing yet: a run still going has no result to remember.
    expect(loadHistory(l1.level.id)).toEqual([]);

    hook.rerender({ run: replay(short.slice(0, scored + 1)) });
    const kept = loadHistory(l1.level.id);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.body).toBe(BODY);
    expect(kept[0]?.stars).toBe(1);
    expect(kept[0]?.cases.map((c) => [c.n, c.passed])).toEqual([
      [1, true],
      [2, true],
    ]);
  });

  it("remembers which case failed, which is the whole point of the strip", () => {
    // The committed short run passes both cases, so a fixture that cannot fail would let
    // `passed: true` for everything through.
    const run = replay(short.slice(0, scored + 1));
    if (!run) throw new Error("no run");
    const withFailure: RunView = {
      ...run,
      cases: run.cases.map((c, i) =>
        i !== 1 || !c.graded ? c : { ...c, graded: { ...c.graded, passed: false } },
      ),
    };
    record(withFailure);
    expect(loadHistory(l1.level.id)[0]?.cases.map((c) => c.passed)).toEqual([true, false]);
  });

  it("writes one entry per run, however many events arrive after the score", () => {
    const hook = record(replay(short.slice(0, scored + 1)));
    hook.rerender({ run: replay(short) }); // run.finished: the same run
    expect(loadHistory(l1.level.id)).toHaveLength(1);

    const next = runReducer(null, { kind: "reset", runId: "f".repeat(32) });
    hook.rerender({ run: next });
    hook.rerender({ run: replay(short, next) });
    expect(loadHistory(l1.level.id)).toHaveLength(2);
  });

  it("never persists a fact or a gold reveal, which the server hands over per role", () => {
    // A localStorage copy would outlive the role gate the server and Results both apply.
    record(replay(short.slice(0, scored + 1)));
    const raw = window.localStorage.getItem(`vg.history.v1.${l1.level.id}`) ?? "";
    expect(raw).not.toContain("gold");
    expect(raw).not.toContain("facts");
    expect(raw).not.toContain("question");
  });

  it("remembers nothing when it does not know which graph ran", () => {
    record(replay(short.slice(0, scored + 1)), null);
    expect(loadHistory(l1.level.id)).toEqual([]);
  });
});

describe("useRecordHistory and the live bench", () => {
  const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
  const scored = short.findIndex((f) => f.event === "run.scored");

  it("writes nothing more when the player edits the bench after a scored run", () => {
    // The hook takes the graph that RAN. Watching the live body would add an entry on every
    // knob turn, filling the five slots with one run.
    const run = replay(short.slice(0, scored + 1));
    const hook = renderHook(
      (props: { body: string }) => useRecordHistory(l1.level.id, run, props.body),
      { initialProps: { body: '{"ran":1}' } },
    );
    expect(loadHistory(l1.level.id)).toHaveLength(1);
    hook.rerender({ body: '{"ran":1,"edited":true}' });
    hook.rerender({ body: '{"ran":1,"edited":2}' });
    expect(loadHistory(l1.level.id)).toHaveLength(1);
  });
});
