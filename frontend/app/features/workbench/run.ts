import {
  parseEvent,
  type CaseRole,
  type EventType,
  type Fact,
  type RunEvent,
  type RunReport,
  type StarResult,
} from "./schema";

/**
 * Live view of one run, built only from its SSE events (workbench-v0.1 §6.3). Pure: no clock,
 * no I/O. Events with `seq <= lastSeq` are ignored, so a reconnect (Last-Event-ID) or a replay
 * from the start gives the same state and never counts tokens twice.
 */

type LlmFact = Extract<Fact, { kind: "llm" }>;

export type StreamState = "connecting" | "live" | "reconnecting" | "lost" | "closed";
export type Phase = "waiting" | "running" | "scored" | "finished" | "failed";

export interface StepView {
  block: string;
  state: "running" | "done";
  status?: string;
  summary?: string;
  ms?: number;
  tokens?: { in: number; out: number };
  facts?: Fact[];
}

export interface CaseView {
  id: string;
  /** 1-based position in run.started (= golden order). */
  n: number;
  role: CaseRole;
  vai: string;
  question?: string;
  state: "waiting" | "running" | "graded";
  /** By node id. Several can be running at once (parallel branches, e.g. vs and bm in L3). */
  steps: Readonly<Record<string, StepView>>;
  tokens: { in: number; out: number };
  answer?: string;
  graded?: {
    status: string;
    passed: boolean;
    counted: boolean;
    /** "daily_cap": the server's quota, not the player's bench, is why this case did not run. */
    reason?: "daily_cap";
    criteria: Readonly<Record<string, boolean>>;
    labels: readonly string[];
  };
}

export interface RunView {
  runId: string;
  lastSeq: number;
  stream: StreamState;
  phase: Phase;
  cases: readonly CaseView[];
  ingestion: readonly { node: string; variant: string; chunks: number; avg_tokens: number }[];
  /**
   * "mau": a sample run over the 3 visible cases (N2). "da_ghi": a log replayed from a static
   * file (N4). Absent on a star run, the only kind that is the player's own attempt.
   */
  scope?: "mau" | "da_ghi";
  score?: StarResult;
  report?: RunReport;
  models?: Readonly<Record<string, number>>;
  /** X7: the model star 2 is calibrated on. Absent when nothing answered this run. */
  primaryModel?: string;
  failure?: { code: string; message_vi: string };
}

export type RunAction =
  | { kind: "reset"; runId: string }
  /** The player gave up on a lost run ("Chạy lại", §2.2): nothing left to follow. */
  | { kind: "clear" }
  | { kind: "stream"; state: "connecting" | "live" | "reconnecting" | "lost" }
  | { kind: "event"; seq: number; event: RunEvent };

export const isActive = (run: RunView | null) =>
  run !== null && (run.phase === "waiting" || run.phase === "running" || run.phase === "scored");

function updateCase(run: RunView, id: string, update: (c: CaseView) => CaseView): RunView {
  return { ...run, cases: run.cases.map((c) => (c.id === id ? update(c) : c)) };
}

