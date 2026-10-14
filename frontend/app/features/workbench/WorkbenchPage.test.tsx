import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as progress from "~/features/progress/progress";
import { PROGRESS_KEY, readProgress, recordStars } from "~/features/progress/progress";

import { graphFromBench, setAttached, setParam, starterBench } from "./bench";
import { runReducer, type RunView } from "./run";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";
import { loadHistory, type RunMark } from "./storage";
import {
  useRecordHistory,
  usePreview,
  useLastSample,
  useRecordedRun,
  useRecordStars,
  useStaticViz,
  useStarRunAfterSample,
  WorkbenchPage,
} from "./WorkbenchPage";

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

describe("a run the daily cap cut short is not a star attempt", () => {
  const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
  const capped = short.map((f) => {
    if (f.event !== "case.graded") return f;
    const data = JSON.parse(f.data) as Record<string, unknown>;
    return {
      ...f,
      data: JSON.stringify({ ...data, status: "skipped_budget", reason: "daily_cap" }),
    };
  });

  it("does not overwrite the stored stars, and does not join the history", () => {
    // §3.3: "không tính là một lần thử sao (… không ghi đè kết quả sao)". The run is still
    // graded and still on screen; it just is not a result.
    const run = replay(capped);
    renderHook(() => {
      useRecordStars(l1.level, run);
      useRecordHistory(l1.level.id, run, '{"ran":1}');
    });
    expect(recordStars).not.toHaveBeenCalled();
    expect(readProgress()).toEqual({});
    expect(loadHistory(l1.level.id)).toEqual([]);
  });

  it("still records a run whose cases the player's own budget skipped", () => {
    // The paired positive: an ordinary failure must still be a result, or "never record"
    // would pass the test above.
    const ownBudget = short.map((f) => {
      if (f.event !== "case.graded") return f;
      const data = JSON.parse(f.data) as Record<string, unknown>;
      return { ...f, data: JSON.stringify({ ...data, status: "skipped_budget" }) };
    });
    const run = replay(ownBudget);
    renderHook(() => {
      useRecordStars(l1.level, run);
      useRecordHistory(l1.level.id, run, '{"ran":1}');
    });
    expect(recordStars).toHaveBeenCalledOnce();
    expect(loadHistory(l1.level.id)).toHaveLength(1);
  });

  it("leaves a case that never ran out of the strip instead of calling it a failure", () => {
    // `passed: c.graded?.passed ?? false` labelled an ungraded case as broken, which is a
    // verdict the run never reached.
    const run = replay(
      short.slice(
        0,
        short.findIndex((f) => f.event === "case.graded"),
      ),
    );
    const scoredWithUngraded: RunView | null =
      run === null ? null : { ...run, score: { stars: 1, tokens: 1, budget: 2 } as never };
    renderHook(() => useRecordHistory(l1.level.id, scoredWithUngraded, '{"ran":1}'));
    expect(loadHistory(l1.level.id)[0]?.cases).toEqual([]);
  });
});

describe("useRecordHistory reports what it wrote", () => {
  const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
  const scored = short.findIndex((f) => f.event === "run.scored");

  it("hands the fresh list back, because the store is otherwise write-only", () => {
    // Without this the strip would show nothing until the next page load: loadHistory has no
    // other caller on the page.
    const seen: RunMark[][] = [];
    renderHook(() =>
      useRecordHistory(l1.level.id, replay(short.slice(0, scored + 1)), '{"ran":1}', (runs) =>
        seen.push(runs),
      ),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0]?.body).toBe('{"ran":1}');
  });
});

