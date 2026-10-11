import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setParam, starterBench, type Bench } from "./bench";
import { BenchSection, type BenchRunView, type SlotGold } from "./BenchView";
import type { BenchRun } from "./run";
import type { Fact } from "./schema";
import type { EventType } from "./schema";
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
}: {
  bench: Bench;
  highlight?: "chunker" | null;
  benchRun?: BenchRun;
  view?: BenchRunView | null;
  preview?: Readonly<Record<string, Extract<Fact, { kind: "retrieved" }>>> | null;
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
    const { container } = render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: [], ranks: RANKS, flags: [], visible: true }, "lib-l3-v03")}
      />,
    );
    const stamps = [...container.querySelectorAll('[role="img"]')]
      .map((el) => el.getAttribute("aria-label"))
      .find((label) => label?.includes("câu"));
    // lib-l3-v03 cites 8b5bf36c, which its packer really did put in the bin.
    expect(stamps ?? "").not.toContain("bịa");
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
