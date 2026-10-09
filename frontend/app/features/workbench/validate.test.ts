import { describe, expect, it } from "vitest";

import {
  benchFromGraph,
  graphFromBench,
  setAttached,
  setParam,
  starterBench,
  type Bench,
  type Env,
} from "./bench";
import { LEVEL_IDS, levelFile, testEnv } from "./test-fixtures";
import { fixFor, validateGraph } from "./validate";

// Messages are verbatim from backend engine/validator.py; checked against the real validator
// (workbench-v0.1 §11.4 step 3).
const l3 = testEnv("article-number-lookup");
const base = (): Bench => {
  const bench = starterBench(l3);
  if (!bench) throw new Error("L3 starter is not drawable");
  return bench; // vs top_k 3; bm, fu, rr detached
};
const issues = (env: Env, bench: Bench) =>
  validateGraph(env, graphFromBench(env, bench)).map(
    ({ code, severity, node, port, message_vi }) => ({ code, severity, node, port, message_vi }),
  );

describe("validateGraph", () => {
  it("fusion with one list: G02 on the fusion docs port", () => {
    expect(issues(l3, setAttached(base(), "fusion", true))).toEqual([
      {
        code: "G02",
        severity: "error",
        node: "fu",
        port: "docs",
        message_vi: "*Hợp nhất kết quả* gộp từ 2 đến 3 danh sách, đang có 1.",
      },
    ]);
  });

  it("alpha fusion with one list: G02 then G06, both on fusion", () => {
    const bench = setParam(l3, setAttached(base(), "fusion", true), "fusion", "method", "alpha");
    expect(issues(l3, bench).map((issue) => [issue.code, issue.node, issue.port])).toEqual([
      ["G02", "fu", "docs"],
      ["G06", "fu", "docs"],
    ]);
    expect(issues(l3, bench)[1]?.message_vi).toBe(
      "Gộp theo alpha cần đúng một danh sách *Tìm theo nghĩa* và một danh sách *Tìm từ khóa*.",
    );
  });

  it("rerank fed by two lists without fusion: G02, plus a no-op note for the list of 3", () => {
    let bench = setAttached(base(), "bm25_search", true);
    bench = setAttached(bench, "rerank", true);
    expect(issues(l3, bench)).toEqual([
      {
        code: "G02",
        severity: "error",
        node: "rr",
        port: "docs",
        message_vi: "Cổng Tài liệu của *Xếp hạng lại* chỉ nhận một cạnh.",
      },
      {
        code: "W_RERANK_NOOP",
        severity: "info",
        node: "rr",
        port: null,
        message_vi: "Xếp hạng lại giữ 3/3 đoạn nên không đổi thứ tự, nhưng vẫn tốn thời gian.",
      },
    ]);
  });

  it("rerank or fusion with nothing plugged in: G05", () => {
    const empty = setAttached(base(), "vector_search", false);
    expect(issues(l3, setAttached(empty, "rerank", true))).toEqual([
      {
        code: "G05",
        severity: "error",
        node: "rr",
        port: "docs",
        message_vi: "*Xếp hạng lại* chưa có gì cắm vào cổng Tài liệu.",
      },
    ]);
    expect(issues(l3, setAttached(empty, "fusion", true))[0]).toMatchObject({
      code: "G05",
      node: "fu",
      port: "docs",
      message_vi: "*Hợp nhất kết quả* chưa có gì cắm vào cổng Tài liệu.",
    });
  });

  it("rerank keeping more than its source fetched: G06 without a port", () => {
    const bench = setParam(l3, setAttached(base(), "rerank", true), "rerank", "top_n", 5);
    expect(issues(l3, bench)).toEqual([
      {
        code: "G06",
        severity: "error",
        node: "rr",
        port: null,
        message_vi: "top_n của *Xếp hạng lại* là 5 nhưng phía trước chỉ lấy 3 đoạn.",
      },
    ]);
  });

  it("rerank keeping exactly what its source fetched: one info, no error", () => {
    const found = issues(l3, setAttached(base(), "rerank", true));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "W_RERANK_NOOP", severity: "info", node: "rr" });
  });

  it("gives the no-op magnifier a next step: fetch wider first, else keep fewer", () => {
    const fix = (bench: Bench) => {
      const graph = graphFromBench(l3, bench);
      return validateGraph(l3, graph).map((issue) => fixFor(l3, graph, issue));
    };
    const lens = setAttached(base(), "rerank", true);
    expect(fix(lens)).toEqual([
      {
        hint: "Tăng Móc kéo của Vòm Sao (tối đa 5) để Kính lúp có đoạn để chọn.",
        slot: "vector_search",
        param: "top_k",
      },
    ]);
    // Móc kéo already at its limit: the magnifier itself keeps fewer.
    const wide = setParam(
      l3,
      setParam(l3, lens, "vector_search", "top_k", 5),
      "rerank",
      "top_n",
      5,
    );
    expect(fix(wide)).toEqual([
      {
        hint: "Giảm Số đoạn giữ lại của Kính lúp để nó chỉ giữ đoạn tốt nhất.",
        slot: "rerank",
        param: "top_n",
      },
    ]);
  });

  it("alpha fusion of one dense and one keyword list is valid", () => {
    let bench = setAttached(base(), "bm25_search", true);
    bench = setParam(l3, setAttached(bench, "fusion", true), "fusion", "method", "alpha");
    expect(issues(l3, bench)).toEqual([]);
  });

  it("adds a next step to each bench error, aimed at the control that fixes it", () => {
    const fixes = (bench: Bench) => {
      const graph = graphFromBench(l3, bench);
      return validateGraph(l3, graph).map((issue) => fixFor(l3, graph, issue));
    };
    // Funnel with one list: attach the missing drawer (or detach the funnel).
    expect(fixes(setAttached(base(), "fusion", true))).toEqual([
      { hint: "Gắn thêm Tủ ngăn kéo hoặc tháo Phễu.", slot: "bm25_search" },
    ]);
    // Two lists straight into the magnifier: attach the funnel.
    let bench = setAttached(setAttached(base(), "bm25_search", true), "rerank", true);
    expect(fixes(bench)).toEqual([
      { hint: "Gắn Phễu để gộp hai danh sách, hoặc tháo một khe tìm.", slot: "fusion" },
      // The no-op note (info) gets a next step too: fetch wider first.
      {
        hint: "Tăng Móc kéo của Vòm Sao (tối đa 5) để Kính lúp có đoạn để chọn.",
        slot: "vector_search",
        param: "top_k",
      },
    ]);
    // Magnifier keeps more than was fetched: its own knob.
    bench = setParam(l3, setAttached(base(), "rerank", true), "rerank", "top_n", 5);
    expect(fixes(bench)).toEqual([
      {
        hint: "Giảm Số đoạn giữ lại của Kính lúp, hoặc tăng Móc kéo của Vòm Sao.",
        slot: "rerank",
        param: "top_n",
      },
    ]);
    // ... named after the block right in front of it: the funnel's own knob ...
    bench = setAttached(setAttached(base(), "bm25_search", true), "fusion", true);
    bench = setParam(l3, setAttached(bench, "rerank", true), "fusion", "top_k", 2);
    expect(fixes(setParam(l3, bench, "rerank", "top_n", 3))).toEqual([
      {
        hint: "Giảm Số đoạn giữ lại của Kính lúp, hoặc tăng Số đoạn giữ lại của Phễu.",
        slot: "rerank",
        param: "top_n",
      },
    ]);
    // ... or the drawer's hook when keyword search is the only list.
    bench = setAttached(setAttached(base(), "vector_search", false), "bm25_search", true);
    bench = setParam(l3, setAttached(bench, "rerank", true), "bm25_search", "top_k", 2);
    expect(fixes(setParam(l3, bench, "rerank", "top_n", 3))).toEqual([
      {
        hint: "Giảm Số đoạn giữ lại của Kính lúp, hoặc tăng Móc kéo ngăn của Tủ ngăn kéo.",
        slot: "rerank",
        param: "top_n",
      },
    ]);
    // Nothing plugged in: attach a search.
    expect(fixes(setAttached(setAttached(base(), "vector_search", false), "rerank", true))).toEqual(
      [{ hint: "Gắn Vòm Sao hoặc Tủ ngăn kéo.", slot: "vector_search" }],
    );
    // Seesaw with one list: G02 then G06, both with a way out.
    bench = setParam(l3, setAttached(base(), "fusion", true), "fusion", "method", "alpha");
    expect(fixes(bench)).toEqual([
      { hint: "Gắn thêm Tủ ngăn kéo hoặc tháo Bập bênh.", slot: "bm25_search" },
      {
        hint: "Gắn cả Vòm Sao lẫn Tủ ngăn kéo, hoặc đổi sang Phễu RRF.",
        slot: "fusion",
        param: "method",
      },
    ]);
  });

  for (const id of LEVEL_IDS) {
    it(`finds no issue in the ${id} reference and starter graphs`, () => {
      const env = testEnv(id);
      const reference = benchFromGraph(env, levelFile(id).reference_graph);
      const starter = starterBench(env);
      expect(reference && starter).toBeTruthy();
      if (reference) expect(issues(env, reference)).toEqual([]);
      if (starter) expect(issues(env, starter)).toEqual([]);
    });
  }
});
