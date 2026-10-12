import { describe, expect, it } from "vitest";

import { citationLedger, packerSaw } from "./ledger";
import type { StepView } from "./run";

const item = (chunkId: string, rank: number) => ({
  chunk_id: chunkId,
  rank,
  score: 1 - rank / 100,
  doc_id: "quy-che",
  dieu: 10 + rank,
  khoan: [1],
  hieu_luc: true,
});

describe("citationLedger", () => {
  it("lines the three rows up on one id, so a missing code reads as a gap", () => {
    const l = citationLedger([item("a1", 1), item("b2", 2)], ["a1"], ["a1", "zz"]);
    expect(l.rows).toEqual([
      { id: "a1", rank: 1, inBin: true, cited: true, ghost: false },
      { id: "b2", rank: 2, inBin: false, cited: false, ghost: false },
      { id: "zz", rank: null, inBin: false, cited: true, ghost: true },
    ]);
  });

  it("counts codes, not sentences: how many were cited, held, invented", () => {
    const l = citationLedger([item("a1", 1), item("b2", 2)], ["a1"], ["a1", "zz"]);
    expect(l.counts).toEqual({ cited: 2, inBin: 1, ghost: 1 });
  });

  it("gives a fabricated code its own row rather than dropping it", () => {
    // The whole lesson of L1: a code the bin never held must be visible, not filtered away.
    const l = citationLedger([item("a1", 1)], ["a1"], ["zz", "yy"]);
    expect(l.rows.map((r) => r.id)).toEqual(["a1", "zz", "yy"]);
    expect(l.rows.filter((r) => r.ghost).map((r) => r.id)).toEqual(["zz", "yy"]);
  });

  it("keeps a packed code the ranked list never named", () => {
    // The packer can be fed by Phễu or Kính lúp, whose own retrieved fact belongs to a node
    // whose list is not the one on row 1.
    const l = citationLedger([item("a1", 1)], ["a1", "c3"], []);
    expect(l.rows.map((r) => [r.id, r.rank, r.inBin])).toEqual([
      ["a1", 1, true],
      ["c3", null, true],
    ]);
  });

  it("orders the ranked row by rank, not by the order the fact listed them", () => {
    const l = citationLedger([item("b2", 2), item("a1", 1)], [], []);
    expect(l.rows.map((r) => r.id)).toEqual(["a1", "b2"]);
  });

  it("calls a code in the bin no ghost, even when it was cited", () => {
    const l = citationLedger([item("a1", 1)], ["a1"], ["a1"]);
    expect(l.rows[0]?.ghost).toBe(false);
    expect(l.counts).toEqual({ cited: 1, inBin: 1, ghost: 0 });
  });

  it("counts one code once however many times the answer cited it", () => {
    const l = citationLedger([item("a1", 1)], ["a1"], ["a1", "a1"]);
    expect(l.rows).toHaveLength(1);
    expect(l.counts.cited).toBe(1);
  });

  it("has nothing to show when the case cited nothing and pulled nothing", () => {
    expect(citationLedger([], [], []).rows).toEqual([]);
  });
});

describe("packerSaw", () => {
  const step = (block: string, ids: string[]): StepView =>
    ({
      block,
      state: "done",
      status: "ok",
      facts: [{ kind: "retrieved", items: ids.map((id, i) => item(id, i + 1)) }],
    }) as unknown as StepView;

  it("takes the last ranked list, which is the one the packer was handed", () => {
    // L3 runs vs, then Kính lúp re-ranks what reached it; the bin was filled from the second.
    const steps = { vs: step("vector_search", ["a1", "b2"]), rr: step("rerank", ["b2"]) };
    expect(packerSaw(steps).map((i) => i.chunk_id)).toEqual(["b2"]);
  });

  it("has no list when no block in the case ranked anything", () => {
    expect(packerSaw({})).toEqual([]);
  });
});