describe("going back to a remembered configuration", () => {
  const seed = (body: string, stars: 0 | 1 | 2 | 3 = 1) =>
    window.localStorage.setItem(
      `vg.history.v1.${l1.level.id}`,
      JSON.stringify({
        runs: [
          {
            body,
            at: 1,
            stars,
            tokens: 10,
            budget: 20,
            cases: [{ n: 1, role: "visible", passed: true }],
          },
        ],
      }),
    );

  const page = () => {
    const starter = starterBench(l1);
    if (!starter) throw new Error("L1 starter is not drawable");
    return render(
      <MemoryRouter>
        <WorkbenchPage env={l1} starter={starter} back="/play/library" />
      </MemoryRouter>,
    );
  };

  it("puts the starred run's values back on the bench, and saves them", () => {
    const starter = starterBench(l1);
    if (!starter) throw new Error("no starter");
    const seven = setParam(
      l1,
      setAttached(starter, "vector_search", true),
      "vector_search",
      "top_k",
      7,
    );
    seed(JSON.stringify(graphFromBench(l1, seven)));
    page();
    // L1 starts with no search block, so the knob is not even on the bench yet.
    expect(screen.queryByRole("slider", { name: /Móc kéo/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quay về bản đạt gần nhất" }));
    fireEvent.click(screen.getByRole("button", { name: "Quay về" }));

    // The drawn control, not a handler call: this is what the player sees.
    expect(screen.getByRole("slider", { name: /Móc kéo/ })).toHaveProperty("value", "7");
    expect(window.localStorage.getItem(`vg.bench.v1.${l1.level.id}`)).toContain('"top_k":7');
  });

  it("leaves the bench alone and says so when that configuration no longer fits", () => {
    // A value outside today's domain, the same case a discarded saved config hits (W8).
    seed(
      '{"schema":1,"nodes":[{"id":"vs","type":"vector_search","params":{"top_k":99}}],"edges":[]}',
    );
    page();
    fireEvent.click(screen.getByRole("button", { name: "Quay về bản đạt gần nhất" }));
    fireEvent.click(screen.getByRole("button", { name: "Quay về" }));
    // Untouched: still the starter, with no search block and so no knob.
    expect(screen.queryByRole("slider", { name: /Móc kéo/ })).toBeNull();
    expect(screen.getByRole("switch", { name: /Vòm Sao/ })).toHaveProperty("checked", false);
    expect(screen.getByText(/không còn vẽ được trên bàn thợ/)).toBeDefined();
  });

  it("offers nothing to go back to when no remembered run earned a star", () => {
    seed('{"schema":1,"nodes":[],"edges":[]}', 0);
    page();
    expect(screen.queryByRole("button", { name: /Quay về bản đạt/ })).toBeNull();
  });
});

describe("useStarRunAfterSample (N2)", () => {
  const started = (scope?: "mau") => ({
    id: 1,
    event: "run.started" as const,
    data: JSON.stringify({
      scope,
      ingestion: [],
      cases: [{ id: "v01", role: "visible", vai: "su-kien", question: "a" }],
    }),
  });
  const graded = (passed: boolean) => ({
    id: 2,
    event: "case.graded" as const,
    data: JSON.stringify({
      case: "v01",
      status: passed ? "ok" : "fail",
      passed,
      counted: true,
      criteria: {},
      labels: [],
    }),
  });
  const done = {
    id: 3,
    event: "run.finished" as const,
    data: JSON.stringify({ report: { gold: {}, diagnosis: [] }, models: {} }),
  };
  const sample = (passed: boolean) => replay([started("mau"), graded(passed), done]);
  const BODY = '{"schema":1,"nodes":[],"edges":[]}';

  const chain = (run: RunView | null, body: string | null = BODY) => {
    const started: string[] = [];
    const hook = renderHook(
      (props: { run: RunView | null }) =>
        useStarRunAfterSample(props.run, body, (b) => started.push(b)),
      { initialProps: { run } },
    );
    return { started, hook };
  };

  it("starts the star run on the graph that cleared the gate, not the bench as it stands now", () => {
    const { started } = chain(sample(true));
    expect(started).toEqual([BODY]);
  });

  it("starts nothing when a sample case failed", () => {
    expect(chain(sample(false)).started).toEqual([]);
  });

  it("starts nothing for a star run, which is already the second step", () => {
    expect(chain(replay([started(), graded(true), done])).started).toEqual([]);
  });

  it("starts the star run once, however often the sample run re-renders", () => {
    const { started, hook } = chain(sample(true));
    hook.rerender({ run: sample(true) });
    hook.rerender({ run: sample(true) });
    expect(started).toEqual([BODY]);
  });

  it("starts nothing when nobody knows which graph ran", () => {
    expect(chain(sample(true), null).started).toEqual([]);
  });
});

describe("a recorded run is nobody's attempt (N4)", () => {
  // Today every shipped log happens to score 0, so a missing guard would leave no mark and the
  // test would pass on the content rather than on the code. Three stars makes it bite.
  const scored = (stars: number) => ({
    id: 2,
    event: "run.scored" as const,
    data: JSON.stringify({
      score: {
        stars,
        s1: true,
        s2: true,
        s3: true,
        normal_passed: 8,
        normal_total: 8,
        traps_passed: 2,
        traps_total: 2,
        tokens: 8800,
        budget: 15000,
      },
    }),
  });
  const log = (scope?: "da_ghi") => [
    {
      id: 1,
      event: "run.started" as const,
      data: JSON.stringify({
        scope,
        ingestion: [],
        cases: [{ id: "v01", role: "visible", vai: "su-kien", question: "a" }],
      }),
    },
    scored(3),
    {
      id: 3,
      event: "run.finished" as const,
      data: JSON.stringify({ report: { gold: {}, diagnosis: [] }, models: {} }),
    },
  ];

  it("writes no stars for a replayed log, however many it says it earned", () => {
    renderHook(() => useRecordStars(l1.level, replay(log("da_ghi"))));
    expect(recordStars).not.toHaveBeenCalled();
    expect(readProgress()).toEqual({});
  });

  it("still writes the stars of the player's own star run, so the guard is not a blanket", () => {
    renderHook(() => useRecordStars(l1.level, replay(log())));
    expect(recordStars).toHaveBeenCalledExactlyOnceWith("library", "grounded-citation", 3);
  });

  it("puts no row in the regression strip for a run the player never made", () => {
    renderHook(() => useRecordHistory("grounded-citation", replay(log("da_ghi")), "{}"));
    expect(loadHistory("grounded-citation")).toEqual([]);
  });

  it("still puts the player's own star run in the strip", () => {
    renderHook(() => useRecordHistory("grounded-citation", replay(log()), "{}"));
    expect(loadHistory("grounded-citation")).toHaveLength(1);
  });
});

describe("useRecordedRun (N4)", () => {
  const body = JSON.parse(readText("public", "runs", "grounded-citation.json")) as unknown;

  function serve(status: number, payload: unknown = body) {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify(payload), { status }));
    });
    return urls;
  }

  afterEach(() => vi.unstubAllGlobals());

  it("asks nobody for anything until the player asks to see it", () => {
    const urls = serve(200);
    renderHook(() => useRecordedRun(l1.level));
    expect(urls).toEqual([]);
  });

  it("plays the shipped log off the static file, not off the API", async () => {
    const urls = serve(200);
    const { result } = renderHook(() => useRecordedRun(l1.level));
    await act(() => result.current.show());
    expect(urls).toEqual(["/runs/grounded-citation.json"]);
    expect(result.current.run?.phase).toBe("finished");
    expect(result.current.run?.scope).toBe("da_ghi");
  });

  it("fetches once however often the player reopens it", async () => {
    const urls = serve(200);
    const { result } = renderHook(() => useRecordedRun(l1.level));
    await act(() => result.current.show());
    await act(() => result.current.show());
    expect(urls).toHaveLength(1);
  });

  it("leaves the level playable when the file is missing", async () => {
    serve(404, null);
    const { result } = renderHook(() => useRecordedRun(l1.level));
    await act(() => result.current.show());
    expect(result.current.run).toBeNull();
    expect(result.current.failed).toBe(true);
  });

  // The version is the level's, not a constant: a level whose cases moved on must not be
  // answered with the run recorded against the old ones.
  it("refuses a log recorded before this version of the level", async () => {
    serve(200);
    const { result } = renderHook(() => useRecordedRun({ ...l1.level, version: 2 }));
    await act(() => result.current.show());
    expect(result.current.run).toBeNull();
    expect(result.current.failed).toBe(true);
  });

  it("leaves the level playable when the file is some other level's", async () => {
    serve(200, JSON.parse(readText("public", "runs", "chunk-tuning.json")));
    const { result } = renderHook(() => useRecordedRun(l1.level));
    await act(() => result.current.show());
    expect(result.current.run).toBeNull();
    expect(result.current.failed).toBe(true);
  });
});

