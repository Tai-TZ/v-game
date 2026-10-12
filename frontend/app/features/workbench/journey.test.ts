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

  it("says which way each hop moved, so the picture can show a rise or a fall", () => {
    const steps = rankJourney({ vs: 23, rr: 1 }, ORDER);
    expect(steps.map((s) => s.move)).toEqual(["start", "up"]);
    expect(rankJourney({ vs: 1, rr: 9 }, ORDER).map((s) => s.move)).toEqual(["start", "down"]);
    expect(rankJourney({ vs: 4, rr: 4 }, ORDER).map((s) => s.move)).toEqual(["start", "same"]);
  });

  it("calls a hop out of nowhere a rise and a hop into nowhere a fall", () => {
    expect(rankJourney({ vs: null, rr: 2 }, ORDER).map((s) => s.move)).toEqual(["start", "up"]);
    expect(rankJourney({ vs: 2, rr: null }, ORDER).map((s) => s.move)).toEqual(["start", "down"]);
  });

  it("has nothing to draw for a graph with no ranked block", () => {
    expect(rankJourney({}, ORDER)).toEqual([]);
  });
});