function apply(run: RunView, event: RunEvent): RunView {
  switch (event.type) {
    case "run.started": {
      const scope = event.scope;
      const started: RunView = {
        ...run,
        phase: "running",
        ingestion: event.ingestion,
        cases: event.cases.map((c, index) => ({
          id: c.id,
          n: index + 1,
          role: c.role,
          vai: c.vai,
          ...(c.question === undefined ? {} : { question: c.question }),
          state: "waiting",
          steps: {},
          tokens: { in: 0, out: 0 },
        })),
      };
      return scope === undefined ? started : { ...started, scope };
    }
    case "step.started":
      return updateCase(run, event.case, (c) => ({
        ...c,
        state: c.state === "graded" ? c.state : "running",
        steps: { ...c.steps, [event.node]: { block: event.block, state: "running" } },
      }));
    case "step.finished":
      return updateCase(run, event.case, (c) => {
        const answer = event.facts.find((fact): fact is LlmFact => fact.kind === "llm")?.answer;
        return {
          ...c,
          steps: {
            ...c.steps,
            [event.node]: {
              block: event.block,
              state: "done",
              status: event.status,
              summary: event.summary,
              ms: event.ms,
              tokens: event.tokens,
              facts: event.facts,
            },
          },
          tokens: { in: c.tokens.in + event.tokens.in, out: c.tokens.out + event.tokens.out },
          ...(answer === undefined ? {} : { answer }),
        };
      });
    case "case.graded":
      return updateCase(run, event.case, (c) => ({
        ...c,
        state: "graded",
        graded: {
          status: event.status,
          passed: event.passed,
          counted: event.counted,
          criteria: event.criteria,
          labels: event.labels,
          ...(event.reason === undefined ? {} : { reason: event.reason }),
        },
      }));
    case "run.scored":
      return { ...run, phase: "scored", score: event.score };
    case "run.finished":
      return {
        ...run,
        phase: "finished",
        stream: "closed",
        report: event.report,
        models: event.models,
        ...(event.primary_model === undefined ? {} : { primaryModel: event.primary_model }),
      };
    case "run.failed":
      // A failure can follow run.scored (report error, cancel in between): the stars stay.
      return {
        ...run,
        phase: "failed",
        stream: "closed",
        failure: { code: event.code, message_vi: event.message_vi },
      };
  }
}

export function runReducer(run: RunView | null, action: RunAction): RunView | null {
  if (action.kind === "reset") {
    return {
      runId: action.runId,
      lastSeq: 0,
      stream: "connecting",
      phase: "waiting",
      cases: [],
      ingestion: [],
    };
  }
  if (run === null || action.kind === "clear") return null;
  if (action.kind === "stream") {
    return run.stream === "closed" ? run : { ...run, stream: action.state };
  }
  if (!Number.isFinite(action.seq) || action.seq <= run.lastSeq) return run;
  return { ...apply(run, action.event), lastSeq: action.seq };
}

const ENDINGS = new Set<EventType>(["run.scored", "run.finished", "run.failed"]);

/**
 * The action for one SSE frame, or null to drop it (§6.2). An ending event that fails the
 * contract becomes `run.failed{internal}`: dropping it would leave the bench locked and the
 * stream reconnecting forever, since the server closes the stream right after it.
 */
export function frameAction(
  type: EventType,
  data: string,
  seq: number,
): Extract<RunAction, { kind: "event" }> | null {
  const event = parseEvent(type, data);
  if (event) return { kind: "event", seq, event };
  if (!ENDINGS.has(type)) return null;
  return {
    kind: "event",
    seq,
    event: {
      type: "run.failed",
      code: "internal",
      message_vi: "Máy chủ trả kết quả mà bàn thợ không đọc được.",
    },
  };
}

/** Node ids of the steps a case is running right now (several on parallel branches). */
export const runningNodes = (c: CaseView) =>
  Object.entries(c.steps).flatMap(([node, step]) => (step.state === "running" ? [node] : []));

/**
 * The model that answered one case, and whether it came from the replay cache (X7).
 *
 * Null when no model answered: a skipped or timed-out case has no `llm` fact, and on a recorded
 * run the hidden and trap cases keep only `case.graded`. That is missing data, not a fault.
 */
export function caseModel(c: CaseView): { model: string; replayed: boolean } | null {
  for (const step of Object.values(c.steps)) {
    for (const fact of step.facts ?? []) {
      if (fact.kind === "llm") return { model: fact.model, replayed: fact.replayed };
    }
  }
  return null;
}

/**
 * Cases a model other than the primary answered, out of the cases that got an answer (X7).
 *
 * Counted by which model produced the answer, replays included: the spec calibrates star 2 on
 * the primary model because a fallback costs about 0,9k more output tokens on an L3 run, and the
 * grade is read off whichever answer is on screen, cached or not. Whether this run *called* the
 * fallback is a different question, answered by the "lời gọi AI" line.
 *
 * A case with no answer is in neither number -- counting it would make a quota-exhausted run
 * read as "0/10 do model dự phòng" -- and a run that never said which model is primary claims
 * no fallback at all rather than guessing.
 */
