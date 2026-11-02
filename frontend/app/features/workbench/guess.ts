import { unfinished, type CaseView, type RunView } from "./run";

/**
 * The guess loop (roadmap-v0.4 B1: N1 guess slip, N19 confidence bets, L1 §11 reason menu).
 * Pure: graded on the client from the facts the run already streamed, never a new AI call.
 * Slips are graded only after run.finished and never touch the stars (L1 §7).
 */

export const CONFIDENCE = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export interface Bet {
  pass: boolean;
  confidence: Confidence;
}

export interface Slip {
  /** "Đạt mấy/N?": how many cases the player expects to pass; null when skipped. */
  passed: number | null;
  /** "Câu nào trượt?": 1-based case numbers (golden order) expected to fail, samples excluded. */
  failing: readonly number[];
  /** Bets on the sample cases, by case id. */
  bets: Readonly<Record<string, Bet>>;
  /** The level's own questions (`ASKS`): the index of the option picked, by question id. */
  asks?: Readonly<Record<string, number>>;
}

export const EMPTY_SLIP: Slip = { passed: null, failing: [], bets: {} };

export const isEmptySlip = (slip: Slip) =>
  slip.passed === null &&
  slip.failing.length === 0 &&
  Object.keys(slip.bets).length === 0 &&
  Object.keys(slip.asks ?? {}).length === 0;

/** A question only one level asks, answered from the facts its run already streamed. */
export interface Ask {
  id: string;
  legend: string;
  /** A closed set; the option at the true index is the answer. */
  options: readonly string[];
}

/**
 * Watchtower W1's two questions (watchtower.md §3.6). The attacks are `rules.s1_required` of
 * direct-injection.json (a test keeps the two in step).
 */
export const W1_ATTACKS: readonly string[] = ["wt-w1-t01", "wt-w1-t02", "wt-w1-t03"];

export const ASKS: Readonly<Record<string, readonly Ask[]>> = {
  "direct-injection": [
    {
      id: "net_catches",
      legend: "Lưới chặn được mấy đòn trên 3?",
      options: ["0", "1", "2", "3"],
    },
    {
      id: "blocks_customer",
      legend: "Có khách thật nào bị chặn nhầm không?",
      options: ["Không", "Có"],
    },
  ],
};

const guards = (c: CaseView) =>
  Object.values(c.steps)
    .flatMap((step) => step.facts ?? [])
    .filter((f) => f.kind === "guard");

/**
 * The index of the true option for `id`, or null before the run is finished (or for a question
 * this level does not ask). Graded on the client from the run's own facts: no new AI call.
 */
export function askGrade(levelId: string, id: string, run: RunView): number | null {
  if (run.phase !== "finished" || !ASKS[levelId]?.some((ask) => ask.id === id)) return null;
  if (id === "net_catches") {
    return run.cases.filter(
      (c) =>
        W1_ATTACKS.includes(c.id) &&
        guards(c).some((f) => f.by === "pattern" && f.decision === "block"),
    ).length;
  }
  if (id === "blocks_customer") {
    return run.cases.some((c) => c.graded?.labels.includes("guard.blocked_benign")) ? 1 : 0;
  }
  return null;
}

export interface Prediction {
  c: CaseView;
  /** What the player said: pass or fail. */
  pass: boolean;
  right: boolean;
  /** Sample cases only. */
  confidence?: Confidence;
}

export interface SlipGrade {
  count: { guess: number; actual: number; total: number } | null;
  /** Golden order. */
  predictions: Prediction[];
  /** "Bất ngờ": a sure bet that was wrong (N19). */
  surprises: Prediction[];
  /** The level's own questions the player answered, with the truth. */
  asks: { ask: Ask; guess: number; actual: number }[];
  /** Cases the server did not finish (AI overloaded, daily cap): left out of the grade. */
  unfinished: number;
}

export function gradeSlip(slip: Slip, run: RunView, levelId?: string): SlipGrade | null {
  if (run.phase !== "finished") return null;
  const skipped = new Set(unfinished(run).map((c) => c.id));
  const predictions: Prediction[] = [];
  for (const c of run.cases) {
    if (!c.graded || skipped.has(c.id)) continue;
    const bet = slip.bets[c.id];
    // Unpicked cases count as "will pass" only once the player answered "which fail".
    const picked = c.role !== "visible" && slip.failing.length > 0;
    if (!bet && !picked) continue;
    const pass = bet ? bet.pass : !slip.failing.includes(c.n);
    predictions.push({
      c,
      pass,
      right: pass === c.graded.passed,
      ...(bet && { confidence: bet.confidence }),
    });
  }
  // The count is scored over the cases the stars read: those that ran, minus the info cases.
  // A case the daily cap or an outage left unanswered cannot have passed, so keeping it in the
  // denominator would charge the player for the server's trouble (daily-shift §3.3 exempts
  // such a run entirely); and workbench-v0.1 §8.2 words the header "{normal + trap} câu tính
  // sao" precisely so this denominator cannot disagree with it.
  const graded = run.cases.filter((c) => c.graded?.counted && !skipped.has(c.id));
  const actual = graded.filter((c) => c.graded?.passed).length;
  return {
    count: slip.passed === null ? null : { guess: slip.passed, actual, total: graded.length },
    predictions,
    surprises: predictions.filter((p) => p.confidence === "high" && !p.right),
    asks: (levelId ? (ASKS[levelId] ?? []) : []).flatMap((ask) => {
      const guess = slip.asks?.[ask.id];
      const actual = askGrade(levelId ?? "", ask.id, run);
      return guess === undefined || actual === null ? [] : [{ ask, guess, actual }];
    }),
    unfinished: skipped.size,
  };
}

/** The situations of the "Vì sao câu #N sai?" menu (L1 §11). */
export type Why = "no_docs" | "cite" | "trap" | "budget";

const hasDocs = (c: CaseView) =>
  Object.values(c.steps).some((step) =>
    step.facts?.some((fact) => fact.kind === "pack" && fact.tokens.docs > 0),
  );

/**
 * What the reason menu asks about: the first failed case that fits one of its situations, else
 * the run's token budget (`c` null), else nothing. Only after run.finished, like the diagnosis.
 */
export function whyCase(run: RunView): { why: Why; c: CaseView | null } | null {
  if (run.phase !== "finished" || !run.score) return null;
  const skipped = new Set(unfinished(run).map((c) => c.id));
  for (const c of run.cases) {
    const g = c.graded;
    if (!g?.counted || g.passed || skipped.has(c.id)) continue;
    if (c.role === "trap") return { why: "trap", c };
    if (g.criteria.points === true && g.criteria.cited === false) return { why: "cite", c };
    if (!hasDocs(c)) return { why: "no_docs", c };
  }
  return run.score.s2 ? null : { why: "budget", c: null };
}
