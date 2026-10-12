import { describe, expect, it } from "vitest";

import {
  blockState,
  cappedRun,
  caseModel,
  fallbackAnswers,
  frameAction,
  isActive,
  llmCalls,
  outTokenSpread,
  runningNodes,
  runReducer,
  type CaseView,
  type RunView,
  type StepView,
} from "./run";
import { parseEvent, type EventType } from "./schema";
import { frame, parseSse, readText, replay, RUN } from "./test-fixtures";

const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
const reference = parseSse(readText("e2e", "data", "run-l1-reference.sse"));

describe("runReducer", () => {
  it("builds the whole short L1 run: cases, steps, grades, stars, report", () => {
    const run = replay(short);
    expect(run?.phase).toBe("finished");
    expect(run?.stream).toBe("closed");
    expect(run?.cases.map((c) => [c.n, c.id, c.state])).toEqual([
      [1, "lib-l1-v01", "graded"],
      [2, "lib-l1-t01", "graded"],
    ]);
    expect(run?.cases[0]?.tokens).toEqual({ in: 1180, out: 150 });
    expect(run?.cases[0]?.answer).toContain("bảo lưu");
    expect(run?.cases[1]?.answer).toBeUndefined();
    expect(run?.score?.stars).toBe(1);
    expect(run?.report?.gold["lib-l1-v01"]?.in_pack).toBe(true);
    expect(run && llmCalls(run)).toEqual({ real: 1, replayed: 1 });
    expect(isActive(run ?? null)).toBe(false);
  });

  it("builds the real L1 reference run captured from the server", () => {
    const run = replay(reference);
    expect(run?.phase).toBe("finished");
    expect(run?.cases).toHaveLength(10);
    expect(run?.cases.every((c) => c.state === "graded")).toBe(true);
    expect(run?.score).toBeDefined();
    expect(run?.report?.diagnosis).toBeDefined();
    // Per-case tokens are the sum of that case's step.finished tokens.
    for (const c of run?.cases ?? []) {
      const sum = reference
        .filter((f) => f.event === "step.finished")
        .map((f) => JSON.parse(f.data) as { case: string; tokens: { in: number; out: number } })
        .filter((data) => data.case === c.id)
        .reduce((total, data) => total + data.tokens.in + data.tokens.out, 0);
      expect(c.tokens.in + c.tokens.out).toBe(sum);
    }
  });

  it("gives the same state after a reconnect and after a replay from the start", () => {
    const whole = replay(short);
    const cut = 9;
    const reconnected = replay(short.slice(cut), replay(short.slice(0, cut)));
    const replayedFromOne = replay(short, replay(short.slice(0, cut)));
    expect(reconnected).toEqual(whole);
    expect(replayedFromOne).toEqual(whole);
  });

  it("drops malformed payloads and events for unknown cases", () => {
    expect(parseEvent("step.finished", "{not json")).toBeNull();
    expect(parseEvent("case.graded", JSON.stringify({ case: "x" }))).toBeNull();
    const started = replay(short.slice(0, 1));
    const stray = replay(
      [frame(2, "step.started", { case: "nope", node: "q", block: "input" })],
      started,
    );
    expect(stray?.cases).toEqual(started?.cases);
    expect(stray?.lastSeq).toBe(2);
  });

  it("keeps graded cases when the run fails midway", () => {
    const graded = short.findIndex((f) => f.event === "case.graded");
    const run = replay([
      ...short.slice(0, graded + 1),
      frame(100, "run.failed", { code: "cancelled", message_vi: "Lượt chạy bị dừng giữa chừng." }),
    ]);
    expect(run?.phase).toBe("failed");
    expect(run?.failure?.code).toBe("cancelled");
    expect(run?.cases.filter((c) => c.state === "graded")).toHaveLength(1);
    expect(run?.score).toBeUndefined();
  });

  it("keeps the stars when run.failed follows run.scored", () => {
    const scored = short.findIndex((f) => f.event === "run.scored");
    const run = replay([
      ...short.slice(0, scored + 1),
      frame(100, "run.failed", { code: "internal", message_vi: "Máy chủ gặp lỗi." }),
    ]);
    expect(run?.phase).toBe("failed");
    expect(run?.score?.stars).toBe(1);
    expect(run?.report).toBeUndefined();
  });

  it("tracks parallel steps: bm still runs after vs finished", () => {
    const case3 = { case: "lib-l3-v01" };
    const run = replay([
      frame(1, "run.started", {
        cases: [{ id: "lib-l3-v01", role: "visible", vai: "tra-so", question: "Điều 47?" }],
        ingestion: [],
      }),
      frame(2, "step.started", { ...case3, node: "vs", block: "vector_search" }),
      frame(3, "step.started", { ...case3, node: "bm", block: "bm25_search" }),
      frame(4, "step.finished", {
        ...case3,
        node: "vs",
        block: "vector_search",
        status: "ok",
        summary: "Lấy 3 đoạn.",
        tokens: { in: 0, out: 0 },
        ms: 40,
        facts: [{ kind: "future-fact" }],
      }),
    ]);
    const c = run?.cases[0];
    expect(c && runningNodes(c)).toEqual(["bm"]);
    expect(c?.steps.vs?.facts).toEqual([]);
  });

  it("records a step that did not finish ok", () => {
    const run = replay([
      ...short.slice(0, 1),
      frame(2, "step.started", { case: "lib-l1-v01", node: "llm", block: "llm" }),
      frame(3, "step.finished", {
        case: "lib-l1-v01",
        node: "llm",
        block: "llm",
        status: "timeout",
        summary: "Hết giờ, bước này bị dừng.",
        tokens: { in: 0, out: 0 },
        ms: 20000,
        facts: [],
      }),
    ]);
    expect(run?.cases[0]?.steps.llm).toMatchObject({ state: "done", status: "timeout" });
  });

  it("follows stream states until the run closes", () => {
    let run = runReducer(null, { kind: "reset", runId: RUN });
    run = runReducer(run, { kind: "stream", state: "live" });
    expect(run?.stream).toBe("live");
    run = runReducer(run, { kind: "stream", state: "reconnecting" });
    expect(run?.stream).toBe("reconnecting");
    run = replay(short, run);
    run = runReducer(run, { kind: "stream", state: "lost" });
    expect(run?.stream).toBe("closed");
  });

  it("drops a lost run the player gives up on, so the next POST's error can show", () => {
    let run = runReducer(null, { kind: "reset", runId: RUN });
    run = runReducer(run, { kind: "stream", state: "lost" });
    expect(isActive(run)).toBe(true);
    expect(runReducer(run, { kind: "clear" })).toBeNull();
  });
});

