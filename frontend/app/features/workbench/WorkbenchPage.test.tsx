import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as progress from "~/features/progress/progress";
import { PROGRESS_KEY, readProgress, recordStars } from "~/features/progress/progress";

import { starterBench } from "./bench";
import { runReducer, type RunView } from "./run";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";
import { useRecordStars, usePreview, WorkbenchPage } from "./WorkbenchPage";

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
