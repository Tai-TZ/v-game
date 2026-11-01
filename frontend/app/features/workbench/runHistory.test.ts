import { describe, expect, it } from "vitest";

import { graphFromBench, setCard, starterBench, type Bench } from "./bench";
import { compare, historyMatrix, lastPassing } from "./runHistory";
import type { RunMark } from "./storage";
import { testEnv } from "./test-fixtures";

const mark = (at: number, stars: 0 | 1 | 2 | 3, ns: number[]): RunMark => ({
  body: `{"at":${at}}`,
  at,
  stars,
  tokens: 100,
  budget: 3000,
  cases: ns.map((n) => ({ n, role: "visible" as const, passed: n % 2 === 1 })),
});

describe("historyMatrix", () => {
  it("lines the runs up on one column per case, so a row reads across", () => {
    const m = historyMatrix([mark(3, 1, [1, 2, 3]), mark(2, 0, [1, 2, 3])]);
    expect(m.columns).toEqual([1, 2, 3]);
    expect(m.rows).toHaveLength(2);
    expect(m.rows[0]?.cells.map((c) => [c.n, c.state])).toEqual([
      [1, "pass"],
      [2, "fail"],
      [3, "pass"],
    ]);
  });

  it("keeps the newest run at the top, the order the store hands over", () => {
    const m = historyMatrix([mark(9, 3, [1]), mark(5, 1, [1]), mark(1, 0, [1])]);
    expect(m.rows.map((r) => r.at)).toEqual([9, 5, 1]);
  });

  it("takes the columns from every run shown, not only the first", () => {
    // A sample run grades three of ten cases; the wider run must not lose its columns.
    const m = historyMatrix([mark(2, 0, [1, 2]), mark(1, 1, [1, 2, 3, 4])]);
    expect(m.columns).toEqual([1, 2, 3, 4]);
  });

  it("calls a case a run never reached 'did not run', never a failure", () => {
    // The whole honesty of the strip: a missing cell is missing data, not a verdict.
    const m = historyMatrix([mark(2, 0, [1, 2]), mark(1, 1, [1, 2, 3])]);
    expect(m.rows[0]?.cells.map((c) => c.state)).toEqual(["pass", "fail", "skip"]);
    expect(m.rows[1]?.cells.map((c) => c.state)).toEqual(["pass", "fail", "pass"]);
  });

  it("sorts the columns by case number however the runs listed them", () => {
    const m = historyMatrix([mark(1, 0, [3, 1, 2])]);
    expect(m.columns).toEqual([1, 2, 3]);
    expect(m.rows[0]?.cells.map((c) => c.n)).toEqual([1, 2, 3]);
  });

  it("has nothing to draw with no runs behind it", () => {
    expect(historyMatrix([])).toEqual({ columns: [], rows: [] });
  });
});

describe("lastPassing", () => {
  it("picks the newest run that earned a star, not the newest run", () => {
    // Star 1 is the level's passing line: it is what lights the zone.
    const runs = [mark(9, 0, [1]), mark(5, 2, [1]), mark(1, 1, [1])];
    expect(lastPassing(runs)?.at).toBe(5);
  });

  it("has nothing to go back to when no run earned a star", () => {
    expect(lastPassing([mark(2, 0, [1]), mark(1, 0, [1])])).toBeNull();
  });

  it("has nothing to go back to with no history at all", () => {
    expect(lastPassing([])).toBeNull();
  });

  it("takes the one passing run whatever its place in the list", () => {
    expect(lastPassing([mark(3, 0, [1]), mark(2, 0, [1]), mark(1, 3, [1])])?.at).toBe(1);
  });
});

describe("compare", () => {
  const l3 = testEnv("article-number-lookup");
  const start = () => {
    const bench = starterBench(l3);
    if (!bench) throw new Error("L3 starter is not drawable");
    return bench;
  };
  const body = (bench: Bench) => JSON.stringify(graphFromBench(l3, bench));
  const run = (b: string, cases: [number, boolean][]): RunMark => ({
    body: b,
    at: 1,
    stars: 1,
    tokens: 10,
    budget: 20,
    cases: cases.map(([n, passed]) => ({ n, role: "visible" as const, passed })),
  });

  it("finds no change and no flip between a run and itself", () => {
    const b = body(start());
    const result = compare(l3, run(b, [[1, true]]), run(b, [[1, true]]));
    expect(result).toEqual({ changes: [], flipped: [] });
  });

  it("names exactly the cases whose verdict differs, by case number", () => {
    const b = body(start());
    const prev = run(b, [
      [1, true],
      [2, true],
    ]);
    const now = run(b, [
      [1, true],
      [2, false],
    ]);
    const result = compare(l3, prev, now);
    expect(result?.flipped).toEqual([{ n: 2, from: true, to: false }]);
  });

  it("leaves out a case missing from either side, which is not a flip", () => {
    const b = body(start());
    const prev = run(b, [[1, true]]);
    const now = run(b, [
      [1, true],
      [2, false],
    ]);
    expect(compare(l3, prev, now)?.flipped).toEqual([]);
  });

  it("counts a card swap as two changes, via diffGraphs", () => {
    const before = body(setCard(setCard(start(), 0, "G1"), 1, "G2"));
    const after = body(setCard(setCard(start(), 0, "G2"), 1, "G1"));
    expect(compare(l3, run(before, []), run(after, []))?.changes).toHaveLength(2);
  });

  it("has nothing to say when a body can no longer be drawn on this level", () => {
    expect(compare(l3, run("{broken", []), run(body(start()), []))).toBeNull();
  });
});
