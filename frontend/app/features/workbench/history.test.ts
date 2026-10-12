import { describe, expect, it } from "vitest";

import { historyMatrix } from "./history";
import type { RunMark } from "./storage";

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
