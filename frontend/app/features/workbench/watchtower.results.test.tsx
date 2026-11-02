import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { graphFromBench, starterBench } from "./bench";
import { Results } from "./Results";
import type { RunView } from "./run";
import { frame, parseSse, readText, replay, testEnv } from "./test-fixtures";

/** The diagnosis of a W1 run points at the layer that can fix it (watchtower.md §3.6). */

afterEach(cleanup);

const env = testEnv("direct-injection");
const frames = parseSse(readText("e2e", "data", "run-w1-starter.sse"));
const finished = frames.findIndex((f) => f.event === "run.finished");

/** The starter run, finished with this diagnosis; the net's block on t04 is streamed first. */
function run(diagnosis: object[], blockedBy?: string): RunView {
  const net = blockedBy
    ? [
        frame(98, "step.finished", {
          case: "wt-w1-t04",
          node: "net",
          block: "pattern_guard",
          status: "ok",
          summary: "Lưới chặn.",
          tokens: { in: 0, out: 0 },
          ms: 0,
          facts: [{ kind: "guard", by: "pattern", decision: "block", matched: blockedBy }],
        }),
      ]
    : [];
  const view = replay([
    ...frames.slice(0, finished),
    ...net,
    frame(99, "run.finished", { report: { gold: {}, diagnosis }, models: {} }),
  ]);
  if (!view) throw new Error("no run");
  return view;
}

function show(view: RunView, onFocusSlot = vi.fn()) {
  const bench = starterBench(env);
  if (!bench) throw new Error("the W1 starter is not drawable");
  const graph = graphFromBench(env, bench);
  render(
    <MemoryRouter>
      <Results
        env={env}
        run={view}
        changed={false}
        runGraph={graph}
        graph={graph}
        backTo="/play/watchtower"
        slip={null}
        history={[]}
        onDebrief={() => undefined}
        onDuplicate={() => undefined}
        onEdit={() => undefined}
        onFocusSlot={onFocusSlot}
      />
    </MemoryRouter>,
  );
  return onFocusSlot;
}

describe("the W1 diagnosis", () => {
  it("opens the very phrase that stopped a real customer", () => {
    const focus = show(
      run(
        [{ case: "wt-w1-t04", flag: "guard.blocked_benign", message_vi: "Câu #12 bị chặn." }],
        "bỏ qua",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xem cụm «bỏ qua»" }));
    expect(focus).toHaveBeenCalledWith("pattern_guard", "phrases", "bỏ qua");
  });

  it("opens the net's tray without a phrase when the net did not stop the customer", () => {
    const focus = show(
      run([{ case: "wt-w1-t04", flag: "guard.blocked_benign", message_vi: "Câu #12 bị chặn." }]),
    );
    fireEvent.click(screen.getByRole("button", { name: /Lưới cụm từ/ }));
    expect(focus).toHaveBeenCalledWith("pattern_guard", "phrases", null);
  });

  it("offers to attach the bell to a refund nobody approved", () => {
    const focus = show(
      run([{ case: "wt-w1-t01", flag: "ledger.refund_wrong", message_vi: "Câu #9 hoàn sai." }]),
    );
    fireEvent.click(screen.getByRole("button", { name: /Chuông duyệt/ }));
    expect(focus).toHaveBeenCalledWith("human_approval", "policy", null);
  });
});
