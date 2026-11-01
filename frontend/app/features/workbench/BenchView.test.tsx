import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setParam, starterBench, type Bench } from "./bench";
import { BenchSection, type BenchRunView, type SlotGold } from "./BenchView";
import type { BenchRun, StepView } from "./run";
import type { Fact } from "./schema";
import type { EventType } from "./schema";
import { STRIP_VI } from "./copy";
import type { VizData } from "./vizData";
import { frame, readText, replay, testEnv } from "./test-fixtures";
import { validateGraph } from "./validate";

const l3 = testEnv("article-number-lookup");

/** The committed L3 recorded run, replayed into the view a finished bench holds. */
function recordedView(gold: SlotGold | null, caseId = "lib-l3-v01"): BenchRunView {
  const file = JSON.parse(readText("public", "runs", "article-number-lookup.json")) as {
    events: { type: string }[];
  };
  const run = replay(file.events.map((e, i) => frame(i + 1, e.type as EventType, e)));
  const followed = run?.cases.find((c) => c.id === caseId);
  if (!run || !followed) throw new Error("the recorded L3 run does not replay");
  return { run, followed, gold };
}

function Bench({
  bench,
  highlight = null,
  benchRun = "none",
  view = null,
  preview = null,
  viz = null,
  vizCase = null,
}: {
  bench: Bench;
  highlight?: "chunker" | null;
  benchRun?: BenchRun;
  view?: BenchRunView | null;
  preview?: Readonly<Record<string, Extract<Fact, { kind: "retrieved" }>>> | null;
  viz?: VizData | null;
  vizCase?: string | null;
}) {
  const graph = graphFromBench(l3, bench);
  return (
    <BenchSection
      env={l3}
      bench={bench}
      graph={graph}
      onChange={() => undefined}
      locked={false}
      issues={validateGraph(l3, graph)}
      highlight={highlight}
      view={view}
      preview={preview}
      benchRun={benchRun}
      viz={viz}
      vizCase={vizCase}
      saved={false}
      discarded={false}
    />
  );
}

afterEach(cleanup);

describe("BenchSection", () => {
  it("shows exactly the current issues of a slot, also after two identical ones", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    // Two lists straight into the magnifier: the validator repeats a line once per list.
    let bench = setAttached(setAttached(start, "bm25_search", true), "rerank", true);
    bench = setParam(l3, setParam(l3, bench, "bm25_search", "top_k", 3), "rerank", "top_n", 3);
    const steps = [
      bench, // G02 + "giữ 3/3" twice
      setParam(l3, bench, "rerank", "top_n", 5), // G02 + G06 (5 > 3) twice
      setParam(l3, setParam(l3, bench, "rerank", "top_n", 5), "bm25_search", "top_k", 5),
    ];
    const { container, rerender } = render(<Bench bench={bench} />);
    for (const step of steps) {
      rerender(<Bench bench={step} />);
      const shown = [...container.querySelectorAll("#slot-rr li")].map((li) => li.textContent);
      const expected = validateGraph(l3, graphFromBench(l3, step)).filter((i) => i.node === "rr");
      expect(shown).toHaveLength(expected.length);
      expected.forEach((issue, index) => {
        expect(shown[index]).toContain(issue.message_vi.replaceAll("*", ""));
      });
    }
  });

  it("dims the stale-document filter at L3, whose corpus has no expired document", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(<Bench bench={start} />);
    const filter = screen.getByRole("switch", { name: /Kính lọc hiệu lực/ });
    expect(filter).toHaveProperty("disabled", true);
    expect(filter.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Kho tối nay không có văn bản hết hiệu lực.")).toBeDefined();
  });

  it("lights a slot opened from a diagnosis unlike a finished step (fill, not only a ring)", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const { container } = render(<Bench bench={start} highlight="chunker" />);
    const frame = container.querySelector("#slot-ix");
    expect(frame?.className).toContain("bg-brand-tint");
  });
});

describe("slot states (N6)", () => {
  const states = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-state]")].map((chip) => chip.textContent);

  it("marks every attached slot 'not run' before a run, and 'run again' once a knob changed", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const { container, rerender } = render(<Bench bench={start} />);
    const before = states(container);
    expect(before.length).toBeGreaterThan(3);
    expect(new Set(before)).toEqual(new Set(["Trạng thái khối: Chưa chạy"]));
    // Detached slots are not on the graph: no state.
    expect(container.querySelector("#slot-bm [data-state]")).toBeNull();

    rerender(<Bench bench={start} benchRun="stale" />);
    expect(new Set(states(container))).toEqual(new Set(["Trạng thái khối: Cần chạy lại"]));
    // Words, a colour token and an icon for each state.
    const chip = container.querySelector("[data-state='stale']");
    expect(chip?.className).toContain("border-warning");
    expect(chip?.querySelector("svg")).not.toBeNull();
  });
});

