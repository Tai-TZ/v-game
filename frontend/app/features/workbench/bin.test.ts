import { describe, expect, it } from "vitest";

import { binFill } from "./bin";

const pack = (docs: number, query: number, budget: number) => ({
  docs,
  query,
  total: docs + query,
  budget,
});

describe("binFill", () => {
  it("splits the bin into what the documents take and what the question takes", () => {
    const fill = binFill(pack(600, 400, 2000));
    expect(fill.docsPct).toBeCloseTo(30, 1);
    expect(fill.queryPct).toBeCloseTo(20, 1);
    expect(fill.overflow).toBe(false);
  });

  it("will not let the lid close when the pack is over budget", () => {
    const fill = binFill(pack(2500, 100, 2000));
    expect(fill.overflow).toBe(true);
    // The bands still describe real proportions of the budget, so the overflow is visible as
    // something sticking out rather than as a bar quietly pinned at 100 %.
    expect(fill.docsPct + fill.queryPct).toBeGreaterThan(100);
  });

  it("treats a zero budget as full rather than dividing by it", () => {
    const fill = binFill(pack(10, 0, 0));
    expect(Number.isFinite(fill.docsPct)).toBe(true);
    expect(fill.overflow).toBe(true);
  });

  it("is empty when nothing was packed, and the lid closes", () => {
    const fill = binFill(pack(0, 0, 3000));
    expect(fill.docsPct).toBe(0);
    expect(fill.overflow).toBe(false);
  });
});
