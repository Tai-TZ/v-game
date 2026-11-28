import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  isAllowed,
  OPTIONAL_SLOTS,
  setAttached,
  setParam,
  starterBench,
  type Bench,
  type Env,
} from "./bench";
import { beatLine, columns, INK, MachineMap, TONE } from "./MachineMap";
import type { BenchRunView } from "./BenchView";
import type { BlockState } from "./run";
import type { BlockType, EventType } from "./schema";
import { frame, parseSse, readText, replay, testEnv } from "./test-fixtures";

afterEach(cleanup);

const l1 = testEnv("grounded-citation");
const l2 = testEnv("chunk-tuning");
const l3 = testEnv("article-number-lookup");

function starter(env: Env): Bench {
  const bench = starterBench(env);
  if (!bench) throw new Error(`${env.level.id} starter is not drawable`);
  return bench;
}

function draw(
  env: Env,
  bench: Bench,
  {
    onChange = () => undefined,
    disabled = false,
    states = {},
  }: {
    onChange?: (next: Bench) => void;
    disabled?: boolean;
    states?: Partial<Record<BlockType, BlockState>>;
  } = {},
) {
  render(
    <MachineMap
      env={env}
      bench={bench}
      onChange={onChange}
      disabled={disabled}
      states={states}
      highlight={null}
      answer={null}
    />,
  );
  return screen.getByRole("group", { name: /Sơ đồ trợ lý/ });
}

const tile = (type: string) => document.querySelector(`[data-tile-type="${type}"]`);
const beatButton = (beat: string) => {
  const found = document.querySelector<HTMLButtonElement>(`[data-beat="${beat}"]`);
  if (!found) throw new Error(`no beat ${beat}`);
  return found;
};

