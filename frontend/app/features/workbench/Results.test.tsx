import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setParam, starterBench, type Bench } from "./bench";
import { Results } from "./Results";
import type { RunView } from "./run";
import type { GoldReveal, Graph } from "./schema";
import { frame, parseSse, readText, replay, testEnv } from "./test-fixtures";

const l1 = testEnv("grounded-citation");
const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
const finished = short.findIndex((f) => f.event === "run.finished");

function graphOf(edit: (bench: Bench) => Bench = (bench) => bench): Graph {
  const bench = starterBench(l1);
  if (!bench) throw new Error("starter is not drawable");
  return graphFromBench(l1, edit(bench));
}
const dense = graphOf((b) =>
  setParam(l1, setAttached(b, "vector_search", true), "vector_search", "top_k", 3),
);

/** The short L1 run, finished with this gold reveal and diagnosis. */
function finishedRun(gold: Record<string, GoldReveal>, diagnosis: object[] = []): RunView {
  const run = replay([
    ...short.slice(0, finished),
    frame(99, "run.finished", { report: { gold, diagnosis }, models: {} }),
  ]);
  if (!run) throw new Error("no run");
  return run;
}

function show(run: RunView, graph: Graph = dense, env = l1) {
  render(
    <MemoryRouter>
      <Results
        env={env}
        run={run}
        changed={false}
        runGraph={dense}
        graph={graph}
        backTo="/play/library"
        onEdit={() => undefined}
        onFocusSlot={() => undefined}
      />
    </MemoryRouter>,
  );
}
const card = (n: number) => document.getElementById(`cau-${n}`)?.textContent ?? "";

const NO_ANSWER = "Quy chế không có đoạn nào trả lời câu này";
const trap: GoldReveal = { gold_chunks: [], ranks: {}, in_pack: false, flags: [] };

afterEach(cleanup);

describe("Results", () => {
  it("traces a split answer through each block instead of calling it a question with no answer", () => {
    // L2 starter (co_dinh/128/0) on lib-l2-v02: no chunk holds the answer sentence whole, so
    // gold_chunks is empty, but the pieces are ranked and the case is flagged.
    const split: GoldReveal = {
      gold_chunks: [],
      ranks: { vs: 2 },
      in_pack: false,
      flags: ["ret.boundary_split"],
    };
    show(finishedRun({ "lib-l1-v01": split, "lib-l1-t01": trap }));
    expect(card(1)).not.toContain(NO_ANSWER);
    expect(card(1)).not.toContain("không vào thùng");
    expect(card(1)).toContain("Không đoạn nào của cách chia này chứa trọn câu đáp án.");
    expect(card(1)).toContain("Vòm Sao: hạng 2 trên toàn kho, Móc kéo lấy 3, tối đa 10");
    expect(card(1)).toContain("Đoạn đáp án bị cắt đôi khi chia");
    // A trap that asks for something the regulation does not have.
    expect(card(2)).toContain(NO_ANSWER);
  });

  it("keeps the usual trace for an answer passage that some chunk holds", () => {
    const whole: GoldReveal = { gold_chunks: ["a1"], ranks: { vs: 4 }, in_pack: false, flags: [] };
    show(finishedRun({ "lib-l1-v01": whole, "lib-l1-t01": trap }));
    expect(card(1)).toContain("Đoạn đáp án: không vào thùng.");
    expect(card(1)).toContain("Vòm Sao: hạng 4 trên toàn kho, Móc kéo lấy 3, tối đa 10");
  });

  it("says when only part of a two-passage answer reached the box", () => {
    // L2 #8 "Gộp nhiều khoản": khoản 1 is in the box, khoản 3 stopped at rank 5 (grading.py:
    // in_pack is any(), each rank the best passage's).
    const partial: GoldReveal = {
      gold_chunks: ["k1", "k3"],
      ranks: { vs: 1 },
      in_pack: true,
      flags: ["ret.gold_missing", "ret.gold_rank"],
    };
    show(finishedRun({ "lib-l1-v01": partial, "lib-l1-t01": trap }));
    expect(card(1)).not.toContain("đã vào thùng");
    expect(card(1)).toContain("Đoạn đáp án: mới vào thùng một phần, còn thiếu đoạn khác.");
    expect(card(1)).toContain("Hạng của đoạn đáp án đứng cao nhất qua từng khối:");
  });

  it("says a search did not find the answer passage, not that the corpus lacks it", () => {
    const unfound: GoldReveal = {
      gold_chunks: ["a1"],
      ranks: { vs: null },
      in_pack: false,
      flags: [],
    };
    show(finishedRun({ "lib-l1-v01": unfound, "lib-l1-t01": trap }));
    expect(card(1)).toContain("Vòm Sao: không tìm thấy đoạn đáp án, Móc kéo lấy 3, tối đa 10");
    expect(card(1)).not.toContain("không có trong toàn kho");
  });

  it("names the knob a lesson opens when its slot has several", () => {
    const l2 = testEnv("chunk-tuning");
    const lessons = [
      { case: "lib-l1-v01", flag: "ret.boundary_split", message_vi: "Câu #1 bị cắt đôi." },
      { case: "lib-l1-v01", flag: "ret.stale_doc", message_vi: "Thùng có giấy 2019." },
    ];
    show(finishedRun({ "lib-l1-v01": trap, "lib-l1-t01": trap }, lessons), dense, l2);
    expect(screen.getByRole("button", { name: "Xem ở Nam châm bám Điều" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Xem ở Kính lọc hiệu lực" })).toBeDefined();
  });

  it("shows no missing-citation chip on a trap answered with a correct 'không có'", () => {
    const run = replay(parseSse(readText("e2e", "data", "run-l1-reference.sse")));
    if (!run) throw new Error("no run");
    const t01 = run.cases.find((c) => c.id === "lib-l1-t01");
    expect(t01?.graded?.passed).toBe(true);
    expect(t01?.graded?.labels).toContain("cite_missing");
    show(run);
    expect(card(t01?.n ?? 0)).toContain('Đã nói "không có"');
    expect(card(t01?.n ?? 0)).not.toContain("Không trích nguồn");
  });

  it("says the move when the lesson's slot is detached on the bench", () => {
    const lesson = {
      case: "lib-l1-v01",
      flag: "ret.gold_missing",
      message_vi: "Câu #1 cần một đoạn trong Điều 5.",
    };
    const run = finishedRun({ "lib-l1-v01": trap, "lib-l1-t01": trap }, [lesson]);
    show(run, graphOf());
    expect(screen.getByRole("button", { name: "Thử gắn Vòm Sao" })).toBeDefined();
    cleanup();
    show(run, dense);
    expect(screen.getByRole("button", { name: "Xem ở Vòm Sao" })).toBeDefined();
  });

  it("says where the diagnosis went when the run failed after its stars", () => {
    const run = replay([
      ...short.slice(0, finished),
      frame(99, "run.failed", { code: "internal", message_vi: "Máy chủ gặp lỗi." }),
    ]);
    if (!run) throw new Error("no run");
    show(run);
    expect(screen.getByText("1/3 sao")).toBeDefined();
    expect(
      screen.getByText(
        "Máy chủ đã chấm sao nhưng phần chẩn đoán chưa tới được. Chạy lại cùng cấu hình để xem: các câu đã chạy xong dùng kết quả đã lưu.",
      ),
    ).toBeDefined();
  });
});