describe("useLastSample (N2)", () => {
  const started = (scope?: "mau") => ({
    id: 1,
    event: "run.started" as const,
    data: JSON.stringify({
      scope,
      ingestion: [],
      cases: [{ id: "v01", role: "visible", vai: "su-kien", question: "a" }],
    }),
  });
  const graded = {
    id: 2,
    event: "case.graded" as const,
    data: JSON.stringify({
      case: "v01",
      status: "ok",
      passed: true,
      counted: true,
      criteria: {},
      labels: [],
    }),
  };
  const done = {
    id: 3,
    event: "run.finished" as const,
    data: JSON.stringify({ report: { gold: {}, diagnosis: [] }, models: {} }),
  };
  const sample = () => replay([started("mau"), graded, done]);
  const star = () => replay([started(), graded, done]);

  it("remembers nothing before a sample run has finished", () => {
    const { result } = renderHook(() => useLastSample(replay([started("mau")])));
    expect(result.current).toBeNull();
  });

  // "Run chấm sao đang chạy tiếp" is a promise about a state the player must be able to see.
  // Dropping the summary the moment the star run starts makes that sentence unreadable.
  it("keeps the finished sample on screen while the star run behind it runs", () => {
    const { result, rerender } = renderHook(
      (props: { run: RunView | null }) => useLastSample(props.run),
      { initialProps: { run: null as RunView | null } },
    );
    rerender({ run: sample() });
    expect(result.current?.scope).toBe("mau");
    rerender({ run: star() });
    expect(result.current?.scope).toBe("mau");
  });

  // A second Mở ca resets the run rather than clearing it, so "null" is not the signal. While
  // the new samples run, last shift's "Cả 3 câu mẫu đạt" would otherwise still be on screen.
  it("forgets it the moment a new sample run starts, not when that one finishes", () => {
    const { result, rerender } = renderHook(
      (props: { run: RunView | null }) => useLastSample(props.run),
      { initialProps: { run: null as RunView | null } },
    );
    rerender({ run: sample() });
    expect(result.current).not.toBeNull();
    rerender({ run: replay([started("mau")]) });
    expect(result.current).toBeNull();
  });

  it("forgets it once a fresh Mở ca puts a new run in its place", () => {
    const { result, rerender } = renderHook(
      (props: { run: RunView | null }) => useLastSample(props.run),
      { initialProps: { run: null as RunView | null } },
    );
    rerender({ run: sample() });
    rerender({ run: null });
    expect(result.current).toBeNull();
  });
});