describe("the machine map at the head of the bench", () => {
  it("lays L1's toys out in the order the question flows through them", () => {
    const map = draw(l1, starter(l1));
    const names = [...map.querySelectorAll("[data-column]")].map((g) =>
      g.getAttribute("data-column"),
    );
    expect(names).toEqual([
      "input",
      "corpus",
      "chunker",
      "vector_search",
      "context_packer",
      "llm",
      "output",
    ]);
  });

  it("puts both searches of L3 side by side in one column, then the funnel and the lens", () => {
    const map = draw(l3, starter(l3));
    const columns = [...map.querySelectorAll("[data-column]")].map((g) =>
      g.getAttribute("data-column"),
    );
    expect(columns).toEqual([
      "input",
      "corpus",
      "chunker",
      "vector_search+bm25_search",
      "fusion",
      "rerank",
      "context_packer",
      "llm",
      "output",
    ]);
  });

  // L1's starter has no search attached: the lesson is the gap, so the gap is drawn.
  it("draws a missing search as an empty socket and the pipe after it broken", () => {
    const bench = setAttached(starter(l1), "vector_search", false);
    draw(l1, bench);
    expect(tile("vector_search")?.getAttribute("data-tile")).toBe("empty");
    expect(
      document.querySelector('[data-pipe-after="vector_search"]')?.getAttribute("data-pipe"),
    ).toBe("broken");
  });

  it("attaches the toy when its empty socket is pressed", () => {
    const changes: Bench[] = [];
    const bench = setAttached(starter(l1), "vector_search", false);
    draw(l1, bench, { onChange: (next) => changes.push(next) });
    fireEvent.click(screen.getByRole("button", { name: /Gắn Vòm Sao/ }));
    expect(changes.at(-1)).toEqual(setAttached(bench, "vector_search", true));
  });

  it("mends the pipe once a search is attached", () => {
    draw(l1, setAttached(starter(l1), "vector_search", true));
    expect(tile("vector_search")?.getAttribute("data-tile")).toBe("on");
    expect(
      document.querySelector('[data-pipe-after="vector_search"]')?.getAttribute("data-pipe"),
    ).toBe("flow");
  });

  it("cuts the blade's gauge finer as the chunk size shrinks", () => {
    const cuts = (size: number) => {
      draw(l2, setParam(l2, starter(l2), "chunker", "chunk_size", size));
      const n = tile("chunker")?.querySelectorAll("[data-gauge-cut]").length ?? -1;
      cleanup();
      return n;
    };
    expect(cuts(128)).toBeGreaterThan(cuts(512));
    expect(cuts(512)).toBeGreaterThan(cuts(1024));
  });

  it("hangs one hook on the dome per passage it pulls", () => {
    let bench = setAttached(starter(l1), "vector_search", true);
    bench = setParam(l1, bench, "vector_search", "top_k", 4);
    draw(l1, bench);
    expect(tile("vector_search")?.querySelectorAll("[data-gauge-hook]").length).toBe(4);
  });

  it("fills one lens slot per prompt card chosen", () => {
    const bench: Bench = { ...starter(l1), cards: ["G1", "G3", null] };
    draw(l1, bench);
    const slots = [...(tile("llm")?.querySelectorAll("[data-gauge-card]") ?? [])];
    expect(slots.map((s) => s.getAttribute("data-gauge-card"))).toEqual(["on", "on", "off"]);
  });

  it("marks the toys this level keeps locked", () => {
    draw(l1, starter(l1));
    expect(tile("chunker")?.hasAttribute("data-locked")).toBe(true);
    expect(tile("llm")?.hasAttribute("data-locked")).toBe(false);
  });

  it("colours a tile by its run state", () => {
    draw(l1, setAttached(starter(l1), "vector_search", true), {
      states: { vector_search: "passed", llm: "error" },
    });
    expect(tile("vector_search")?.getAttribute("data-tile-state")).toBe("passed");
    expect(tile("llm")?.getAttribute("data-tile-state")).toBe("error");
  });

  it("shows each toy's state by shape, not colour alone", () => {
    const cases: readonly {
      type: BlockType;
      state: BlockState;
      mark: "pass" | "fail" | null;
      shape: string | null;
      dash: string | null;
    }[] = [
      { type: "input", state: "passed", mark: "pass", shape: "circle", dash: null },
      { type: "llm", state: "error", mark: "fail", shape: "rect", dash: "6 4" },
      { type: "output", state: "stale", mark: null, shape: null, dash: "2 3" },
      { type: "chunker", state: "running", mark: null, shape: null, dash: null },
      { type: "corpus", state: "idle", mark: null, shape: null, dash: null },
    ];
    draw(l1, setAttached(starter(l1), "vector_search", true), {
      states: Object.fromEntries(cases.map((c) => [c.type, c.state])),
    });
    for (const { type, state, mark, shape, dash } of cases) {
      const toy = tile(type);
      const marks = toy?.querySelectorAll("[data-tile-mark]") ?? [];
      expect(marks.length, `${state} mark count`).toBe(mark ? 1 : 0);
      if (mark && shape) {
        const badge = marks[0];
        expect(badge?.getAttribute("data-tile-mark")).toBe(mark);
        expect(badge?.querySelectorAll(shape).length, `${state} badge shape`).toBe(1);
        expect(badge?.getAttribute("class")).toContain(TONE[state]);
        expect(badge?.getAttribute("stroke-width")).toBe(String(INK.mark));
      }
      const outline = toy?.querySelector("[data-outline]");
      expect(outline?.getAttribute("stroke-dasharray"), `${state} dash`).toBe(dash);
      expect(outline?.getAttribute("class")).toContain(TONE[state]);
      // Only the silhouette is dashed: nothing thin is solid under it, so a dashed state's faces
      // draw no edge of their own and the three that meet inside are drawn apart, thin and solid.
      const faces = [...(outline?.parentElement?.querySelectorAll("polygon") ?? [])].filter(
        (face) => face !== outline,
      );
      expect(faces.length, `${state} faces`).toBe(3);
      const inner = outline?.parentElement?.querySelectorAll("[data-face-edges]") ?? [];
      expect(inner.length, `${state} inner edges`).toBe(dash ? 1 : 0);
      for (const face of faces) {
        expect(face.hasAttribute("stroke-dasharray")).toBe(false);
        expect(face.getAttribute("stroke") === "none", `${state} face edge`).toBe(Boolean(dash));
      }
      if (dash) {
        const edge = inner[0];
        expect(edge?.getAttribute("stroke-width")).toBe(String(INK.edge));
        expect(edge?.getAttribute("class")).toContain(TONE[state]);
        expect(edge?.hasAttribute("stroke-dasharray")).toBe(false);
        expect((edge?.getAttribute("d") ?? "").match(/M/g)?.length).toBe(3);
      }
    }
  });

  it("cannot be pressed while the bench is locked for a run", () => {
    const changes: Bench[] = [];
    const map = draw(l1, setAttached(starter(l1), "vector_search", false), {
      disabled: true,
      onChange: (next) => changes.push(next),
    });
    const toys = [...map.querySelectorAll("[data-tile]")];
    expect(toys.length).toBe(7);
    for (const toy of toys) {
      expect(toy.getAttribute("aria-disabled")).toBe("true");
      expect(toy.getAttribute("tabindex")).toBe("-1");
    }
    fireEvent.click(screen.getByRole("button", { name: /Gắn Vòm Sao/ }));
    fireEvent.keyDown(screen.getByRole("button", { name: /Gắn Vòm Sao/ }), { key: "Enter" });
    expect(changes).toEqual([]);
  });

  it("attaches from the keyboard too", () => {
    const changes: Bench[] = [];
    const bench = setAttached(starter(l1), "vector_search", false);
    draw(l1, bench, { onChange: (next) => changes.push(next) });
    fireEvent.keyDown(screen.getByRole("button", { name: /Gắn Vòm Sao/ }), { key: " " });
    expect(changes.at(-1)).toEqual(setAttached(bench, "vector_search", true));
  });
});

