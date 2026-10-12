/**
 * The regression strip (N3): the level's last runs as rows, its cases as columns, so a learner
 * reads across a row to see what one configuration did and down a column to see which case a
 * change broke.
 *
 * Pure logic, no rendering, like bin.ts and journey.ts beside it.
 */

import type { Stars } from "~/features/progress/progress";

import type { RunMark } from "./storage";

/** "skip": that run never reached this case, which is missing data and not a verdict. */
export type Cell = "pass" | "fail" | "skip";

export interface HistoryRow {
  at: number;
  stars: Stars;
  /** One per column of the matrix, in column order, so a row is drawn straight across. */
  cells: readonly { n: number; state: Cell }[];
}

export interface HistoryMatrix {
  /** Case numbers across every run shown, ascending. */
  columns: readonly number[];
  /** Newest first, the order the store hands them over. */
  rows: readonly HistoryRow[];
}

export function historyMatrix(runs: readonly RunMark[]): HistoryMatrix {
  // Every run shown, not only the first: a sample run grades three of ten cases, and taking the
  // columns from one row would drop the others' cases off the picture.
  const columns = [...new Set(runs.flatMap((r) => r.cases.map((c) => c.n)))].sort((a, b) => a - b);
  const rows = runs.map((run) => {
    const verdict = new Map(run.cases.map((c) => [c.n, c.passed]));
    return {
      at: run.at,
      stars: run.stars,
      cells: columns.map((n) => {
        const passed = verdict.get(n);
        return { n, state: passed === undefined ? "skip" : passed ? "pass" : "fail" } as const;
      }),
    };
  });
  return { columns, rows };
}