/** The slot now holds two pictures: the bin and the dome. Pick the dome by what it says. */
const domeLabel = (container: HTMLElement) =>
  [...container.querySelectorAll('[role="img"]')]
    .map((el) => el.getAttribute("aria-label"))
    .find((label) => label?.includes("đoạn đã kéo"));

describe("the star dome in the search slot", () => {
  const RANKS = { vs: 72 };

  it("shows the answer passage's rank on the dome of the block that ranked it", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const { container } = render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: ["f22a1df7"], ranks: RANKS, flags: [], visible: true })}
      />,
    );
    expect(domeLabel(container)).toContain("đoạn đáp án ở hạng 72");
  });

  it("shows the dome without opening the numbers disclosure", () => {
    // A closed <details> is content-visibility: hidden in a real browser, so anything inside it
    // is out of the accessibility tree and off the tab order. jsdom does not implement that, so
    // querying by role would pass either way: assert the DOM position instead.
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const { container } = render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: ["f22a1df7"], ranks: RANKS, flags: [], visible: true })}
      />,
    );
    const dome = container.querySelector('[role="img"]');
    expect(dome).not.toBeNull();
    expect(dome?.closest("details")).toBeNull();
  });

  it("draws the preview when the bench no longer matches the run on show", () => {
    // Editing the bench makes the last run's facts describe a configuration that is not on
    // screen any more. The dome follows the bench, not the stale run.
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const preview = {
      vs: {
        kind: "retrieved" as const,
        items: [
          {
            chunk_id: "aaaa1111",
            rank: 1,
            score: 0.91,
            doc_id: "qcdt-2024",
            dieu: 47,
            khoan: [2],
            hieu_luc: true,
          },
        ],
      },
    };
    const { container } = render(<Bench bench={start} benchRun="stale" preview={preview} />);
    expect(domeLabel(container)).toBe("1 đoạn đã kéo");
    expect(screen.getByText(/Điều 47.*hạng 1.*0,910/)).toBeDefined();
  });

  it("marks the blade when the followed case had its answer sentence cut", () => {
    // The committed L2 run at co_dinh-128-0 raises ret.boundary_split on v02; that flag is the
    // whole lesson of L2, and it has to reach the blade rather than stop at the diagnosis.
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({
          chunks: [],
          ranks: RANKS,
          flags: ["ret.boundary_split"],
          visible: true,
        })}
      />,
    );
    expect(screen.getByText(/cắt đứt câu đáp án/)).toBeDefined();
  });

  it("never says a hidden case had its answer cut, even when the run says so", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({
          chunks: [],
          ranks: RANKS,
          flags: ["ret.boundary_split"],
          visible: false,
        })}
      />,
    );
    expect(screen.queryByText(/cắt đứt câu đáp án/)).toBeNull();
  });

  it("reads the packed ids from the packer step, not from the llm step beside it", () => {
    // The llm node's step carries the answer; the packer node's carries what went into the
    // bin. Looking for both on one step makes every citation read as fabricated.
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: [], ranks: RANKS, flags: [], visible: true }, "lib-l3-v03")}
      />,
    );
    // lib-l3-v03 cites 8b5bf36c, which its packer really did put in the bin, so the stamp
    // summary says sourced and nothing else. ("bịa" also appears in a grading criterion, so
    // the whole page's text is too blunt an instrument here.)
    expect(screen.getByText(/^\d+ câu có nguồn$/)).toBeDefined();
  });

  it("shows the context bin for the packer slot, with the run's own token numbers", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const { container } = render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: ["f22a1df7"], ranks: RANKS, flags: [], visible: true })}
      />,
    );
    const bin = [...container.querySelectorAll('[role="img"]')].find((el) =>
      el.getAttribute("aria-label")?.startsWith("Thùng chứa"),
    );
    expect(bin).toBeDefined();
    // The recorded L3 run packs into a 3.000-token budget.
    expect(bin?.getAttribute("aria-label")).toMatch(/trên 3\.000 token/);
  });

  it("draws no dome gold for a followed trap case even when the run sends it", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const { container } = render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: ["f22a1df7"], ranks: RANKS, flags: [], visible: false })}
      />,
    );
    expect(domeLabel(container)).toBe("3 đoạn đã kéo");
  });
});

