import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BudgetMeter, runTokens } from "./BudgetMeter";
import type { CaseView } from "./run";
import { parseSse, readText, replay } from "./test-fixtures";

/** G4 (interactive-levels-v0.6 §4): the run's tokens against the star-2 budget, with its mark. */

afterEach(cleanup);

const meter = () => {
  const el = document.querySelector<SVGElement>("[data-budget-meter]");
  if (!el) throw new Error("no meter drawn");
  return el;
};
const x = (selector: string) => Number(meter().querySelector(selector)?.getAttribute("x"));
const width = (selector: string) => Number(meter().querySelector(selector)?.getAttribute("width"));

describe("BudgetMeter", () => {
  it("fills up to what was used and marks the budget where star 2 ends", () => {
    render(<BudgetMeter used={2900} budget={5800} />);
    // The scale runs past the budget, so the mark sits inside the bar and going over shows.
    const mark = x("[data-budget-mark]");
    expect(mark).toBeGreaterThan(0);
    expect(mark).toBeLessThan(100);
    expect(width("[data-budget-fill]")).toBeCloseTo(mark / 2, 5);
    expect(meter().dataset.over).toBe("false");
  });

  it("turns the fill to danger once the run passes the budget", () => {
    render(<BudgetMeter used={7000} budget={5800} />);
    expect(meter().dataset.over).toBe("true");
    expect(width("[data-budget-fill]")).toBeGreaterThan(x("[data-budget-mark]"));
    expect(meter().querySelector("[data-budget-fill]")?.getAttribute("class")).toContain(
      "fill-danger",
    );
  });

  it("stretches the scale for a run far over budget, never drawing past the end", () => {
    render(<BudgetMeter used={58000} budget={5800} />);
    expect(width("[data-budget-fill]")).toBeLessThanOrEqual(100);
    expect(x("[data-budget-mark]")).toBeCloseTo(10, 5);
  });

  it("says the numbers in words, for whoever cannot see the bar", () => {
    const { container } = render(<BudgetMeter used={2900} budget={5800} />);
    expect(container.textContent).toContain("2.900/5.800 token");
    expect(meter().getAttribute("aria-hidden")).toBe("true");
  });
});

describe("runTokens", () => {
  it("adds every case's tokens in and out", () => {
    const cases = [
      { tokens: { in: 100, out: 20 } },
      { tokens: { in: 0, out: 0 } },
      { tokens: { in: 300, out: 5 } },
    ] as CaseView[];
    expect(runTokens({ cases })).toBe(425);
  });

  it("matches the score of a real finished run", () => {
    const run = replay(parseSse(readText("e2e", "data", "run-w1-reference.sse")));
    if (!run?.score) throw new Error("the W1 reference run has no score");
    expect(runTokens(run)).toBe(run.score.tokens);
  });
});
