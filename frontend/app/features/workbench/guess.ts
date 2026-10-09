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
}

export const EMPTY_SLIP: Slip = { passed: null, failing: [], bets: {} };

export const isEmptySlip = (slip: Slip) =>
  slip.passed === null && slip.failing.length === 0 && Object.keys(slip.bets).length === 0;

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
  /** Cases the server did not finish (AI overloaded, daily cap): left out of the grade. */
  unfinished: number;
}

export function gradeSlip(slip: Slip, run: RunView): SlipGrade | null {
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
  const actual = run.cases.filter((c) => c.graded?.passed).length;
  return {
    count: slip.passed === null ? null : { guess: slip.passed, actual, total: run.cases.length },
    predictions,
    surprises: predictions.filter((p) => p.confidence === "high" && !p.right),
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
