import { describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setCard, setParam, starterBench, type Bench } from "./bench";
import { changeName } from "./copy";
import { diffGraphs, nextPickOptions } from "./diff";
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

describe("nextPickOptions", () => {
  it("offers to attach a block that is not on the bench, and nothing else about it", () => {
    const options = nextPickOptions(l3, graph(start()));
    const rerank = options.filter((o) => o.pick.type === "rerank");
    expect(rerank).toEqual([{ label: "Gắn Kính lúp", pick: { type: "rerank", direction: "on" } }]);
  });

  it("offers to detach an attached block, plus up/down on its own numeric knobs", () => {
    const options = nextPickOptions(l3, graph(setAttached(start(), "vector_search", true)));
    const vs = options.filter((o) => o.pick.type === "vector_search");
    expect(vs.map((o) => o.pick.direction)).toEqual(expect.arrayContaining(["off", "up", "down"]));
    expect(vs.some((o) => o.pick.param === "top_k" && o.pick.direction === "down")).toBe(true);
  });

  it("offers nothing for a block the level locked, even one whose knobs are not individually fixed", () => {
    // In every shipped level a locked node's params also happen to be fixed one by one via
    // param_limits, so the node-level lock alone is never exercised by real content -- nothing
    // stops a future level from locking a node without fixing every param. Locking
    // vector_search's own node id, with its param_limits left untouched, isolates that guard.
    const locked = {
      ...l3,
      level: { ...l3.level, locked_nodes: [...l3.level.locked_nodes, "vs"] },
    };
    const options = nextPickOptions(locked, graph(setAttached(start(), "vector_search", true)));
    expect(options.some((o) => o.pick.type === "vector_search")).toBe(false);
  });

  it("offers to fill an empty Lăng kính slot, and to clear a filled one", () => {
    const options = nextPickOptions(l3, graph(setCard(start(), 2, null)));
    const slot2 = options.filter((o) => o.pick.slot === 2);
    expect(slot2).toEqual([
      {
        label: "Thêm Lăng kính (khe 3)",
        pick: { type: "llm", param: "system_prompt", slot: 2, direction: "add" },
      },
    ]);
    const slot0 = options.filter((o) => o.pick.slot === 0);
    expect(slot0[0]?.pick.direction).toBe("remove");
  });

  it("offers no two options with the same label", () => {
    const options = nextPickOptions(l3, graph(setAttached(start(), "vector_search", true)));
    const labels = options.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("the W1 net's phrases", () => {
  const w1 = testEnv("direct-injection");
  const netted = (...phrases: string[]) => {
    const bench = starterBench(w1);
    if (!bench) throw new Error("the W1 starter is not drawable");
    const withNet = setAttached(bench, "pattern_guard", true);
    return { ...withNet, phrases: w1.level.phrase_tray.filter((p) => phrases.includes(p)) };
  };
  const g = (bench: Bench) => graphFromBench(w1, bench);

  it("counts one phrase added as exactly one change, naming the phrase", () => {
    const changes = diffGraphs(
      w1,
      g(netted("quản trị viên")),
      g(netted("quản trị viên", "bỏ qua")),
    );
    expect(changes).toEqual([{ kind: "phrase", phrase: "bỏ qua", on: true }]);
  });

  it("counts two phrases added as two changes, so the label cannot name one cause", () => {
    const changes = diffGraphs(w1, g(netted()), g(netted("bỏ qua", "quản trị viên")));
    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.kind === "phrase" && c.on)).toBe(true);
  });

  it("counts a phrase swapped for another as two: one out, one in", () => {
    const changes = diffGraphs(w1, g(netted("bỏ qua")), g(netted("bỏ qua hướng dẫn")));
    expect(changes).toEqual([
      { kind: "phrase", phrase: "bỏ qua", on: false },
      { kind: "phrase", phrase: "bỏ qua hướng dẫn", on: true },
    ]);
  });

  it("finds nothing between the same net written in another order", () => {
    const before = g(netted("bỏ qua", "quản trị viên"));
    const after = structuredClone(before);
    const net = after.nodes.find((n) => n.type === "pattern_guard");
    if (!net || !Array.isArray(net.params.phrases)) throw new Error("no net");
    net.params.phrases = [...net.params.phrases].reverse();
    expect(diffGraphs(w1, before, after)).toEqual([]);
  });

  it("counts attaching a net with phrases as one change, the net itself", () => {
    const bench = starterBench(w1);
    if (!bench) throw new Error("the W1 starter is not drawable");
    expect(diffGraphs(w1, g(bench), g(netted("bỏ qua", "quản trị viên")))).toEqual([
      { kind: "slot", type: "pattern_guard" },
    ]);
  });

  it("offers adding one phrase and removing one phrase as next picks, each one change", () => {
    const labels = (bench: Bench) =>
      nextPickOptions(w1, g(bench))
        .filter((o) => o.pick.type === "pattern_guard" && o.pick.param === "phrases")
        .map((o) => [o.label, o.pick.direction]);
    expect(labels(netted("bỏ qua"))).toEqual([
      ["Thêm một cụm vào Lưới cụm từ", "add"],
      ["Rút một cụm khỏi Lưới cụm từ", "remove"],
    ]);
    // An empty net has nothing to pull out.
    expect(labels(netted())).toEqual([["Thêm một cụm vào Lưới cụm từ", "add"]]);
    // A full net has nothing left to add.
    expect(labels(netted(...w1.level.phrase_tray))).toEqual([
      ["Rút một cụm khỏi Lưới cụm từ", "remove"],
    ]);
  });

  it("names the phrase and the way it went, for the comparison card", () => {
    expect(changeName({ kind: "phrase", phrase: "bỏ qua", on: true })).toBe(
      "Thêm cụm «bỏ qua» ở Lưới cụm từ",
    );
    expect(changeName({ kind: "phrase", phrase: "admin", on: false })).toBe(
      "Rút cụm «admin» ở Lưới cụm từ",
    );
  });
});
