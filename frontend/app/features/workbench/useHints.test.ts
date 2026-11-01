import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHints } from "./HintLadder";
import { configKey, loadHints } from "./hints";
import type { CaseView, RunView } from "./run";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const L1 = "grounded-citation";
const ZONE = "library";

const kase = (n: number, passed: boolean): CaseView => ({
  id: `lib-l1-v0${n}`,
  n,
  role: "visible",
  vai: "",
  state: "graded",
  steps: {},
  tokens: { in: 0, out: 0 },
  graded: { status: passed ? "ok" : "fail", passed, counted: true, criteria: {}, labels: [] },
});
const failedSample = (runId: string): RunView => ({
  runId,
  lastSeq: 0,
  stream: "closed",
  phase: "finished",
  scope: "mau",
  ingestion: [],
  cases: [kase(1, false), kase(2, true), kase(3, true)],
});

function hook(run: RunView | null, body: string | null, left: number | null = 13) {
  return renderHook(
    (props: { run: RunView | null; body: string | null; left: number | null }) =>
      useHints({
        levelId: L1,
        zoneId: ZONE,
        run: props.run,
        ranBody: props.body,
        gate: { left: props.left, starPrice: 10 },
      }),
    { initialProps: { run, body, left } },
  );
}

describe("useHints", () => {
  it("puts a failed run on the book, once per configuration, and keeps it", () => {
    const { result, rerender } = hook(failedSample("r1"), "cfg-a");
    expect(result.current.book.fails["1"]?.configs).toEqual([configKey("cfg-a")]);
    rerender({ run: failedSample("r2"), body: "cfg-a", left: 13 });
    expect(result.current.book.fails["1"]?.configs).toHaveLength(1);
    rerender({ run: failedSample("r3"), body: "cfg-b", left: 13 });
    expect(loadHints(L1).fails["1"]?.configs).toHaveLength(2);
  });

  it("walks the ladder to the worked example once the gate opens", () => {
    // Pool 2 after a failed sample run: less than the 3 another sample run costs (X28).
    const { result } = hook(failedSample("r1"), "cfg-a", 2);
    act(() => result.current.openNext());
    expect(result.current.book.targets.s1?.opened).toBe(1);
    act(() => result.current.openNext()); // no look yet
    expect(result.current.book.targets.s1?.opened).toBe(1);
    act(() => result.current.markLook());
    act(() => result.current.openNext());
    act(() => result.current.markLook());
    expect(result.current.gate3).toBe(true);
    act(() => result.current.openNext());
    expect(result.current.book.targets.s1?.opened).toBe(3);
    expect(loadHints(L1).log.map((e) => e.n)).toEqual([1, 2, 3]);
  });

  it("keeps hint 3 shut while the pool still pays for another attempt", () => {
    // 5 calls cover another sample run (3), which is what a failed sample run is priced at;
    // priced as a star run (10), the pool would wrongly read as spent.
    const { result } = hook(failedSample("r1"), "cfg-a", 5);
    act(() => result.current.openNext());
    act(() => result.current.markLook());
    act(() => result.current.openNext());
    act(() => result.current.markLook());
    expect(result.current.gate3).toBe(false);
    act(() => result.current.openNext());
    expect(result.current.book.targets.s1?.opened).toBe(2);
  });

  it("aims the sample run at star 2 once star 1 is earned on this level", () => {
    window.localStorage.setItem("vg-progress-v1", JSON.stringify({ [ZONE]: { [L1]: 1 } }));
    const { result } = hook(failedSample("r1"), "cfg-a");
    expect(result.current.target?.star).toBe(2);
    expect(result.current.book.fails["2"]?.configs).toHaveLength(1);
  });
});

describe("useHints with a blocked store", () => {
  it("still walks the ladder to the worked example", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      const { result } = hook(failedSample("r1"), "cfg-a", 2);
      act(() => result.current.openNext());
      act(() => result.current.markLook());
      act(() => result.current.openNext());
      act(() => result.current.markLook());
      act(() => result.current.openNext());
      expect(result.current.book.targets.s1?.opened).toBe(3);
    } finally {
      blocked.mockRestore();
    }
  });
});