describe("frameAction", () => {
  it("turns an SSE frame into a reducer action, and drops a malformed one", () => {
    const [first] = short;
    expect(first && frameAction(first.event as EventType, first.data, first.id)).toMatchObject({
      kind: "event",
      seq: first?.id,
      event: { type: "run.started" },
    });
    expect(frameAction("step.finished", "{not json", 5)).toBeNull();
  });

  it("fails the run when an ending event cannot be read, so the bench unlocks", () => {
    const scored = short.findIndex((f) => f.event === "run.scored");
    for (const type of ["run.scored", "run.finished", "run.failed"] as const) {
      const action = frameAction(type, JSON.stringify({ type, run: RUN }), 50);
      expect(action).toMatchObject({ kind: "event", seq: 50, event: { type: "run.failed" } });
      const run = action && runReducer(replay(short.slice(0, scored)), action);
      expect(run?.failure?.code).toBe("internal");
      expect(run?.stream).toBe("closed");
      expect(isActive(run ?? null)).toBe(false);
    }
  });
});

describe("blockState (N6)", () => {
  const ran: StepView = { block: "llm", state: "done", status: "ok", ms: 5 };
  const going: StepView = { block: "llm", state: "running" };
  const base = { started: true, ingest: false, failedAnswer: false };

  it("says 'not run' before any run and 'run again' once a knob changed", () => {
    expect(blockState("none", undefined, base)).toBe("idle");
    expect(blockState("none", ran, base)).toBe("idle");
    expect(blockState("stale", ran, base)).toBe("stale");
    expect(blockState("stale", undefined, { ...base, ingest: true })).toBe("stale");
  });

  it("follows a step: waiting, running, passed, error", () => {
    expect(blockState("active", undefined, base)).toBe("queued");
    expect(blockState("active", going, base)).toBe("running");
    expect(blockState("active", ran, base)).toBe("passed");
    expect(blockState("done", { ...ran, status: "timeout" }, base)).toBe("error");
    // The answer board of a failed case: the step finished, the answer is wrong.
    expect(blockState("done", ran, { ...base, failedAnswer: true })).toBe("error");
    // A finished run never reached this step (cancelled, or skipped by the server).
    expect(blockState("done", undefined, base)).toBe("idle");
  });

  it("reads ingestion blocks (corpus, chunker) from run.started: they have no step", () => {
    const ingest = { ...base, ingest: true };
    expect(blockState("active", undefined, { ...ingest, started: false })).toBe("queued");
    expect(blockState("active", undefined, ingest)).toBe("passed");
    expect(blockState("done", undefined, ingest)).toBe("passed");
    expect(blockState("done", undefined, { ...ingest, started: false })).toBe("idle");
  });
});

