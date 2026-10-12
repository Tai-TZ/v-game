import { describe, expect, it } from "vitest";

import { binFill, droppedRanks } from "./bin";

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

describe("the part that will not fit", () => {
  it("measures how far past the rim the pack goes", () => {
    // 3.600 of 3.000 is a fifth more than the bin holds, and that fifth is what the lid
    // cannot close over.
    expect(binFill(pack(3500, 100, 3000)).overPct).toBeCloseTo(20, 6);
  });

  it("has nothing over the rim when the pack exactly fills the bin", () => {
    const fill = binFill(pack(2900, 100, 3000));
    expect(fill.overPct).toBe(0);
    expect(fill.overflow).toBe(false);
  });

  it("does not clamp the overspill at the rim", () => {
    // Four times the budget stands three bins past the rim. Clamping at 100 would make every
    // size of mistake past double the budget read the same.
    expect(binFill(pack(12000, 0, 3000)).overPct).toBeCloseTo(300, 6);
    expect(binFill(pack(6000, 0, 3000)).overPct).toBeCloseTo(100, 6);
  });

  it("treats a zero budget as full to the rim with nothing measurable past it", () => {
    expect(binFill(pack(10, 0, 0)).overPct).toBe(0);
  });
});

describe("droppedRanks", () => {
  const item = (chunkId: string, rank: number) => ({
    chunk_id: chunkId,
    rank,
    score: 1 - rank / 100,
    doc_id: "quy-che",
    dieu: rank,
    khoan: [1],
    hieu_luc: true,
  });
  const ranked = [item("a1", 1), item("d4", 4), item("d5", 5), item("d6", 6), item("d7", 7)];

  it("gives each cut passage the rank it had in the list the packer was handed", () => {
    // pack.dropped is ids in cut order and carries no rank: the rank is a join, the same one
    // the bin's own contents already need.
    expect(droppedRanks(["d4", "d5", "d6", "d7"], ranked).pieces).toEqual([
      { id: "d4", rank: 4 },
      { id: "d5", rank: 5 },
      { id: "d6", rank: 6 },
      { id: "d7", rank: 7 },
    ]);
  });

  it("reports the span of the ranks that were cut", () => {
    expect(droppedRanks(["d4", "d5", "d6", "d7"], ranked).range).toEqual([4, 7]);
  });

  it("keeps cut order, which is not rank order", () => {
    // on_overflow cuts from the tail, but a fused list can hand them over in another order.
    expect(droppedRanks(["d6", "d4"], ranked).pieces.map((p) => p.id)).toEqual(["d6", "d4"]);
    expect(droppedRanks(["d6", "d4"], ranked).range).toEqual([4, 6]);
  });

  it("says nothing about the rank of a passage that list never named", () => {
    const { pieces, range } = droppedRanks(["zz"], ranked);
    expect(pieces).toEqual([{ id: "zz", rank: null }]);
    expect(range).toBeNull();
  });

  it("spans only the ranks it knows, when some are unknown", () => {
    expect(droppedRanks(["d5", "zz"], ranked).range).toEqual([5, 5]);
  });

  it("has nothing to say when nothing was cut", () => {
    expect(droppedRanks([], ranked)).toEqual({ pieces: [], range: null });
  });
});
