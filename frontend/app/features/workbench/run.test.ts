import { describe, expect, it } from "vitest";

import { frameAction, isActive, llmCalls, runningNodes, runReducer } from "./run";
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