export function fallbackAnswers(run: RunView): { fallback: number; answered: number } {
  let fallback = 0;
  let answered = 0;
  for (const c of run.cases) {
    const served = caseModel(c);
    if (served === null) continue;
    answered += 1;
    if (run.primaryModel !== undefined && served.model !== run.primaryModel) fallback += 1;
  }
  return { fallback, answered };
}

/** LLM answers of the run: real calls and answers served from the replay cache (§8.6). */
export function llmCalls(run: RunView): { real: number; replayed: number } {
  let real = 0;
  let replayed = 0;
  for (const c of run.cases) {
    for (const step of Object.values(c.steps)) {
      for (const fact of step.facts ?? []) {
        if (fact.kind !== "llm") continue;
        if (fact.replayed) replayed += 1;
        else real += 1;
      }
    }
  }
  return { real, replayed };
}

/**
 * How far apart the shortest and the longest answer of this run were, in output tokens.
 *
 * §8.4: thinking tokens swing hard -- the same L3 prompt came back in 74 and in 528 output
 * tokens -- and the rule is to show the learner that rather than flatten it. So this is a low
 * and a high, never a mean. `Usage.output_tokens` already includes thinking and the engine
 * emits no separate count, so a split into prompt/output/thinking would draw a number the run
 * never measured.
 *
 * A case that never reached the model is left out: its zero is no answer, not a short one.
 */
export function outTokenSpread(run: RunView): { low: number; high: number; cases: number } | null {
  const out = run.cases.flatMap((c) => (caseModel(c) === null ? [] : [c.tokens.out]));
  if (out.length === 0) return null;
  return { low: Math.min(...out), high: Math.max(...out), cases: out.length };
}

/**
 * The server ran out of its daily quota part-way through this run (§3.3). Such a run is still
 * graded and still shown, but it is not a star attempt: it must not overwrite a stored result,
 * and it does not belong in the history, whose rows are meant to be comparable.
 *
 * A case the player's OWN per-case budget skipped is an ordinary failure and does not count.
 */
export const cappedRun = (run: RunView | null): boolean =>
  run?.cases.some((c) => c.graded?.reason === "daily_cap") ?? false;

/**
 * N2: whether a finished sample run opens the star run behind it. Null while it is still
 * running, and on a star run, which has no gate of its own to pass.
 *
 * "capped" over "failed" when the server's own quota skipped a case (§3.3): the star run stays
 * shut either way, but only one of the two is something the player did.
 */
export function sampleVerdict(run: RunView | null): "passed" | "failed" | "capped" | null {
  if (run?.scope !== "mau" || run.phase !== "finished") return null;
  if (cappedRun(run)) return "capped";
  return run.cases.every((c) => c.graded?.passed === true) ? "passed" : "failed";
}

const NOT_YOUR_FAULT = new Set(["skipped_budget", "llm_error", "timeout"]);
/**
 * Cases that did not finish for the server's reasons (AI overloaded, daily quota, deadline).
 * The replay cache keeps only answers that came back, so the same graph calls these again.
 */
export const unfinished = (run: RunView) =>
  run.cases.filter((c) => c.graded && NOT_YOUR_FAULT.has(c.graded.status));

/** Where the bench stands against the run on show: none, edited since, running, or over. */
export type BenchRun = "none" | "stale" | "active" | "done";
/** N6 block states: chưa chạy, cần chạy lại, đang chờ, đang chạy, đạt, lỗi. */
export type BlockState = "idle" | "stale" | "queued" | "running" | "passed" | "error";

/**
 * State of one slot for the followed case. Ingestion blocks (corpus, chunker) are compiled into
 * the index and never send steps: they are ready once run.started lists the index.
 * `failedAnswer`: the answer board of a counted case that failed (every step can be "ok").
 */
export function blockState(
  bench: BenchRun,
  step: StepView | undefined,
  { started, ingest, failedAnswer }: { started: boolean; ingest: boolean; failedAnswer: boolean },
): BlockState {
  if (bench === "none") return "idle";
  if (bench === "stale") return "stale";
  if (ingest) return started ? "passed" : bench === "active" ? "queued" : "idle";
  if (step?.state === "running") return "running";
  if (step) return step.status === "ok" && !failedAnswer ? "passed" : "error";
  return bench === "active" ? "queued" : "idle";
}
