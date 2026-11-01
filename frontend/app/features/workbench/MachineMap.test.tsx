import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { setAttached, setParam, starterBench, type Bench, type Env } from "./bench";
import { beatLine, MachineMap } from "./MachineMap";
import type { BenchRunView } from "./BenchView";
import type { BlockState } from "./run";
import type { BlockType, EventType } from "./schema";
import { frame, readText, replay, testEnv } from "./test-fixtures";

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
