import { describe, expect, it } from "vitest";

import { graphFromBench, setAttached, starterBench, type Bench, type Env } from "./bench";
import {
  diagnosisTarget,
  flagWords,
  groupDiagnosis,
  liveMessage,
  lowerFirst,
  sameGraphNote,
} from "./copy";
import type { Graph } from "./schema";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";

const l1 = testEnv("grounded-citation");
const l3 = testEnv("article-number-lookup");
function graphOf(env: Env, edit: (bench: Bench) => Bench = (bench) => bench): Graph {
  const bench = starterBench(env);
  if (!bench) throw new Error("starter is not drawable");
  return graphFromBench(env, edit(bench));
}
/** Target of a one-case lesson whose gold reveal has these ranks by node id. */
const target = (
  env: Env,
  graph: Graph,
  flag: string,
  ranks?: Record<string, number | null>,
  message_vi = "",
) =>
  diagnosisTarget(
    env,
    { flag, message_vi, cases: ["c1"] },
    ranks && { c1: { gold_chunks: ["x"], ranks, in_pack: false, flags: [] } },
    graph,
  );

describe("diagnosis copy", () => {
  it("groups one lesson per flag, keeping the first message and every case", () => {
    const stale = "Có 3 câu mang giấy 2019 vào thùng. Bản đó hết hiệu lực, dù chữ nghĩa giống hệt.";
    const groups = groupDiagnosis([
      { case: "c1", flag: "ret.gold_missing", message_vi: "Câu #1 cần một đoạn trong Điều 5." },
      { case: "c4", flag: "ret.stale_doc", message_vi: stale },
      { case: "c2", flag: "ret.gold_missing", message_vi: "Câu #2 cần một đoạn trong Điều 9." },
      { case: "c5", flag: "ret.stale_doc", message_vi: stale },
      { case: null, flag: "budget.exceeded", message_vi: "Run này tốn 16.000 token." },
    ]);
    expect(groups).toEqual([
      {
        flag: "ret.gold_missing",
        message_vi: "Câu #1 cần một đoạn trong Điều 5.",
        cases: ["c1", "c2"],
      },
      { flag: "ret.stale_doc", message_vi: stale, cases: ["c4", "c5"] },
      { flag: "budget.exceeded", message_vi: "Run này tốn 16.000 token.", cases: [] },
    ]);
  });

  it("points each flag at the knob that fixes it, and a regression at the flag it names", () => {
    const graph = graphOf(l1);
    expect(target(l1, graph, "ret.stale_doc")).toEqual({ slot: "chunker", param: "only_in_force" });
    expect(target(l1, graph, "ret.boundary_split")?.param).toBe("strategy");
    expect(target(l1, graph, "llm.cite_missing")?.param).toBe("cite_ids");
    expect(target(l1, graph, "trap.failed")).toEqual({ slot: "llm", param: "system_prompt" });
    expect(target(l1, graph, "something.new")).toBeNull();
    // L1 has one search: its hook, whatever the rank (and with no gold reveal yet).
    const dense = graphOf(l1, (b) => setAttached(b, "vector_search", true));
    const hook = { slot: "vector_search", param: "top_k" };
    expect(target(l1, dense, "ret.gold_rank:vector_search", { vs: 4 })).toEqual(hook);
    expect(target(l1, dense, "ret.gold_rank:vector_search")).toEqual(hook);
  });

  it("sends a search-rank lesson to the other search when one hook cannot reach it (L3)", () => {
    const keyword = { slot: "bm25_search", param: "top_k" };
    const dense = { slot: "vector_search", param: "top_k" };
    // Starter: dense only, gold at rank 9 while Móc kéo stops at 5 -> attach the drawer.
    const starter = graphOf(l3);
    expect(target(l3, starter, "ret.gold_rank:vector_search", { vs: 9 })).toEqual(keyword);
    // The regression line ("Ai đó tháo Tủ ngăn kéo") names the same flag.
    const regression =
      "Ca của Hà trượt: ret.gold_rank:vector_search. Lần đổi này làm vỡ thứ đã chạy được.";
    expect(target(l3, starter, "regression", { vs: 2 }, regression)).toEqual(keyword);
    // Keyword only, rank 15: keep the dense search.
    const bmOnly = graphOf(l3, (b) =>
      setAttached(setAttached(b, "vector_search", false), "bm25_search", true),
    );
    expect(target(l3, bmOnly, "ret.gold_rank:bm25_search", { bm: 15 })).toEqual(dense);
    // Both attached: the hook only when the rank is inside its range, else the other hook.
    const both = graphOf(l3, (b) => setAttached(b, "bm25_search", true));
    expect(target(l3, both, "ret.gold_rank:vector_search", { vs: 4, bm: 12 })).toEqual(dense);
    expect(target(l3, both, "ret.gold_rank:vector_search", { vs: 9, bm: 10 })).toEqual(keyword);
    // Neither hook reaches: say so, and point at the knob still open (the chunker, in L3).
    expect(target(l3, both, "ret.gold_rank:vector_search", { vs: 9, bm: 14 })).toEqual({
      slot: "chunker",
      param: "strategy",
      why: "Không móc nào với tới đoạn đáp án: Vòm Sao hạng 9 (Móc kéo tối đa 5), Tủ ngăn kéo hạng 14 (Móc kéo ngăn tối đa 10). Thử đổi cách chia ở Lược dao.",
    });
    expect(target(l3, both, "ret.gold_rank:vector_search", { vs: null, bm: null })).toEqual({
      slot: "chunker",
      param: "strategy",
      why: "Không móc nào với tới đoạn đáp án: Vòm Sao không tìm thấy, Tủ ngăn kéo không tìm thấy. Thử đổi cách chia ở Lược dao.",
    });
    // L1 fixes the chunker: nothing left to turn, so no button.
    const l1Dense = graphOf(l1, (b) => setAttached(b, "vector_search", true));
    expect(target(l1, l1Dense, "ret.gold_rank:vector_search", { vs: 12 })).toBeNull();
  });

  it("sends a funnel-rank lesson to the stage that cut the passage", () => {
    const funnel = { slot: "fusion", param: "top_k" };
    const lens = { slot: "rerank", param: "top_n" };
    const lensOnly = graphOf(l3, (b) => setAttached(b, "rerank", true));
    expect(target(l3, lensOnly, "ret.gold_rank:fusion", { vs: 2, rr: null })).toEqual(lens);
    const fused = (b: Bench) => setAttached(setAttached(b, "bm25_search", true), "fusion", true);
    expect(target(l3, graphOf(l3, fused), "ret.gold_rank:fusion", { fu: null })).toEqual(funnel);
    const full = graphOf(l3, (b) => setAttached(fused(b), "rerank", true));
    expect(target(l3, full, "ret.gold_rank:fusion", { fu: null, rr: null })).toEqual(funnel);
    expect(target(l3, full, "ret.gold_rank:fusion", { fu: 4, rr: null })).toEqual(lens);
  });

  it("sends a full box to the knob that sets how many passages go in", () => {
    // L3: the magnifier (its switch while detached, its knob once attached).
    const lens = { slot: "rerank", param: "top_n" };
    expect(target(l3, graphOf(l3), "budget.exceeded")).toEqual(lens);
    expect(target(l3, graphOf(l3), "ctx.gold_dropped", { vs: 2 })).toEqual(lens);
    // L1 and L2 have no magnifier: Móc kéo.
    const dense = graphOf(l1, (b) => setAttached(b, "vector_search", true));
    expect(target(l1, dense, "budget.exceeded")).toEqual({ slot: "vector_search", param: "top_k" });
    const l2 = testEnv("chunk-tuning");
    expect(target(l2, graphOf(l2), "ctx.gold_dropped")).toEqual({
      slot: "vector_search",
      param: "top_k",
    });
    expect(target(l1, graphOf(l1), "budget.exceeded")).toBeNull();
  });

  it("turns flag keys the server left in a message into words, and leaves unknown ones", () => {
    expect(
      flagWords(
        "Ca của Hà trượt: ret.gold_rank:vector_search. Lần đổi này làm vỡ thứ đã chạy được.",
      ),
    ).toBe(
      "Ca của Hà trượt: đoạn đáp án đứng ngoài số đoạn lấy về. Lần đổi này làm vỡ thứ đã chạy được.",
    );
    expect(flagWords("Câu #4 chưa đạt (llm.cite_unknown).")).toBe(
      "Câu #4 chưa đạt (trích nguồn không có trong thùng).",
    );
    expect(flagWords("Câu #4 chưa đạt (ret.something_new).")).toBe(
      "Câu #4 chưa đạt (ret.something_new).",
    );
  });

  it("tells a rerun of the same graph what it will change", () => {
    const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
    const same =
      "Cấu hình này giống hệt lượt vừa rồi nên kết quả sẽ giống hệt. Đổi một món rồi mở ca để thấy khác biệt.";
    const run = replay(short);
    expect(run && sameGraphNote(run)).toBe(same);
    // An AI call that failed is not cached: the same graph calls it again.
    const graded = short.findIndex((f) => f.event === "case.graded");
    const failed = short.map((f, index) =>
      index === graded
        ? { ...f, data: f.data.replace('"status":"ok"', '"status":"llm_error"') }
        : f,
    );
    expect(failed[graded]?.data).toContain('"llm_error"');
    const retry = replay(failed);
    expect(retry && sameGraphNote(retry)).toBe(
      "Mở ca lại sau ít phút: các câu đã chạy xong dùng kết quả đã lưu, chỉ câu chưa chạy xong gọi AI lại.",
    );
  });

  it("announces a correct 'không có' as passed, with no fault after it", () => {
    const frames = parseSse(readText("e2e", "data", "run-l1-reference.sse"));
    const run = replay(
      frames.slice(
        0,
        frames.findIndex((f) => f.event === "run.scored"),
      ),
    );
    const t01 = run?.cases.find((c) => c.id === "lib-l1-t01");
    expect(t01?.graded?.labels).toContain("cite_missing");
    expect(liveMessage(run ?? null, "lib-l1-t01")).toBe(`Câu ${t01?.n}: Đạt.`);
  });

  it("lowers the first letter, but not an acronym", () => {
    expect(lowerFirst("Không trích nguồn")).toBe("không trích nguồn");
    expect(lowerFirst("AI từ chối trả lời")).toBe("AI từ chối trả lời");
  });
});
