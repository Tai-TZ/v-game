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
  score?: StarResult;
  report?: RunReport;
  models?: Readonly<Record<string, number>>;
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
    case "run.started":
      return {
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

const NOT_YOUR_FAULT = new Set(["skipped_budget", "llm_error", "timeout"]);
/**
 * Cases that did not finish for the server's reasons (AI overloaded, daily quota, deadline).
 * The replay cache keeps only answers that came back, so the same graph calls these again.
 */
export const unfinished = (run: RunView) =>
  run.cases.filter((c) => c.graded && NOT_YOUR_FAULT.has(c.graded.status));
