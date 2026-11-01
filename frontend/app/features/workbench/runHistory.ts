/**
 * The regression strip (N3): the level's last runs as rows, its cases as columns, so a learner
 * reads across a row to see what one configuration did and down a column to see which case a
 * change broke.
 *
 * Pure logic, no rendering, like bin.ts and journey.ts beside it.
 */

import * as v from "valibot";

import type { Stars } from "~/features/progress/progress";

import type { Env } from "./bench";
import { diffGraphs, type Change } from "./diff";
import { GraphSchema, type Graph } from "./schema";
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

/**
 * The newest run that earned a star, or none. Star 1 is the level's passing line -- it is what
 * lights the zone on the campus -- so it is what "go back to the last version that worked"
 * means.
 *
 * A run the daily cap cut short is not in the history at all (useRecordHistory withholds it),
 * so there is no untrustworthy star to filter out here.
 */
export const lastPassing = (runs: readonly RunMark[]): RunMark | null =>
  runs.find((run) => run.stars >= 1) ?? null;

/**
 * What changed between two remembered runs of the same level, and which cases flipped (N20).
 *
 * The honest-causality label of the comparison card rests entirely on `changes.length`: a
 * single turnable variable may be offered as a cause, two or more may not. See diffGraphs.
 */
export function compare(
  env: Env,
  prev: RunMark,
  now: RunMark,
): { changes: Change[]; flipped: readonly { n: number; from: boolean; to: boolean }[] } | null {
  const before = parseGraph(prev.body);
  const after = parseGraph(now.body);
  if (before === null || after === null) return null;

  const prevVerdict = new Map(prev.cases.map((c) => [c.n, c.passed]));
  const flipped = now.cases.flatMap((c) => {
    const was = prevVerdict.get(c.n);
    return was === undefined || was === c.passed ? [] : [{ n: c.n, from: was, to: c.passed }];
  });
  return { changes: diffGraphs(env, before, after), flipped };
}

/** A mark's body, parsed like any other JSON the player's own bench once produced. */
function parseGraph(body: string): Graph | null {
  try {
    const parsed = v.safeParse(GraphSchema, JSON.parse(body));
    return parsed.success ? parsed.output : null;
  } catch {
    return null;
  }
}