// The beats walk the question through the machine, one toy at a time (Colorfigures-style).
describe("the beats beside the machine", () => {
  it("offers one beat per toy the question passes, in order, and none for the shelf", () => {
    draw(l3, starter(l3));
    const beats = [...document.querySelectorAll("[data-beat]")].map((b) =>
      b.getAttribute("data-beat"),
    );
    expect(beats).toEqual([
      "input",
      "chunker",
      "search",
      "fusion",
      "rerank",
      "context_packer",
      "llm",
      "output",
    ]);
  });

  it("lifts the toy of the pressed beat and reads its line under the machine", () => {
    draw(l1, setAttached(starter(l1), "vector_search", false));
    const beat = document.querySelector<HTMLButtonElement>('[data-beat="search"]');
    if (!beat) throw new Error("no search beat");
    fireEvent.click(beat);
    expect(beat.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("[data-beat-readout]")?.textContent).toBe(
      "Không có khe tìm nào: thùng chỉ có câu hỏi, Bộ Óc phải tự đoán.",
    );
    fireEvent.click(beat);
    expect(beat.getAttribute("aria-pressed")).toBe("false");
  });

  it("reads the bench's own setting before anything has run", () => {
    const bench = setParam(l2, starter(l2), "chunker", "chunk_size", 512);
    expect(beatLine("chunker", l2, bench, null)).toContain("512 token");
    const l1on = setParam(
      l1,
      setAttached(starter(l1), "vector_search", true),
      "vector_search",
      "top_k",
      4,
    );
    expect(beatLine("search", l1, l1on, null)).toBe("Vòm Sao kéo tối đa 4 đoạn.");
  });

  it("names the toys' block types only when seen through", () => {
    const map = draw(l1, starter(l1));
    expect(map.textContent).not.toContain("vector_search");
    fireEvent.click(screen.getByRole("button", { name: "Nhìn xuyên" }));
    expect(map.textContent).toContain("context_packer");
    fireEvent.click(screen.getByRole("button", { name: "Nhãn" }));
    expect(map.querySelectorAll("text").length).toBe(0);
  });
});

// The beats read the run's own facts once one is on the bench (here the committed L3 recording).
describe("the beats on a recorded run", () => {
  function recorded(caseId: string): BenchRunView {
    const file = JSON.parse(readText("public", "runs", "article-number-lookup.json")) as {
      events: { type: string }[];
    };
    const run = replay(file.events.map((e, i) => frame(i + 1, e.type as EventType, e)));
    const followed = run?.cases.find((c) => c.id === caseId);
    if (!run || !followed) throw new Error("the recorded L3 run does not replay");
    return { run, followed, gold: null };
  }

  it("counts what each search really pulled for the followed case", () => {
    const view = recorded("lib-l3-v01");
    const line = beatLine("search", l3, starter(l3), view);
    expect(line).toMatch(/kéo về \d+ đoạn/);
    expect(line).not.toContain("tối đa");
  });

  // The recorded L3 answer happens to carry no markdown, so the marks are put there.
  it("reads the answer as one plain line, without markdown marks or line breaks", () => {
    const view = recorded("lib-l3-v01");
    const marked = { ...view, followed: { ...view.followed, answer: "**Điều 47**\n\nkhoản 2" } };
    expect(beatLine("llm", l3, starter(l3), marked)).toMatch(/«Điều 47 khoản 2»$/);
  });

  it("never reads out a hidden case's question or answer", () => {
    const view = recorded("lib-l3-v01");
    const hidden = view.run.cases.find((c) => c.role !== "visible");
    if (!hidden) throw new Error("the recording has no hidden case");
    // The words are planted: a hidden case's own payload may carry none, and then a leak
    // would read exactly like a pass.
    const asHidden = {
      ...view,
      followed: { ...hidden, steps: view.followed.steps, question: "CÂU ẨN", answer: "ĐÁP ẨN" },
    };
    expect(beatLine("input", l3, starter(l3), asHidden)).not.toContain("CÂU ẨN");
    expect(beatLine("llm", l3, starter(l3), asHidden)).not.toContain("ĐÁP ẨN");
  });
});