describe("caseModel", () => {
  const withLlm = (model: string, replayed: boolean): CaseView =>
    ({
      id: "c1",
      n: 1,
      role: "visible",
      vai: "sv",
      state: "graded",
      tokens: { in: 1, out: 1 },
      steps: {
        llm: {
          block: "llm",
          state: "done",
          status: "ok",
          facts: [
            {
              kind: "llm",
              stop_reason: "end",
              cited_ids: [],
              replayed,
              model,
              system_tokens: 1,
            },
          ],
        },
      },
    }) as unknown as CaseView;

  it("names the model that actually answered the case", () => {
    expect(caseModel(withLlm("gemini-3.1-flash-lite", false))).toEqual({
      model: "gemini-3.1-flash-lite",
      replayed: false,
    });
  });

  it("says when the answer came from the replay cache rather than a call", () => {
    // §8.6: a cached answer inside a real run is not a call this run made, and the two must not
    // read the same -- the fallback count depends on telling them apart.
    expect(caseModel(withLlm("gemini-3.5-flash-lite", true))?.replayed).toBe(true);
  });

  it("has no model for a case that never reached the model", () => {
    // A hidden case on a recorded run keeps only case.graded, and a skipped case has no llm fact.
    const bare = { ...withLlm("x", false), steps: {} };
    expect(caseModel(bare)).toBeNull();
  });
});

describe("fallbackAnswers", () => {
  const caseWith = (model: string | null, replayed = false) =>
    ({
      steps:
        model === null
          ? {}
          : {
              llm: {
                block: "llm",
                state: "done",
                status: "ok",
                facts: [
                  {
                    kind: "llm",
                    stop_reason: "end",
                    cited_ids: [],
                    replayed,
                    model,
                    system_tokens: 1,
                  },
                ],
              },
            },
    }) as unknown as CaseView;

  const run = (primaryModel: string | undefined, cases: CaseView[]) =>
    ({ cases, primaryModel }) as unknown as RunView;

  it("counts the cases a model other than the primary answered", () => {
    const r = run("gemini-3.5-flash-lite", [
      caseWith("gemini-3.5-flash-lite"),
      caseWith("gemini-3.1-flash-lite"),
      caseWith("gemini-3.1-flash-lite"),
    ]);
    expect(fallbackAnswers(r)).toEqual({ fallback: 2, answered: 3 });
  });

  it("counts a cached fallback answer too: the grade is read off that answer either way", () => {
    // engine-v0.2 §663 replays a fallback's old answer. It was not a call this run made -- the
    // "lời gọi AI" line says that -- but star 2 is still being judged on its token count.
    const r = run("gemini-3.5-flash-lite", [caseWith("gemini-3.1-flash-lite", true)]);
    expect(fallbackAnswers(r)).toEqual({ fallback: 1, answered: 1 });
  });

  it("leaves a case that got no answer out of both numbers", () => {
    // Otherwise a quota-exhausted run reads as "0/10 do model dự phòng", which measures the
    // denominator rather than the run.
    const r = run("m1", [caseWith("m1"), caseWith(null), caseWith(null)]);
    expect(fallbackAnswers(r)).toEqual({ fallback: 0, answered: 1 });
  });

  it("claims no fallback when the run never said which model is primary", () => {
    // A recorded run exported before the field existed: unknown, so assert nothing.
    const r = run(undefined, [caseWith("whatever")]);
    expect(fallbackAnswers(r)).toEqual({ fallback: 0, answered: 1 });
  });
});

