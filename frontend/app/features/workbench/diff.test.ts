import { describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setCard, setParam, starterBench, type Bench } from "./bench";
import { diffGraphs } from "./diff";
import { testEnv } from "./test-fixtures";

const l3 = testEnv("article-number-lookup");
const start = () => {
  const bench = starterBench(l3);
  if (!bench) throw new Error("L3 starter is not drawable");
  return bench;
};
const graph = (bench: Bench) => graphFromBench(l3, bench);

describe("diffGraphs", () => {
  it("finds nothing between a configuration and itself", () => {
    expect(diffGraphs(l3, graph(start()), graph(start()))).toEqual([]);
  });

  it("counts one knob as one change, and says which knob and which way", () => {
    const before = setAttached(start(), "vector_search", true);
    const after = setParam(l3, before, "vector_search", "top_k", 7);
    const changes = diffGraphs(l3, graph(before), graph(after));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      kind: "param",
      type: "vector_search",
      param: "top_k",
      from: 3,
      to: 7,
    });
  });

  it("counts attaching a block as one change of its own", () => {
    const changes = diffGraphs(l3, graph(start()), graph(setAttached(start(), "rerank", true)));
    expect(changes).toEqual([{ kind: "slot", type: "rerank" }]);
  });

  it("counts a knob and a block as two, which is what the honest label needs", () => {
    const before = setAttached(start(), "vector_search", true);
    const after = setParam(l3, setAttached(before, "rerank", true), "vector_search", "top_k", 7);
    expect(diffGraphs(l3, graph(before), graph(after))).toHaveLength(2);
  });

  it("sees a card swap as two slots, not as one prompt", () => {
    // graphFromBench joins the three cards into one llm.system_prompt string, so a plain param
    // compare reads swapping two cards as ONE change -- and the label would wrongly offer a
    // single cause.
    const keys = Object.keys(l3.level.prompt_cards);
    const [a, b] = [keys[0], keys[1]];
    if (a === undefined || b === undefined) throw new Error("L3 has fewer than two cards");
    const before = setCard(setCard(start(), 0, a), 1, b);
    const after = setCard(setCard(start(), 0, b), 1, a);
    const changes = diffGraphs(l3, graph(before), graph(after));
    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.kind === "card")).toBe(true);
  });

  it("counts swapping one card for another as one change of that slot", () => {
    // L3's starter fills all three slots (G1, G2, G3), so this is the common case.
    const changes = diffGraphs(l3, graph(start()), graph(setCard(start(), 0, "G4")));
    expect(changes).toEqual([{ kind: "card", slot: 0, from: "G1", to: "G4" }]);
  });

  it("counts clearing a card slot as one change, with nothing in its place", () => {
    const changes = diffGraphs(l3, graph(start()), graph(setCard(start(), 2, null)));
    expect(changes).toEqual([{ kind: "card", slot: 2, from: "G3", to: null }]);
  });

  it("ignores a difference that is only the order of the keys", () => {
    const g = graph(start());
    const reordered = {
      ...g,
      nodes: g.nodes.map((n) => ({ params: n.params, type: n.type, id: n.id })),
    };
    expect(diffGraphs(l3, g, reordered)).toEqual([]);
  });

  it("ignores a param written out in one graph and left to its default in the other", () => {
    const g = graph(setAttached(start(), "vector_search", true));
    const stripped = {
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === "vs"
          ? { ...n, params: Object.fromEntries(Object.entries(n.params).slice(0, 1)) }
          : n,
      ),
    };
    // Same configuration, written two ways: a phantom change here would make every rerun look
    // like a two-variable experiment.
    expect(diffGraphs(l3, g, stripped)).toEqual([]);
  });
});