// The Colorfigures-style dressing: a figure caption, callout labels, a see-through that shows
// what each toy holds inside, and a question slip that travels the belt to the beat's toy.
describe("the machine as a figure to play with", () => {
  it("captions the figure with the level it belongs to", () => {
    draw(l1, starter(l1));
    expect(document.querySelector("[data-machine-figure] figcaption")?.textContent).toContain(
      l1.level.title,
    );
  });

  it("calls every toy out by name, and drops the callouts when labels are off", () => {
    draw(l1, setAttached(starter(l1), "vector_search", false));
    const callouts = [...document.querySelectorAll("[data-callout]")];
    expect(callouts.map((c) => c.getAttribute("data-callout"))).toEqual([
      "input",
      "corpus",
      "chunker",
      "vector_search",
      "context_packer",
      "llm",
      "output",
    ]);
    expect(document.querySelector('[data-callout="vector_search"]')?.textContent).toBe(
      "GẮN VÒM SAO",
    );
    fireEvent.click(screen.getByRole("button", { name: "Nhãn" }));
    expect(document.querySelectorAll("[data-callout]").length).toBe(0);
  });

  it("shows what each toy on the bench holds inside only when seen through", () => {
    draw(l1, setAttached(starter(l1), "vector_search", false));
    expect(document.querySelectorAll("[data-internal]").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Nhìn xuyên" }));
    const inside = [...document.querySelectorAll("[data-internal]")].map((g) =>
      g.getAttribute("data-internal"),
    );
    // Six toys on the bench; the empty socket has nothing inside to show.
    expect(inside).toEqual(["input", "corpus", "chunker", "context_packer", "llm", "output"]);
    expect(document.querySelectorAll("[data-glass]").length).toBe(6);
  });

  it("draws each toy with a heavy silhouette over thin face edges", () => {
    draw(l1, setAttached(starter(l1), "vector_search", true));
    for (const seeThrough of [false, true]) {
      if (seeThrough) fireEvent.click(screen.getByRole("button", { name: "Nhìn xuyên" }));
      const toys = [...document.querySelectorAll('[data-tile="on"]')];
      expect(toys.length).toBe(7);
      for (const toy of toys) {
        const outlines = toy.querySelectorAll("[data-outline]");
        expect(outlines.length).toBe(1);
        const outline = outlines[0];
        expect(outline?.getAttribute("stroke-width")).toBe(String(INK.outline));
        expect(outline?.getAttribute("fill")).toBe("none");
        const faces = [...(outline?.parentElement?.querySelectorAll("polygon") ?? [])].filter(
          (face) => face !== outline,
        );
        expect(faces.length).toBe(3);
        for (const face of faces) {
          expect(face.getAttribute("stroke-width")).toBe(String(INK.edge));
          // The glass keeps its fill: the outline is a line, not a pane over the toy's insides.
          if (seeThrough) expect(face.getAttribute("class")).toContain("[fill-opacity:0.28]");
        }
      }
    }
    expect(INK).toEqual({ outline: 2.4, edge: 1, fine: 1, cue: 1.6, mark: 2.5 });
  });

  it("cuts the sheet inside the blade into as many pieces as it has cuts, plus one", () => {
    draw(l2, setParam(l2, starter(l2), "chunker", "chunk_size", 256));
    fireEvent.click(screen.getByRole("button", { name: "Nhìn xuyên" }));
    const cuts = tile("chunker")?.querySelectorAll("[data-gauge-cut]").length ?? 0;
    expect(tile("chunker")?.querySelectorAll("[data-piece]").length).toBe(cuts + 1);
    // A cut carries the reading, so it is a cue line, not a hairline.
    expect(cuts).toBeGreaterThan(0);
    for (const cut of tile("chunker")?.querySelectorAll("[data-gauge-cut]") ?? []) {
      expect(cut.getAttribute("stroke-width")).toBe(String(INK.cue));
    }
  });

  it("lights as many stars inside the dome as passages it pulls", () => {
    const bench = setParam(
      l1,
      setAttached(starter(l1), "vector_search", true),
      "vector_search",
      "top_k",
      4,
    );
    draw(l1, bench);
    fireEvent.click(screen.getByRole("button", { name: "Nhìn xuyên" }));
    expect(tile("vector_search")?.querySelectorAll('[data-star="pulled"]').length).toBe(4);
  });

  it("sends the question slip down the belt to the toy of the pressed beat", () => {
    draw(l1, setAttached(starter(l1), "vector_search", true));
    expect(document.querySelector("[data-slip]")).toBeNull();
    fireEvent.click(beatButton("search"));
    const slip = document.querySelector("[data-slip]");
    expect(slip?.getAttribute("data-at")).toBe("search");
    expect(slip?.querySelector("polygon")?.getAttribute("stroke-width")).toBe(String(INK.cue));
    const before = slip?.getAttribute("style");
    fireEvent.click(beatButton("llm"));
    expect(document.querySelector("[data-slip]")?.getAttribute("data-at")).toBe("llm");
    expect(document.querySelector("[data-slip]")?.getAttribute("style")).not.toBe(before);
  });

  it("dims everything but the pressed step's part", () => {
    draw(l1, starter(l1));
    expect(document.querySelectorAll("[data-dimmed]")).toHaveLength(0);

    fireEvent.click(beatButton("llm"));
    const tiles = [...document.querySelectorAll("[data-tile]")];
    expect(tiles.length).toBeGreaterThan(1);
    const [lit, rest] = [
      tiles.filter((t) => t.getAttribute("data-tile-type") === "llm"),
      tiles.filter((t) => t.getAttribute("data-tile-type") !== "llm"),
    ];
    expect(lit).toHaveLength(1);
    expect(lit[0]?.hasAttribute("data-dimmed")).toBe(false);
    for (const other of rest) {
      expect(other.hasAttribute("data-dimmed")).toBe(true);
      // Faded over an opaque backing, so the belt behind the toy cannot show through it.
      expect(other.querySelectorAll("[data-backing]")).toHaveLength(1);
      expect(other.querySelector("[data-backing] + [class*='opacity-']")).not.toBeNull();
    }
    expect(lit[0]?.querySelector("[data-backing]")).toBeNull();
    // The belt into the pressed toy stays; the rest of the belts step back.
    const into = document.querySelector('[data-pipe-after="context_packer"]');
    expect(into?.hasAttribute("data-dimmed")).toBe(false);
    const belts = [...document.querySelectorAll("[data-pipe-after]")].filter((b) => b !== into);
    expect(belts.length).toBeGreaterThan(0);
    for (const belt of belts) expect(belt.hasAttribute("data-dimmed")).toBe(true);
    // The slip and the bubble stay full.
    expect(document.querySelector("[data-slip]")?.closest("[data-dimmed]")).toBeNull();
    expect(document.querySelector("[data-beat-bubble]")?.closest("[data-dimmed]")).toBeNull();

    fireEvent.click(beatButton("llm"));
    expect(document.querySelectorAll("[data-dimmed]")).toHaveLength(0);
  });

  it("keeps the branch toy and its belt full when a branch step is pressed", () => {
    const w1 = testEnv("direct-injection");
    draw(w1, starter(w1));
    fireEvent.click(beatButton("tool_refund"));
    expect(tile("tool_refund")?.hasAttribute("data-dimmed")).toBe(false);
    expect(
      document.querySelector('[data-pipe-branch="tool_refund"]')?.hasAttribute("data-dimmed"),
    ).toBe(false);
    expect(
      document.querySelector('[data-pipe-branch="human_approval"]')?.hasAttribute("data-dimmed"),
    ).toBe(true);
    expect(tile("human_approval")?.hasAttribute("data-dimmed")).toBe(true);
    expect(tile("action_llm")?.hasAttribute("data-dimmed")).toBe(true);
    expect(document.querySelector("[data-slip]")?.closest("[data-dimmed]")).toBeNull();
    for (const belt of document.querySelectorAll("[data-pipe-after]")) {
      expect(belt.hasAttribute("data-dimmed")).toBe(true);
    }
    fireEvent.click(beatButton("tool_refund"));
    expect(document.querySelectorAll("[data-dimmed]")).toHaveLength(0);
  });

  it("marks the faulted toy and the belt after it", () => {
    const keys = columns(l1).map((col) => col.join("+"));
    const at = keys.indexOf("chunker");
    const { rerender } = render(
      <MachineMap
        env={l1}
        bench={starter(l1)}
        onChange={() => undefined}
        disabled={false}
        states={{ chunker: "error" }}
        highlight={null}
        answer={null}
      />,
    );
    const faults = [...document.querySelectorAll("[data-fault]")];
    expect(faults).toHaveLength(1);
    expect(faults[0]).toBe(tile("chunker"));
    expect(faults[0]?.getAttribute("class")?.split(/\s+/)).toContain("motion-safe:animate-shake");
    const belts = [...document.querySelectorAll("[data-pipe-after]")];
    expect(belts).toHaveLength(keys.length - 1);
    for (const belt of belts) {
      const index = keys.indexOf(belt.getAttribute("data-pipe-after") ?? "");
      expect(belt.hasAttribute("data-pipe-fault"), `belt after ${keys[index]}`).toBe(index >= at);
    }
    const cut = document.querySelector("[data-pipe-fault]");
    expect(cut?.getAttribute("class")).toContain("stroke-danger");
    expect(cut?.getAttribute("class")).toContain("stroke-dasharray");

    rerender(
      <MachineMap
        env={l1}
        bench={starter(l1)}
        onChange={() => undefined}
        disabled={false}
        states={{ chunker: "idle" }}
        highlight={null}
        answer={null}
      />,
    );
    expect(document.querySelectorAll("[data-fault]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-pipe-fault]")).toHaveLength(0);
  });

  it("carries a desk fault down the tool branch too, and a branch fault only past itself", () => {
    const w1 = testEnv("direct-injection");
    const branchBelts = () =>
      [...document.querySelectorAll("[data-pipe-branch]")].map((b) =>
        b.hasAttribute("data-pipe-fault"),
      );
    const props = {
      env: w1,
      bench: setAttached(starter(w1), "human_approval", true),
      onChange: () => undefined,
      disabled: false,
      highlight: null,
      answer: null,
    } as const;
    const { rerender } = render(<MachineMap {...props} states={{ action_llm: "error" }} />);
    expect(branchBelts()).toEqual([true, true]);
    rerender(<MachineMap {...props} states={{ human_approval: "error" }} />);
    expect(document.querySelectorAll("[data-fault]")).toHaveLength(1);
    // The first branch belt runs into the faulted bell; only the belt past it is cut.
    expect(branchBelts()).toEqual([false, true]);
    for (const belt of document.querySelectorAll("[data-pipe-after]")) {
      expect(belt.hasAttribute("data-pipe-fault")).toBe(false);
    }
    // The last toy of the branch has nothing past it; neither has the output, off the branch.
    rerender(<MachineMap {...props} states={{ tool_refund: "error" }} />);
    expect(branchBelts()).toEqual([false, false]);
    rerender(<MachineMap {...props} states={{ output: "error" }} />);
    expect(branchBelts()).toEqual([false, false]);
  });

  it("faults a guard only when its stop was wrong", () => {
    const w1 = testEnv("direct-injection");
    const run = replay(parseSse(readText("e2e", "data", "run-w1-reference.sse")));
    // wt-w1-t03 is a trap the net (Lưới cụm từ) rightly stops.
    const followed = run?.cases.find((c) => c.id === "wt-w1-t03");
    if (!run || !followed) throw new Error("the recorded W1 run does not replay");
    const props = {
      env: w1,
      bench: setAttached(starter(w1), "pattern_guard", true),
      onChange: () => undefined,
      disabled: false,
      highlight: null,
      states: { pattern_guard: "passed" },
      view: { run, followed, gold: null },
    } as const;
    const markOf = () => tile("pattern_guard")?.querySelector("[data-tile-mark]");
    const { rerender } = render(<MachineMap {...props} answer="pass" />);
    expect(document.querySelectorAll("[data-gauge-stop]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-fault]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-pipe-fault]")).toHaveLength(0);
    // A right stop is a pass, and says so.
    expect(markOf()?.getAttribute("data-tile-mark")).toBe("pass");
    expect(tile("pattern_guard")?.getAttribute("aria-label")).toBe("Lưới cụm từ: Đạt");

    // The same stop on a case that should have been served: the guard is at fault.
    rerender(<MachineMap {...props} answer="fail" />);
    expect(document.querySelectorAll("[data-fault]")).toHaveLength(1);
    expect(tile("pattern_guard")?.hasAttribute("data-fault")).toBe(true);
    // It shakes and cuts the belts, so it must not wear a tick or say "đạt": a crossed square,
    // in the danger tone, and a label that says the stop was wrong.
    expect(markOf()?.getAttribute("data-tile-mark")).toBe("fail");
    expect(markOf()?.getAttribute("class")).toContain(TONE.error);
    expect(tile("pattern_guard")?.getAttribute("aria-label")).toBe("Lưới cụm từ: Đạt, chặn nhầm");
    const keys = columns(w1).map((col) => col.join("+"));
    for (const belt of document.querySelectorAll("[data-pipe-after]")) {
      const index = keys.indexOf(belt.getAttribute("data-pipe-after") ?? "");
      expect(belt.hasAttribute("data-pipe-fault")).toBe(index >= keys.indexOf("pattern_guard"));
    }
    // An unanswered board is no verdict.
    rerender(<MachineMap {...props} answer={null} />);
    expect(document.querySelectorAll("[data-fault]")).toHaveLength(0);
    expect(markOf()?.getAttribute("data-tile-mark")).toBe("pass");
    expect(tile("pattern_guard")?.getAttribute("aria-label")).toBe("Lưới cụm từ: Đạt");
  });

  it("dims nothing when the pressed beat is gone from the level", () => {
    const w1 = testEnv("direct-injection");
    const { rerender } = render(
      <MachineMap
        env={w1}
        bench={starter(w1)}
        onChange={() => undefined}
        disabled={false}
        states={{}}
        highlight={null}
        answer={null}
      />,
    );
    fireEvent.click(beatButton("tool_refund"));
    expect(document.querySelectorAll("[data-dimmed]").length).toBeGreaterThan(0);
    rerender(
      <MachineMap
        env={l1}
        bench={starter(l1)}
        onChange={() => undefined}
        disabled={false}
        states={{}}
        highlight={null}
        answer={null}
      />,
    );
    expect(document.querySelectorAll("[data-tile]").length).toBeGreaterThan(1);
    expect(document.querySelectorAll("[data-dimmed]")).toHaveLength(0);
  });

  it("narrates the beat in a bubble over the machine", () => {
    draw(l1, starter(l1));
    expect(document.querySelector("[data-beat-bubble]")).toBeNull();
    fireEvent.click(beatButton("context_packer"));
    expect(document.querySelector("[data-beat-bubble]")?.textContent).toBe("Đang đóng thùng…");
    // The library's guest rings; only the Watchtower desk's knocks.
    fireEvent.click(beatButton("input"));
    expect(beatButton("input").textContent).toBe("1 Khách rung chuông");
    expect(document.querySelector("[data-beat-bubble]")?.textContent).toBe("Khách rung chuông…");
  });
});

// Plan v0.7 3.4: the frame is cut to the highest tag, at about the margin the slab leaves at the
// other edges, and holds still: nothing done on the bench moves or resizes the machine.
describe("the machine's frame", () => {
  const w1 = testEnv("direct-injection");
  const levels = [l1, l2, l3, w1].map((env) => [env.level.id, env] as const);

  /** Every socket of the level filled, or every one emptied. */
  const sockets = (env: Env, on: boolean) =>
    OPTIONAL_SLOTS.filter((type) => isAllowed(env.level, type)).reduce(
      (bench, type) => setAttached(bench, type, on),
      starter(env),
    );
  const viewBox = () =>
    document.querySelector("[data-machine-figure] svg")?.getAttribute("viewBox") ?? "";
  /** Each tag's box as drawn, in drawing units. */
  const tags = () =>
    [...document.querySelectorAll("[data-callout] rect")].map((rect) => {
      const at = (name: string) => Number(rect.getAttribute(name));
      return {
        y: at("y"),
        x: at("x"),
        right: at("x") + at("width"),
        bottom: at("y") + at("height"),
      };
    });
  /** The frame's edges, from its viewBox. */
  const edges = () => {
    const [x = NaN, y = NaN, w = NaN, h = NaN] = viewBox().split(" ").map(Number);
    return { x, y, right: x + w, bottom: y + h };
  };
  /** The followed case of the level's own committed recording, its first visible one. */
  function recorded(env: Env): BenchRunView {
    const file = JSON.parse(readText("public", "runs", `${env.level.id}.json`)) as {
      events: { type: string }[];
    };
    const run = replay(file.events.map((e, i) => frame(i + 1, e.type as EventType, e)));
    const followed = run?.cases.find((c) => c.role === "visible");
    if (!run || !followed) throw new Error(`the recorded ${env.level.id} run does not replay`);
    return { run, followed, gold: null };
  }

  it.each(levels)("opens %s with about 14 units over its highest tag", (_, env) => {
    draw(env, starter(env));
    const room = Math.min(...tags().map((tag) => tag.y)) - edges().y;
    expect(room).toBeGreaterThanOrEqual(12);
    expect(room).toBeLessThanOrEqual(16);
  });

  it.each(levels)("holds every tag of %s inside the frame, sockets filled or empty", (_, env) => {
    for (const bench of [sockets(env, true), starter(env), sockets(env, false)]) {
      draw(env, bench);
      for (const seeThrough of [false, true]) {
        if (seeThrough) fireEvent.click(screen.getByRole("button", { name: "Nhìn xuyên" }));
        const box = edges();
        const drawn = tags();
        expect(drawn.length).toBeGreaterThan(0);
        for (const tag of drawn) {
          expect(tag.y).toBeGreaterThanOrEqual(box.y);
          expect(tag.x).toBeGreaterThanOrEqual(box.x);
          expect(tag.right).toBeLessThanOrEqual(box.right);
          expect(tag.bottom).toBeLessThanOrEqual(box.bottom);
        }
      }
      cleanup();
    }
  });

  // The frame is the level's alone: were it cut to what is drawn now, the machine would jump
  // under the player's hand as a socket fills, the labels go off or a beat plays.
  it.each(levels)("keeps %s's frame whatever the bench shows", (_, env) => {
    const props = {
      env,
      onChange: () => undefined,
      disabled: false,
      states: {},
      highlight: null,
      answer: null,
    };
    const { rerender } = render(<MachineMap {...props} bench={starter(env)} />);
    const opened = viewBox();
    expect(opened).toMatch(/^-?\d+ -?\d+ \d+ \d+$/);
    rerender(<MachineMap {...props} bench={sockets(env, true)} />);
    expect(viewBox()).toBe(opened);
    rerender(<MachineMap {...props} bench={sockets(env, false)} />);
    expect(viewBox()).toBe(opened);
    rerender(<MachineMap {...props} bench={starter(env)} view={recorded(env)} answer="fail" />);
    expect(viewBox()).toBe(opened);
    for (const name of ["Nhãn", "Nhìn xuyên"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(viewBox(), name).toBe(opened);
    }
    for (const step of document.querySelectorAll<HTMLButtonElement>("[data-beat]")) {
      fireEvent.click(step);
      expect(viewBox(), step.dataset.beat).toBe(opened);
    }
  });
});

describe("zooming the machine", () => {
  it("zooms in by steps and back out, never below the whole machine in view", () => {
    draw(l3, starter(l3));
    const stage = document.querySelector("[data-zoom]");
    const zoomOut = screen.getByRole("button", { name: "Thu nhỏ" });
    const zoomIn = screen.getByRole("button", { name: "Phóng to" });
    expect(stage?.getAttribute("data-zoom")).toBe("100");
    expect(zoomOut).toHaveProperty("disabled", true);
    fireEvent.click(zoomIn);
    expect(stage?.getAttribute("data-zoom")).toBe("150");
    expect(stage?.getAttribute("style")).toContain("width: 150%");
    fireEvent.click(zoomIn);
    expect(stage?.getAttribute("data-zoom")).toBe("200");
    expect(zoomIn).toHaveProperty("disabled", true);
    fireEvent.click(zoomOut);
    expect(stage?.getAttribute("data-zoom")).toBe("150");
  });
});