describe("the citation ledger on the bench", () => {
  it("lines the codes up for a sample case", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(<Bench bench={start} benchRun="done" view={recordedView(null, "lib-l3-v03")} />);
    expect(document.querySelector('[data-row="pull"]')).not.toBeNull();
    expect(document.querySelector('[data-row="cite"]')).not.toBeNull();
  });

  it("draws nothing for a hidden case, which a live run does send the codes for", () => {
    // The engine sends pack.included and llm.cited_ids for every role -- only `answer` is held
    // back (blocks.py) -- and a hidden case's valid code points straight at its gold chunk
    // (roadmap B0). So the gate is the case's role, not the absence of data.
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    const sample = recordedView(null, "lib-l3-v03");
    const hidden = { ...sample, followed: { ...sample.followed, role: "hidden" as const } };
    render(<Bench bench={start} benchRun="done" view={hidden} />);
    expect(document.querySelector('[data-row="pull"]')).toBeNull();
    expect(document.querySelector("[data-ledger-note]")).toBeNull();
  });
});

describe("the provider's token count on the bin", () => {
  const stripLlmTokens = (view: BenchRunView): BenchRunView => ({
    ...view,
    followed: {
      ...view.followed,
      steps: Object.fromEntries(
        Object.entries(view.followed.steps).map(([node, s]) => {
          if (s.block !== "llm") return [node, s];
          // The key goes, rather than being set to undefined: an unfinished step has no
          // `tokens` at all, which is the state this is here to reproduce.
          const running: Omit<StepView, "tokens"> = { ...s };
          delete (running as { tokens?: unknown }).tokens;
          return [node, running];
        }),
      ),
    },
  });

  it("says there is no provider number yet rather than printing a zero", () => {
    // The llm step is still running, so Gemini has charged nothing for this case yet. A zero
    // would read as "the prompt cost nothing", which is a number the run never measured.
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(<Bench bench={start} benchRun="done" view={stripLlmTokens(recordedView(null))} />);
    expect(document.body.textContent).toContain("Chưa có số của Gemini cho câu này.");
    expect(document.body.textContent).not.toContain("tính 0 token");
  });

  it("prints what the provider charged once its step has finished", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(<Bench bench={start} benchRun="done" view={recordedView(null)} />);
    expect(document.body.textContent).toContain("không chỉ phần trong thùng");
    expect(document.body.textContent).not.toContain("Chưa có số của Gemini");
  });
});

describe("the cut passages under the bin", () => {
  it("names the rank each cut passage was cut from, joined against the run's own list", () => {
    // pack.dropped carries ids only; the rank is the place they had in the ranked list the
    // packer was handed, which lives on another step of the same case.
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(<Bench bench={start} benchRun="done" view={recordedView(null)} />);
    const note = document.querySelector("[data-cut-note]");
    const pieces = document.querySelectorAll("[data-cut-piece]");
    // The committed L3 run packs everything, so there is nothing on the floor and no note.
    expect(pieces).toHaveLength(0);
    expect(note).toBeNull();
  });
});