describe("outTokenSpread", () => {
  const answered = (out: number): CaseView =>
    ({
      tokens: { in: 100, out },
      steps: {
        llm: {
          block: "llm",
          state: "done",
          status: "ok",
          facts: [
            {
              kind: "llm",
              stop_reason: "end",
              cited_ids: [],
              replayed: false,
              model: "m1",
              system_tokens: 1,
            },
          ],
        },
      },
    }) as unknown as CaseView;
  const skipped = () => ({ tokens: { in: 0, out: 0 }, steps: {} }) as unknown as CaseView;
  const run = (cases: CaseView[]) => ({ cases }) as unknown as RunView;

  it("reports the low and the high, because the spread is the point", () => {
    // frontend-architecture §8.4: the same L3 prompt answered in 74 and in 528 output tokens.
    // An average of 301 would hide exactly what the learner is meant to see.
    expect(outTokenSpread(run([answered(74), answered(300), answered(528)]))).toEqual({
      low: 74,
      high: 528,
      cases: 3,
    });
  });

  it("leaves a case that never reached the model out of the spread", () => {
    // Its zero is not a short answer; it is no answer, and it would drag the low to nothing.
    expect(outTokenSpread(run([answered(74), skipped(), skipped()]))).toEqual({
      low: 74,
      high: 74,
      cases: 1,
    });
  });

  it("has no spread to report when nothing answered", () => {
    expect(outTokenSpread(run([skipped()]))).toBeNull();
  });

  it("says low and high are the same for one case, so the copy can avoid a range of one", () => {
    const one = outTokenSpread(run([answered(420)]));
    expect(one?.low).toBe(one?.high);
  });
});

describe("a run the daily cap cut short", () => {
  const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
  /** Rewrite the nth case.graded frame into the shape the engine sends when the cap is hit. */
  const capAt = (n: number) => {
    let seen = 0;
    return short.map((f) => {
      if (f.event !== "case.graded") return f;
      seen += 1;
      if (seen !== n) return f;
      const data = JSON.parse(f.data) as Record<string, unknown>;
      return {
        ...f,
        data: JSON.stringify({ ...data, status: "skipped_budget", reason: "daily_cap" }),
      };
    });
  };

  it("keeps the reason the engine gave, which the client dropped on the floor", () => {
    const run = replay(capAt(2));
    expect(run?.cases[1]?.graded?.reason).toBe("daily_cap");
    expect(run?.cases[0]?.graded?.reason).toBeUndefined();
  });

  it("knows the run was cut short by the server's quota, not by the player's budget", () => {
    // §3.3: a case skipped by the player's own per-case budget is an ordinary failure; only a
    // case the DAILY cap skipped exempts the run from overwriting the stars.
    expect(cappedRun(replay(capAt(2)))).toBe(true);
    const ownBudget = short.map((f) => {
      if (f.event !== "case.graded") return f;
      const data = JSON.parse(f.data) as Record<string, unknown>;
      return { ...f, data: JSON.stringify({ ...data, status: "skipped_budget" }) };
    });
    expect(cappedRun(replay(ownBudget))).toBe(false);
    expect(cappedRun(replay(short))).toBe(false);
  });
});
