import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Calibration, calibration } from "./calibration";
import type { RunMark } from "./storage";

/** Plan v0.7 2.4: how often each level of sureness was right, across the remembered runs. */

afterEach(cleanup);

const mark = (bets?: RunMark["bets"]): RunMark => ({
  body: "{}",
  at: 1,
  stars: 0,
  tokens: 0,
  budget: 0,
  cases: [],
  ...(bets && { bets }),
});

describe("calibration", () => {
  it("adds up the bets of every run by how sure the player was, surest last", () => {
    const rows = calibration([
      mark([
        { confidence: "high", right: true },
        { confidence: "low", right: false },
      ]),
      mark([
        { confidence: "high", right: false },
        { confidence: "high", right: true },
      ]),
      mark(), // a run from before bets were kept
    ]);
    expect(rows).toEqual([
      { confidence: "low", right: 0, total: 1 },
      { confidence: "high", right: 2, total: 3 },
    ]);
  });

  it("has nothing to show without a single bet", () => {
    expect(calibration([mark(), mark([])])).toEqual([]);
  });
});

describe("Calibration", () => {
  it("says, per level of sureness, how many calls were right, and draws the share", () => {
    render(
      <Calibration
        runs={[
          mark([
            { confidence: "high", right: true },
            { confidence: "high", right: true },
            { confidence: "high", right: false },
            { confidence: "medium", right: true },
          ]),
        ]}
      />,
    );
    const rows = [...document.querySelectorAll<HTMLElement>("[data-confidence]")];
    expect(rows.map((r) => [r.dataset.confidence, r.dataset.right, r.dataset.total])).toEqual([
      ["medium", "1", "1"],
      ["high", "2", "3"],
    ]);
    expect(rows[1]?.textContent).toContain("Chắc: đúng 2/3 lần");
    const fill = rows[1]?.querySelector("[data-share]");
    expect(Number(fill?.getAttribute("width"))).toBeCloseTo(200 / 3, 5);
  });

  it("draws nothing before the first bet", () => {
    const { container } = render(<Calibration runs={[mark()]} />);
    expect(container.innerHTML).toBe("");
  });
});
