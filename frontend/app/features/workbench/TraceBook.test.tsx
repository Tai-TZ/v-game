import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { graphFromBench, starterBench } from "./bench";
import type { RunView } from "./run";
import { frame, parseSse, readText, replay, testEnv } from "./test-fixtures";
import { TraceBook, traceOptions, traceRows } from "./TraceBook";

afterEach(cleanup);

const env = testEnv("direct-injection");
const frames = parseSse(readText("e2e", "data", "run-w1-starter.sse"));
const finished = frames.findIndex((f) => f.event === "run.finished");
const bench = starterBench(env);
if (!bench) throw new Error("starter is not drawable");
const graph = graphFromBench(env, bench);

/** The starter run, as recorded: t01-t03 fail, all on the approval bell, t02 also on the dog. */
const starter = (() => {
  const view = replay(frames);
  if (!view) throw new Error("no run");
  return view;
})();

function withDiagnosis(diagnosis: object[]): RunView {
  const view = replay([
    ...frames.slice(0, finished),
    frame(99, "run.finished", { report: { gold: {}, diagnosis }, models: {} }),
  ]);
  if (!view) throw new Error("no run");
  return view;
}

describe("traceRows", () => {
  it("takes the three failed cases and every slot the diagnosis blames for each", () => {
    const rows = traceRows(env, starter, {}, graph);
    expect(rows.map((row) => [row.c.id, [...row.right].sort()])).toEqual([
      ["wt-w1-t01", ["human_approval"]],
      ["wt-w1-t02", ["human_approval", "injection_classifier"]],
      ["wt-w1-t03", ["human_approval"]],
    ]);
  });

  it("asks nothing with fewer than three cases to trace: one or two can be found by trying", () => {
    const two = withDiagnosis([
      { flag: "hitl.bypassed", case: "wt-w1-t01", message_vi: "a" },
      { flag: "hitl.bypassed", case: "wt-w1-t02", message_vi: "a" },
    ]);
    expect(traceRows(env, two, {}, graph)).toEqual([]);
  });

  it("leaves out a case the diagnosis names no slot for", () => {
    const unknown = withDiagnosis([
      { flag: "hitl.bypassed", case: "wt-w1-t01", message_vi: "a" },
      { flag: "hitl.bypassed", case: "wt-w1-t02", message_vi: "a" },
      { flag: "not.a.flag", case: "wt-w1-t03", message_vi: "a" },
    ]);
    expect(traceRows(env, unknown, {}, graph)).toEqual([]);
  });

  it("prefers a fourth failure with its own lesson over a third copy of the first one", () => {
    // t04 (#12) passed in the recording; fail it here, blamed on the net.
    const failedT04 = frames.slice(0, finished).map((f) => {
      const data = JSON.parse(f.data) as { case?: string };
      return f.event === "case.graded" && data.case === "wt-w1-t04"
        ? { ...f, data: JSON.stringify({ ...data, passed: false }) }
        : f;
    });
    const view = replay([
      ...failedT04,
      frame(99, "run.finished", {
        report: {
          gold: {},
          diagnosis: ["wt-w1-t01", "wt-w1-t02", "wt-w1-t03"]
            .map((id) => ({ flag: "hitl.bypassed", case: id, message_vi: "a" }))
            .concat([{ flag: "guard.blocked_benign", case: "wt-w1-t04", message_vi: "b" }]),
        },
        models: {},
      }),
    ]);
    if (!view) throw new Error("no run");
    expect(traceRows(env, view, {}, graph).map((row) => row.c.id)).toEqual([
      "wt-w1-t01",
      "wt-w1-t02",
      "wt-w1-t04",
    ]);
  });

  it("asks nothing of the three-sample run, which is not a star run", () => {
    expect(traceRows(env, { ...starter, scope: "mau" }, {}, graph)).toEqual([]);
  });

  it("waits for the diagnosis: no report, no answer to check against", () => {
    const scored = replay(frames.slice(0, finished));
    if (!scored) throw new Error("no run");
    expect(traceRows(env, scored, {}, graph)).toEqual([]);
  });
});

describe("traceOptions", () => {
  it("offers the level's slots that have something to turn, and nothing else", () => {
    const options = traceOptions(env);
    expect(options).toContain("human_approval");
    expect(options).toContain("injection_classifier");
    expect(options).toContain("pattern_guard");
    expect(options).not.toContain("input");
    expect(options).not.toContain("output");
  });
});

describe("TraceBook", () => {
  const rows = traceRows(env, starter, {}, graph);
  // Row i of the book, by its label: t01-t03 are cases #9-#11, not #1-#3.
  const label = (i: number) => new RegExp(`^Câu #${rows[i - 1]?.c.n ?? 0} `);
  const pick = (i: number, value: string) =>
    fireEvent.change(screen.getByLabelText(label(i)), { target: { value } });
  const check = () => fireEvent.click(screen.getByRole("button", { name: "Kiểm tra sổ" }));
  const verdict = () => document.querySelector("[data-trace-verdict]");

  it("says only whether all three are right, never which row is wrong", () => {
    const onSolved = vi.fn();
    render(<TraceBook env={env} rows={rows} onSolved={onSolved} onSkip={() => undefined} />);
    expect(document.querySelectorAll("[data-trace-row]")).toHaveLength(3);
    pick(1, "human_approval");
    pick(2, "injection_classifier");
    pick(3, "pattern_guard");
    check();
    expect(verdict()?.getAttribute("data-trace-verdict")).toBe("wrong");
    // No row is marked: a per-row mark would let the player find each answer by elimination.
    expect(document.querySelector("[data-trace-row][data-right]")).toBeNull();
    expect(onSolved).not.toHaveBeenCalled();

    pick(3, "human_approval");
    check();
    expect(verdict()?.getAttribute("data-trace-verdict")).toBe("right");
    expect(onSolved).toHaveBeenCalledWith(2);
    // Solved: the book is closed, nothing more to change.
    expect(screen.getByLabelText<HTMLSelectElement>(label(1)).disabled).toBe(true);
  });

  it("counts no check until every row has a pick", () => {
    const onSolved = vi.fn();
    render(<TraceBook env={env} rows={rows} onSolved={onSolved} onSkip={() => undefined} />);
    pick(1, "human_approval");
    check();
    expect(verdict()?.getAttribute("data-trace-verdict")).toBe("incomplete");
    pick(2, "human_approval");
    pick(3, "human_approval");
    check();
    expect(onSolved).toHaveBeenCalledWith(1);
  });

  it("lets the player go straight to the diagnosis", () => {
    const onSkip = vi.fn();
    render(<TraceBook env={env} rows={rows} onSolved={() => undefined} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua, xem chẩn đoán" }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