describe("useStaticViz (N22)", () => {
  const body = JSON.parse(readText("public", "viz", "chunk-tuning.json")) as unknown;
  const l2 = testEnv("chunk-tuning");

  function serve(status: number, payload: unknown = body) {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify(payload), { status }));
    });
    return urls;
  }

  afterEach(() => vi.unstubAllGlobals());

  // The free preview, so it loads without being asked: by the time the player drags the blade
  // the strip has to already be able to redraw.
  it("loads the level's static data off the static file, unprompted", async () => {
    const urls = serve(200);
    const { result } = renderHook(() => useStaticViz(l2.level));
    await act(() => Promise.resolve());
    expect(urls).toEqual(["/viz/chunk-tuning.json"]);
    expect(result.current?.ranks["theo_dieu-512-10"]).toBeDefined();
  });

  it("leaves the level playable when the data is missing", async () => {
    serve(404, null);
    const { result } = renderHook(() => useStaticViz(l2.level));
    await act(() => Promise.resolve());
    expect(result.current).toBeNull();
  });

  it("refuses another level's data rather than drawing it", async () => {
    serve(200, JSON.parse(readText("public", "viz", "grounded-citation.json")));
    const { result } = renderHook(() => useStaticViz(l2.level));
    await act(() => Promise.resolve());
    expect(result.current).toBeNull();
  });

  // A file missing one of its four parts would be handed on and then throw on first access,
  // because `data.strips[variant]` reads a property of undefined.
  it("refuses a file that is missing one of its parts", async () => {
    const rest = Object.fromEntries(
      Object.entries(body as Record<string, unknown>).filter(([key]) => key !== "strips"),
    );
    serve(200, rest);
    const { result } = renderHook(() => useStaticViz(l2.level));
    await act(() => Promise.resolve());
    expect(result.current).toBeNull();
  });

  it("refuses data recorded before this version of the level", async () => {
    serve(200);
    const { result } = renderHook(() => useStaticViz({ ...l2.level, version: 2 }));
    await act(() => Promise.resolve());
    expect(result.current).toBeNull();
  });
});
