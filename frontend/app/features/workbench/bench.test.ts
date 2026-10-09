import { describe, expect, it } from "vitest";

import {
  benchFromGraph,
  domain,
  fillDefaults,
  graphFromBench,
  roundToStep,
  setAttached,
  setCard,
  setParam,
  starterBench,
  type Bench,
  type Env,
} from "./bench";
import { LEVEL_COPY } from "./copy";
import type { Graph } from "./schema";
import { LEVEL_IDS, levelFile, testEnv } from "./test-fixtures";

const starter = (env: Env): Bench => {
  const bench = starterBench(env);
  if (!bench) throw new Error(`starter of ${env.level.id} is not drawable`);
  return bench;
};
const filled = (env: Env, graph: Graph) => fillDefaults(env.blocks, graph);

describe("bench <-> graph", () => {
  for (const id of LEVEL_IDS) {
    it(`reproduces the starter and reference graphs of ${id} in exact node and edge order`, () => {
      const env = testEnv(id);
      expect(filled(env, graphFromBench(env, starter(env)))).toEqual(
        filled(env, env.level.starter_graph),
      );
      const reference = levelFile(id).reference_graph;
      const bench = benchFromGraph(env, reference);
      expect(bench).not.toBeNull();
      if (bench) expect(filled(env, graphFromBench(env, bench))).toEqual(filled(env, reference));
    });
  }

  it("builds the L1 reference solution from slot actions", () => {
    const env = testEnv("grounded-citation");
    let bench = setAttached(starter(env), "vector_search", true);
    bench = setParam(env, bench, "vector_search", "top_k", 3);
    bench = setParam(env, bench, "context_packer", "cite_ids", true);
    bench = setCard(setCard(setCard(bench, 0, "G1"), 1, "G2"), 2, "G3");
    expect(filled(env, graphFromBench(env, bench))).toEqual(
      filled(env, levelFile("grounded-citation").reference_graph),
    );
  });

  it("builds the L3 reference solution from slot actions", () => {
    const env = testEnv("article-number-lookup");
    let bench = starter(env);
    for (const slot of ["bm25_search", "fusion", "rerank"] as const) {
      bench = setAttached(bench, slot, true);
    }
    bench = setParam(env, bench, "vector_search", "top_k", 5);
    bench = setParam(env, bench, "chunker", "only_in_force", false);
    expect(filled(env, graphFromBench(env, bench))).toEqual(
      filled(env, levelFile("article-number-lookup").reference_graph),
    );
  });

  it("keeps a detached slot's values for when it is attached again", () => {
    const env = testEnv("chunk-tuning");
    let bench = setParam(env, starter(env), "vector_search", "top_k", 7);
    bench = setAttached(bench, "vector_search", false);
    expect(graphFromBench(env, bench).nodes.map((node) => node.id)).not.toContain("vs");
    bench = setAttached(bench, "vector_search", true);
    const vs = graphFromBench(env, bench).nodes.find((node) => node.id === "vs");
    expect(vs?.params.top_k).toBe(7);
  });

  it("rejects graphs the bench cannot draw", () => {
    const env = testEnv("grounded-citation");
    const reference = levelFile("grounded-citation").reference_graph;
    const edit = (change: (graph: Graph) => void): Graph => {
      const graph = structuredClone(reference);
      change(graph);
      return graph;
    };
    const vs = (graph: Graph) => graph.nodes.find((node) => node.id === "vs");
    // A value outside the level's domain.
    expect(
      benchFromGraph(
        env,
        edit((graph) => {
          const node = vs(graph);
          if (node) node.params = { top_k: 11 };
        }),
      ),
    ).toBeNull();
    // Two nodes of one type.
    expect(
      benchFromGraph(
        env,
        edit((graph) => {
          const node = vs(graph);
          if (node) graph.nodes.splice(4, 0, { ...node, id: "vs2" });
        }),
      ),
    ).toBeNull();
    // A prompt line that is not a card.
    expect(
      benchFromGraph(
        env,
        edit((graph) => {
          const llm = graph.nodes.find((node) => node.id === "llm");
          if (llm) llm.params = { ...llm.params, system_prompt: "Trả lời bằng tiếng Anh." };
        }),
      ),
    ).toBeNull();
    // A block this level has not opened.
    expect(
      benchFromGraph(
        env,
        edit((graph) => {
          graph.nodes.splice(4, 0, { id: "bm", type: "bm25_search", params: {} });
        }),
      ),
    ).toBeNull();
    // Edges the bench would not produce.
    expect(
      benchFromGraph(
        env,
        edit((graph) => graph.edges.reverse()),
      ),
    ).toBeNull();
  });
});

describe("domain", () => {
  it("narrows each control by the block schema and the level limits", () => {
    const l1 = testEnv("grounded-citation");
    expect(domain(l1, "vector_search", "top_k")).toEqual({
      kind: "range",
      min: 1,
      max: 10,
      step: 1,
      integer: true,
    });
    // Falsy fixed values are real values.
    expect(domain(l1, "vector_search", "score_threshold")).toEqual({ kind: "fixed", value: 0 });
    expect(domain(l1, "chunker", "only_in_force")).toEqual({ kind: "fixed", value: false });
    expect(domain(l1, "context_packer", "cite_ids")).toEqual({ kind: "toggle" });

    const l2 = testEnv("chunk-tuning");
    expect(domain(l2, "vector_search", "score_threshold")).toMatchObject({
      kind: "range",
      min: 0,
      max: 0.9,
      step: 0.05,
    });
    expect(domain(l2, "chunker", "chunk_size")).toEqual({
      kind: "choice",
      options: [128, 256, 512, 1024],
    });
    // Fixed by the block schema itself, not only by a level limit.
    const schemaOnly = { ...l2, level: { ...l2.level, param_limits: {} } };
    expect(domain(schemaOnly, "context_packer", "on_overflow")).toEqual({
      kind: "fixed",
      value: "cat_duoi",
    });

    const l3 = testEnv("article-number-lookup");
    expect(domain(l3, "vector_search", "top_k")).toMatchObject({ min: 1, max: 5 });
    expect(domain(l3, "fusion", "alpha")).toMatchObject({
      kind: "range",
      min: 0,
      max: 1,
      step: 0.1,
    });
    expect(domain(l3, "rerank", "top_n")).toMatchObject({ min: 1, max: 5 });
  });

  it("rounds floats to the step", () => {
    expect(roundToStep(0.15000000000000002, 0.05)).toBe(0.15);
    expect(roundToStep(0.30000000000000004, 0.1)).toBe(0.3);
    expect(roundToStep(7, 1)).toBe(7);
  });
});

describe("LEVEL_COPY", () => {
  it("copies the star rules PublicLevel does not return from the level files", () => {
    for (const id of LEVEL_IDS) {
      const { rules } = levelFile(id);
      expect(LEVEL_COPY[id]?.s1Required).toEqual(rules.s1_required);
      expect(LEVEL_COPY[id]?.s3ForbiddenLabels).toEqual(rules.s3_forbidden_labels);
    }
  });
});
