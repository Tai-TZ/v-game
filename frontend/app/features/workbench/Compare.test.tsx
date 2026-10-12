import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setCard, setParam, starterBench, type Bench } from "./bench";
import { Compare } from "./Compare";
import type { RunMark } from "./storage";
import { testEnv } from "./test-fixtures";

afterEach(cleanup);

const l3 = testEnv("article-number-lookup");
const start = () => {
  const bench = starterBench(l3);
  if (!bench) throw new Error("L3 starter is not drawable");
  return bench;
};
const body = (bench: Bench) => JSON.stringify(graphFromBench(l3, bench));
const run = (b: string, cases: [number, boolean][]): RunMark => ({
  body: b,
  at: 1,
  stars: 1,
  tokens: 10,
  budget: 20,
  cases: cases.map(([n, passed]) => ({ n, role: "visible" as const, passed })),
});

describe("Compare", () => {
  it("names the one variable as a plausible cause, and lists what flipped", () => {
    const before = setAttached(start(), "vector_search", true);
    const after = setParam(l3, before, "vector_search", "top_k", 7);
    render(
      <Compare
        env={l3}
        prev={run(body(before), [
          [1, true],
          [2, false],
        ])}
        now={run(body(after), [
          [1, true],
          [2, true],
        ])}
      />,
    );
    // The one change may be offered as the cause.
    expect(screen.getByText(/Móc kéo là thứ duy nhất đổi/)).toBeDefined();
    expect(screen.getByText(/Câu #2: Trượt → Đạt/)).toBeDefined();
    // The required multi-variable sentence must not appear here.
    expect(screen.queryByText(/chưa biết thứ nào gây ra/)).toBeNull();
  });

  it("names no cause when two or more variables moved, in the required wording", () => {
    const before = setAttached(start(), "vector_search", true);
    const after = setParam(l3, setAttached(before, "rerank", true), "vector_search", "top_k", 7);
    render(<Compare env={l3} prev={run(body(before), [])} now={run(body(after), [])} />);
    expect(screen.getByText("Đổi 2 thứ cùng lúc, chưa biết thứ nào gây ra")).toBeDefined();
    // No single variable is singled out as the cause.
    expect(screen.queryByText(/là thứ duy nhất đổi/)).toBeNull();
  });

  it("says the configurations are the same when nothing changed", () => {
    const b = body(start());
    render(<Compare env={l3} prev={run(b, [])} now={run(b, [])} />);
    expect(screen.getByText(/cùng một cấu hình/)).toBeDefined();
    expect(screen.queryByText(/chưa biết thứ nào gây ra/)).toBeNull();
  });

  it("sees a card swap as two changes, not one", () => {
    const before = body(setCard(setCard(start(), 0, "G1"), 1, "G2"));
    const after = body(setCard(setCard(start(), 0, "G2"), 1, "G1"));
    render(<Compare env={l3} prev={run(before, [])} now={run(after, [])} />);
    expect(screen.getByText("Đổi 2 thứ cùng lúc, chưa biết thứ nào gây ra")).toBeDefined();
  });

  it("draws nothing when a body can no longer be read on this level", () => {
    const { container } = render(
      <Compare env={l3} prev={run("{broken", [])} now={run(body(start()), [])} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("carries no aria-live region of its own", () => {
    const b = body(start());
    const { container } = render(<Compare env={l3} prev={run(b, [])} now={run(b, [])} />);
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(0);
  });
});
