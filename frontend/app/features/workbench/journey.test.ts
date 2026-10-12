import { describe, expect, it } from "vitest";

import { rankJourney } from "./journey";

/** Node ids in the order the graph runs them, as nodeIds(level) gives them. */
const ORDER = ["vs", "bm", "fu", "rr"];

describe("rankJourney", () => {
  it("follows the answer passage's rank through every block that ranked it", () => {
    const steps = rankJourney({ vs: 23, bm: 1, fu: 2, rr: 1 }, ORDER);
    expect(steps.map((s) => [s.node, s.rank])).toEqual([
      ["vs", 23],
      ["bm", 1],
      ["fu", 2],
      ["rr", 1],
    ]);
  });

  it("keeps the blocks in the order the graph runs them, not the object's", () => {
    const steps = rankJourney({ rr: 1, vs: 23 }, ORDER);
    expect(steps.map((s) => s.node)).toEqual(["vs", "rr"]);
  });

  it("marks a block that never found the passage, rather than dropping it", () => {
    // null is the engine's "absent from this block's ranking" (GoldReveal.ranks).
    const steps = rankJourney({ vs: null, rr: 1 }, ORDER);
    expect(steps.map((s) => [s.node, s.rank])).toEqual([
      ["vs", null],
      ["rr", 1],
    ]);
  });

  // Both search blocks rank the whole store, so a hop between them is one ruler (§8.6).
  const STORE = { vs: { kind: "corpus" }, bm: { kind: "corpus" } } as const;

  it("says which way each hop moved, so the picture can show a rise or a fall", () => {
    const steps = rankJourney({ vs: 23, bm: 1 }, ORDER, STORE);
    expect(steps.map((s) => s.move)).toEqual(["start", "up"]);
    expect(rankJourney({ vs: 1, bm: 9 }, ORDER, STORE).map((s) => s.move)).toEqual([
      "start",
      "down",
    ]);
    expect(rankJourney({ vs: 4, bm: 4 }, ORDER, STORE).map((s) => s.move)).toEqual([
      "start",
      "same",
    ]);
  });

  it("calls a hop out of nowhere a rise and a hop into nowhere a fall", () => {
    expect(rankJourney({ vs: null, bm: 2 }, ORDER, STORE).map((s) => s.move)).toEqual([
      "start",
      "up",
    ]);
    expect(rankJourney({ vs: 2, bm: null }, ORDER, STORE).map((s) => s.move)).toEqual([
      "start",
      "down",
    ]);
  });

  it("has nothing to draw for a graph with no ranked block", () => {
    expect(rankJourney({}, ORDER)).toEqual([]);
  });
});

describe("ranks taken over different populations", () => {
  const corpus = { kind: "corpus" } as const;
  const kept = (size: number | null) => ({ kind: "kept", size }) as const;

  it("will not call a scale change a rise", () => {
    // The L3 story: hạng 23 over the whole corpus, then hạng 2 inside the 3 passages Kính lúp
    // kept. The passage did get better off, but 23 and 2 are not two points on one ruler, and
    // workbench-v0.1.md:486 requires the text to say which is which.
    const steps = rankJourney({ vs: 23, rr: 2 }, ["vs", "rr"], { vs: corpus, rr: kept(3) });
    expect(steps.map((s) => s.move)).toEqual(["start", "rescaled"]);
  });

  it("still compares two blocks that ranked the whole corpus", () => {
    const steps = rankJourney({ vs: 23, bm: 4 }, ["vs", "bm"], { vs: corpus, bm: corpus });
    expect(steps.map((s) => s.move)).toEqual(["start", "up"]);
  });

  it("compares two kept sets only when they kept the same number", () => {
    const same = rankJourney({ fu: 3, rr: 1 }, ["fu", "rr"], { fu: kept(5), rr: kept(5) });
    expect(same.map((s) => s.move)).toEqual(["start", "up"]);
    const other = rankJourney({ fu: 3, rr: 1 }, ["fu", "rr"], { fu: kept(5), rr: kept(3) });
    expect(other.map((s) => s.move)).toEqual(["start", "rescaled"]);
  });

  it("treats an unknown kept size as its own scale rather than guessing", () => {
    const steps = rankJourney({ fu: 3, rr: 1 }, ["fu", "rr"], { fu: kept(null), rr: kept(null) });
    expect(steps.map((s) => s.move)).toEqual(["start", "rescaled"]);
  });
});