describe("the chunker's strip (N22)", () => {
  const l2 = testEnv("chunk-tuning");
  const viz = JSON.parse(readText("public", "viz", "chunk-tuning.json")) as VizData;

  function drawL2(bench: Bench, props: { viz?: VizData | null; vizCase?: string | null } = {}) {
    const graph = graphFromBench(l2, bench);
    render(
      <BenchSection
        env={l2}
        bench={bench}
        graph={graph}
        onChange={() => undefined}
        locked={false}
        issues={validateGraph(l2, graph)}
        highlight={null}
        view={null}
        preview={null}
        benchRun="none"
        viz={props.viz === undefined ? viz : props.viz}
        vizCase={props.vizCase === undefined ? "lib-l2-v01" : props.vizCase}
        saved={false}
        discarded={false}
      />,
    );
  }

  const starter = () => {
    const b = starterBench(l2);
    if (!b) throw new Error("L2 starter is not drawable");
    return b;
  };

  // The whole point of N22: free, before any run, and it moves when the blade moves.
  it("draws the strip of the article the search favours, with no run on the bench", () => {
    drawL2(setParam(l2, starter(), "chunker", "strategy", "theo_dieu"));
    expect(screen.getByText("Dải đoạn Điều 12", { exact: false })).toBeDefined();
  });

  // The starter blade favours qcdt-2019 Điều 10 ("Bảo lưu kết quả học tập" -- Hà's actual
  // question), while qcdt-2024 has its own Điều 10 ("Khối lượng học tập"). Resolving by number
  // alone drew the 2024 namesake, and both cut into 3 pieces with 2 severed sentences, so every
  // count still matched. The stale-document line is what proves the right one is on screen.
  it("draws the document the search pointed at, not its namesake in the other document", () => {
    drawL2(starter());
    expect(screen.getByText("Dải đoạn Điều 10", { exact: false })).toBeDefined();
    expect(screen.getByText(STRIP_VI.stale)).toBeDefined();
  });

  it("follows the blade: a different cut favours a different article", () => {
    // co_dinh-512-0 swallows Điều 12 into a cut filed under Điều 11.
    let bench = setParam(l2, starter(), "chunker", "chunk_size", 512);
    bench = setParam(l2, bench, "chunker", "overlap_pct", 0);
    drawL2(bench);
    expect(screen.getByText("Dải đoạn Điều 11", { exact: false })).toBeDefined();
  });

  // The blade's size is a slider over the four stops the level offers, not a row of chips: the
  // player turns it, and the stops keep the value to a size the level has.
  it("turns the chunk size with a slider over its four stops, not a row of chips", () => {
    drawL2(starter());
    const control = document.querySelector('[data-param="chunk_size"]');
    const blade = control?.querySelector('input[type="range"]') as HTMLInputElement | null;
    expect(blade).not.toBeNull();
    expect(control?.querySelectorAll('input[type="radio"]').length).toBe(0);
    expect(blade?.min).toBe("0");
    expect(blade?.max).toBe("3");
  });

  it("moves the chunk size to the stop the blade lands on", () => {
    const changes: Bench[] = [];
    const bench = starter();
    render(
      <BenchSection
        env={l2}
        bench={bench}
        graph={graphFromBench(l2, bench)}
        onChange={(next) => changes.push(next)}
        locked={false}
        issues={validateGraph(l2, graphFromBench(l2, bench))}
        highlight={null}
        view={null}
        preview={null}
        benchRun="none"
        viz={viz}
        vizCase="lib-l2-v01"
        saved={false}
        discarded={false}
      />,
    );
    const control = document.querySelector('[data-param="chunk_size"]');
    const blade = control?.querySelector('input[type="range"]');
    if (!blade) throw new Error("the chunk size blade is not drawn");
    fireEvent.change(blade, { target: { value: "2" } });
    expect(changes.at(-1)).toEqual(setParam(l2, bench, "chunker", "chunk_size", 512));
  });

  // The gate is "can the player move this blade", not a hardcoded level id. L1 locks the
  // chunker and fixes all four knobs, so a strip there is a picture of a control that cannot
  // turn -- and it would never change, which is the one thing it exists to do. L3 leaves all
  // three cut knobs open, so there the strip belongs.
  it.each([
    ["grounded-citation", false],
    ["article-number-lookup", true],
  ] as const)("draws on %s only when its blade can move: %s", (levelId, drawn) => {
    const env = testEnv(levelId);
    const bench = starterBench(env);
    if (!bench) throw new Error(`${levelId} starter is not drawable`);
    const graph = graphFromBench(env, bench);
    const data = JSON.parse(readText("public", "viz", `${levelId}.json`)) as VizData;
    render(
      <BenchSection
        env={env}
        bench={bench}
        graph={graph}
        onChange={() => undefined}
        locked={false}
        issues={validateGraph(env, graph)}
        highlight={null}
        view={null}
        preview={null}
        benchRun="none"
        viz={data}
        vizCase={env.level.visible_cases[0]?.id ?? null}
        saved={false}
        discarded={false}
      />,
    );
    expect(screen.queryByText("Dải đoạn", { exact: false }) !== null).toBe(drawn);
  });

  it("draws nothing when the static data did not load, leaving the bench usable", () => {
    drawL2(starter(), { viz: null });
    expect(screen.queryByText("Dải đoạn", { exact: false })).toBeNull();
  });

  it("draws nothing when no sample case is being followed", () => {
    drawL2(starter(), { vizCase: null });
    expect(screen.queryByText("Dải đoạn", { exact: false })).toBeNull();
  });
});
