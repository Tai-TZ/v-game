import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setParam, starterBench, type Bench } from "./bench";
import { Results } from "./Results";
import type { RunView } from "./run";
import type { RunMark } from "./storage";
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

function show(
  run: RunView,
  graph: Graph = dense,
  env = l1,
  runGraph: Graph = dense,
  history: RunMark[] = [],
) {
  render(
    <MemoryRouter>
      <Results
        env={env}
        run={run}
        changed={false}
        runGraph={runGraph}
        graph={graph}
        backTo="/play/library"
        slip={null}
        history={history}
        onDuplicate={() => undefined}
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
    // The trap is a secret case, so its gold verdict is not drawn at all (§3.7).
    expect(card(2)).not.toContain(NO_ANSWER);
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

describe("gold stays on the sample cases", () => {
  // What a live run measures for a secret case: ranked pieces, a packed verdict, flags. The
  // server redacts this (runs.py), so reaching the card at all means the gate upstream broke.
  const secret: GoldReveal = {
    gold_chunks: ["k1", "k3"],
    ranks: { vs: 7 },
    in_pack: false,
    flags: ["ret.gold_missing", "ret.gold_rank"],
  };

  it("draws no trace, no rank and no flag for a hidden or trap case", () => {
    const whole: GoldReveal = { gold_chunks: ["a1"], ranks: { vs: 4 }, in_pack: true, flags: [] };
    show(finishedRun({ "lib-l1-v01": whole, "lib-l1-t01": secret }));

    // The sample still teaches: its own rank is drawn.
    expect(card(1)).toContain("Vòm Sao: hạng 4 trên toàn kho");
    // The trap card keeps its title and grade and loses every measurement.
    expect(card(2)).toContain("Câu bẫy");
    expect(card(2)).not.toContain("hạng 7");
    expect(card(2)).not.toContain("Đoạn đáp án");
    // "Vòm Sao" itself still appears: the step list shows what the player's own bench pulled,
    // which is their output, not where the answer sits.
    expect(card(2)).toContain("Vòm Sao · Xong");
    expect(card(2)).not.toContain(NO_ANSWER);
  });
});

describe("which model answered each case", () => {
  const model = (n: number) =>
    document.getElementById(`cau-${n}`)?.querySelector("[data-case-model]");

  it("names the model on every case that got an answer", () => {
    // The committed short L1 run: both cases answered by the primary.
    show(finishedRun({ "lib-l1-v01": trap, "lib-l1-t01": trap }));
    expect(model(1)?.getAttribute("data-case-model")).toBe("gemini-3.5-flash-lite");
    expect(model(1)?.textContent).toContain("Model");
  });

  it("marks a cached answer rather than passing it off as a call this run made", () => {
    const run = finishedRun({ "lib-l1-v01": trap });
    const cached = {
      ...run,
      cases: run.cases.map((c, i) =>
        i !== 0
          ? c
          : {
              ...c,
              steps: Object.fromEntries(
                Object.entries(c.steps).map(([node, s]) => [
                  node,
                  s.block !== "llm"
                    ? s
                    : { ...s, facts: (s.facts ?? []).map((f) => ({ ...f, replayed: true })) },
                ]),
              ),
            },
      ),
    };
    show(cached);
    expect(model(1)?.textContent).toContain("Kết quả đã lưu");
  });
});

describe("a run some fallback model answered", () => {
  /** The committed ten-case L1 reference stream, re-stamped so `n` cases came from a fallback. */
  const withFallback = (n: number) => {
    const run = replay(parseSse(readText("e2e", "data", "run-l1-reference.sse")));
    if (!run) throw new Error("no reference run");
    return {
      ...run,
      primaryModel: "gemini-3.5-flash-lite",
      cases: run.cases.map((c, i) =>
        i >= n
          ? c
          : {
              ...c,
              steps: Object.fromEntries(
                Object.entries(c.steps).map(([node, s]) => [
                  node,
                  s.block !== "llm"
                    ? s
                    : {
                        ...s,
                        facts: (s.facts ?? []).map((f) =>
                          f.kind !== "llm" ? f : { ...f, model: "gemini-3.1-flash-lite" },
                        ),
                      },
                ]),
              ),
            },
      ),
    };
  };

  it("counts the cases the fallback answered, out of the cases that got an answer", () => {
    show(withFallback(2));
    const line = document.querySelector("[data-fallback]");
    expect(line?.getAttribute("data-fallback")).toBe("2");
    expect(line?.textContent).toContain("2/10 câu do model dự phòng trả lời");
  });

  it("divides by the cases that got an answer, not by every case in the run", () => {
    // A quota-exhausted run must not read "2/10": the cases that never reached the model have
    // no model, and counting them would measure the denominator rather than the run.
    const run = withFallback(2);
    const stripped = {
      ...run,
      cases: run.cases.map((c, i) => (i < 8 ? c : { ...c, steps: {} })),
    };
    show(stripped);
    expect(document.querySelector("[data-fallback]")?.textContent).toContain("2/8 câu");
  });

  it("says star 2 is calibrated on the primary, beside the token evidence", () => {
    // spec §7: a fallback costs about 0,9k more output tokens on an L3 run, so the token figure
    // star 2 is judged against is not a measure of the player's bench.
    show(withFallback(2));
    const s2 = [...document.querySelectorAll("li")].find((li) =>
      li.textContent.startsWith("Sao 2"),
    );
    expect(s2?.textContent).toContain("token");
    expect(s2?.textContent).toContain("hiệu chỉnh trên model chính");
  });

  it("stays quiet when the primary answered every case", () => {
    show(withFallback(0));
    expect(document.querySelector("[data-fallback]")).toBeNull();
    expect(document.body.textContent).not.toContain("model dự phòng");
    expect(document.body.textContent).not.toContain("model chính");
  });
});

describe("a journey that crosses two rulers", () => {
  it("is not drawn as a rise, because GoldTrace tells the chips the scales", () => {
    // L3 is the only level with a block after the searches. hạng 23 over the whole store, then
    // hạng 2 inside the 3 passages Kính lúp kept: the passage is better off, but the numbers
    // are not points on one ruler (§8.6), and the prose list below says which is which.
    const l3 = testEnv("article-number-lookup");
    const starter = starterBench(l3);
    if (!starter) throw new Error("L3 starter is not drawable");
    const attached = setAttached(setAttached(starter, "bm25_search", true), "rerank", true);
    const dense3 = setParam(l3, attached, "rerank", "top_n", 3);
    const graph = graphFromBench(l3, dense3);
    const gold: GoldReveal = {
      gold_chunks: ["a1"],
      ranks: { vs: 23, bm: 4, rr: 2 },
      in_pack: true,
      flags: [],
    };
    show(finishedRun({ "lib-l1-v01": gold }), graph, l3, graph);

    const chips = [...document.querySelectorAll("[data-hop]")] as HTMLElement[];
    // Both searches rank the whole store, so that hop is a real rise -- which only happens if
    // GoldTrace passed the scales. The hop into Kính lúp's kept set is a change of ruler.
    expect(chips.map((c) => c.dataset.hop)).toEqual(["start", "up", "rescaled"]);
    expect(chips[2]?.className).not.toContain("success");
    // The words still carry both scales, which is where §8.6 puts them.
    expect(card(1)).toContain("hạng 23 trên toàn kho");
    expect(card(1)).toContain("hạng 2 trong 3 đoạn giữ lại");
  });
});

describe("every token figure names the counter behind it", () => {
  it("says star 2 is counted by the provider, thinking tokens included", () => {
    // §8.4: the two counts differ, and stars_vi only says "tốn không quá 15.000 token".
    show(finishedRun({ "lib-l1-v01": trap }));
    const s2 = [...document.querySelectorAll("li")].find((li) =>
      li.textContent.startsWith("Sao 2"),
    );
    expect(s2?.textContent).toContain("theo usage của Gemini");
  });

  it("says the same of a case's own token line", () => {
    show(finishedRun({ "lib-l1-v01": trap }));
    const line = document.querySelector("[data-case-tokens]");
    expect(line?.textContent).toContain("theo usage của Gemini");
  });
});

describe("the swing in output tokens", () => {
  it("shows the low and the high, not an average that hides the swing", () => {
    // §8.4: "Token suy nghĩ dao động mạnh … cho người học thấy điều đó, không làm phẳng."
    const run = finishedRun({ "lib-l1-v01": trap });
    const spread = {
      ...run,
      cases: run.cases.map((c, i) => ({ ...c, tokens: { in: 100, out: i === 0 ? 74 : 528 } })),
    };
    show(spread);
    const line = document.querySelector("[data-out-spread]");
    expect(line?.textContent).toContain("74");
    expect(line?.textContent).toContain("528");
    expect(line?.textContent).toContain("gồm token suy nghĩ");
    expect(line?.textContent).not.toContain("301");
  });

  it("prints one number for one answered case, not a range of one", () => {
    const run = finishedRun({ "lib-l1-v01": trap });
    const single = {
      ...run,
      cases: run.cases.map((c, i) =>
        i === 0 ? { ...c, tokens: { in: 1, out: 420 } } : { ...c, steps: {} },
      ),
    };
    show(single);
    expect(document.querySelector("[data-out-spread]")?.textContent).toContain("câu duy nhất");
    expect(document.querySelector("[data-out-spread]")?.textContent).not.toContain("–");
  });
});

describe("where cô Lan's diagnosis came from", () => {
  const lesson = {
    case: "lib-l1-v01",
    flag: "ret.gold_missing",
    message_vi: "Câu #1 cần một đoạn trong Điều 39.",
  };

  it("says the diagnosis was built from the trace, in plain sight and above the list", () => {
    // N5's point: the assistant was never asked why it failed. A reader who thinks it was
    // learns the opposite of the lesson, so this is descriptive copy, not a source stamp.
    show(finishedRun({ "lib-l1-v01": trap }, [lesson]));
    const note = document.querySelector("[data-diagnosis-source]");
    expect(note?.textContent).toContain("dựng từ vết chạy");
    // Visible: sr-only would leave the sighted reader with the wrong impression.
    expect(note?.className).not.toContain("sr-only");
    // Above the list, not parked at the foot of the page.
    const list = document.querySelector('ul[aria-labelledby="wb-diagnosis-title"]');
    expect(list?.previousElementSibling).toBe(note);
  });

  it("stays quiet when there is no diagnosis to explain", () => {
    show(finishedRun({ "lib-l1-v01": trap }));
    expect(document.querySelector("[data-diagnosis-source]")).toBeNull();
  });
});

describe("the regression strip on the results screen", () => {
  it("draws the level's earlier runs under its own heading", () => {
    const earlier: RunMark[] = [
      {
        body: "{}",
        at: 2,
        stars: 0,
        tokens: 10,
        budget: 20,
        cases: [{ n: 1, role: "visible", passed: false }],
      },
    ];
    show(finishedRun({ "lib-l1-v01": trap }), dense, l1, dense, earlier);
    expect(screen.getByRole("heading", { name: "Các lượt trước" })).toBeDefined();
    expect(document.querySelectorAll("[data-run-row]")).toHaveLength(1);
    expect(document.querySelector('[data-cell="fail"]')).not.toBeNull();
  });

  it("shows no strip before the level has a run behind it", () => {
    show(finishedRun({ "lib-l1-v01": trap }));
    expect(document.querySelectorAll("[data-run-row]")).toHaveLength(0);
    // Reachable with storage blocked or full: the heading must not sit over nothing.
    expect(screen.queryByText("Các lượt trước")).toBeNull();
  });
});

describe("duplicating a row of the strip", () => {
  const runs: RunMark[] = [9, 6, 3].map((topK, i) => ({
    body: `{"top_k":${topK}}`,
    at: 3 - i,
    stars: 1,
    tokens: 10,
    budget: 20,
    cases: [{ n: 1, role: "visible" as const, passed: true }],
  }));

  it("hands the page the mark of the row that was pressed", () => {
    // The other half of the chain -- that a mark's values reach the drawn control -- is pinned
    // by WorkbenchPage's "back to the last passing run" test, which asserts the slider.
    const picked: number[] = [];
    render(
      <MemoryRouter>
        <Results
          env={l1}
          run={finishedRun({ "lib-l1-v01": trap })}
          changed={false}
          runGraph={dense}
          graph={dense}
          backTo="/play/library"
          slip={null}
          history={runs}
          onDuplicate={(mark) => picked.push(mark.at)}
          onEdit={() => undefined}
          onFocusSlot={() => undefined}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Nhân bản cấu hình của lượt 2" }));
    expect(picked).toEqual([2]);
  });
});

describe("the comparison card from the second run on", () => {
  const twoRuns: RunMark[] = [
    {
      body: JSON.stringify(dense),
      at: 2,
      stars: 2,
      tokens: 10,
      budget: 20,
      cases: [{ n: 1, role: "visible", passed: true }],
    },
    {
      body: JSON.stringify(graphOf()),
      at: 1,
      stars: 0,
      tokens: 10,
      budget: 20,
      cases: [{ n: 1, role: "visible", passed: false }],
    },
  ];

  it("compares the two most recent runs, newest against the one before it", () => {
    show(finishedRun({ "lib-l1-v01": trap }), dense, l1, dense, twoRuns);
    expect(document.querySelector("[data-compare]")).not.toBeNull();
    // The case flipped from Trượt to Đạt between the two stored marks.
    expect(document.querySelector("[data-compare]")?.textContent).toContain("Trượt → Đạt");
  });

  it("draws no card with only one remembered run", () => {
    const [onlyRun] = twoRuns;
    if (!onlyRun) throw new Error("fixture lost its run");
    show(finishedRun({ "lib-l1-v01": trap }), dense, l1, dense, [onlyRun]);
    expect(document.querySelector("[data-compare]")).toBeNull();
  });
});
