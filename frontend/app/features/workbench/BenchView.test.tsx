import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setParam, starterBench, type Bench } from "./bench";
import { BenchSection, type BenchRunView, type SlotGold } from "./BenchView";
import type { BenchRun } from "./run";
import type { EventType } from "./schema";
import { frame, readText, replay, testEnv } from "./test-fixtures";
import { validateGraph } from "./validate";

const l3 = testEnv("article-number-lookup");

/** The committed L3 recorded run, replayed into the view a finished bench holds. */
function recordedView(gold: SlotGold | null): BenchRunView {
  const file = JSON.parse(readText("public", "runs", "article-number-lookup.json")) as {
    events: { type: string }[];
  };
  const run = replay(file.events.map((e, i) => frame(i + 1, e.type as EventType, e)));
  const followed = run?.cases.find((c) => c.id === "lib-l3-v01");
  if (!run || !followed) throw new Error("the recorded L3 run does not replay");
  return { run, followed, gold };
}

function Bench({
  bench,
  highlight = null,
  benchRun = "none",
  view = null,
}: {
  bench: Bench;
  highlight?: "chunker" | null;
  benchRun?: BenchRun;
  view?: BenchRunView | null;
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

describe("the star dome in the search slot", () => {
  const RANKS = { vs: 72 };

  it("shows the answer passage's rank on the dome of the block that ranked it", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: ["f22a1df7"], ranks: RANKS, visible: true })}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("đoạn đáp án ở hạng 72");
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
        view={recordedView({ chunks: ["f22a1df7"], ranks: RANKS, visible: true })}
      />,
    );
    const dome = container.querySelector('[role="img"]');
    expect(dome).not.toBeNull();
    expect(dome?.closest("details")).toBeNull();
  });

  it("draws no dome gold for a followed trap case even when the run sends it", () => {
    const start = starterBench(l3);
    if (!start) throw new Error("L3 starter is not drawable");
    render(
      <Bench
        bench={start}
        benchRun="done"
        view={recordedView({ chunks: ["f22a1df7"], ranks: RANKS, visible: false })}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("3 đoạn đã kéo");
  });
});
