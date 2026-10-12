import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, starterBench } from "./bench";
import { Debrief } from "./Debrief";
import { EMPTY_SLIP, type Slip } from "./guess";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";

afterEach(cleanup);

const l1 = testEnv("grounded-citation");
const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
const finishedAt = short.findIndex((f) => f.event === "run.finished");
const run = (() => {
  const r = replay(short.slice(0, finishedAt + 1));
  if (!r) throw new Error("the short L1 run does not replay");
  return r;
})();
const starter = starterBench(l1);
if (!starter) throw new Error("L1 starter is not drawable");
const graph = graphFromBench(l1, starter);

const slip: Slip = { ...EMPTY_SLIP, passed: 2 };

function draw(props: Partial<Parameters<typeof Debrief>[0]> = {}) {
  return render(
    <Debrief
      env={l1}
      run={run}
      slip={null}
      graph={graph}
      whyIndex={null}
      ask={null}
      onPick={() => undefined}
      {...props}
    />,
  );
}

describe("Debrief", () => {
  it("auto-fills the first two lines from the slip's own grade, no new typing", () => {
    draw({ slip });
    expect(screen.getByText(/Bạn đoán 2 câu đạt/)).toBeDefined();
  });

  it("has no first two lines without a slip", () => {
    draw({ slip: null });
    expect(screen.queryByText(/Bạn đoán/)).toBeNull();
  });

  it("reports which reason the player picked, by its text, not by a placeholder", () => {
    const menu = { options: ["Model quên trích dẫn", "Thùng bị cắt"] as [string, ...string[]] };
    draw({ ask: { c: null, menu }, whyIndex: 1 });
    expect(screen.getByText(/Thùng bị cắt/)).toBeDefined();
  });

  it("says nothing about line 3 when the player has not answered yet", () => {
    const menu = { options: ["Model quên trích dẫn"] as [string, ...string[]] };
    draw({ ask: { c: null, menu }, whyIndex: null });
    expect(screen.queryByText(/Model quên trích dẫn/)).toBeNull();
  });

  it("offers an enum for line 4, and records exactly the option picked", () => {
    // L1's starter has no search block attached yet, so "Gắn Vòm Sao" is on offer.
    const picks: unknown[] = [];
    draw({ onPick: (p) => picks.push(p) });
    fireEvent.click(screen.getByRole("radio", { name: "Gắn Vòm Sao" }));
    expect(picks).toEqual([{ next: { type: "vector_search", direction: "on" } }]);
  });

  it("offers no option the level disallows", () => {
    // L1's allowed_blocks has only vector_search as an optional search block.
    draw();
    expect(screen.queryByRole("radio", { name: /Tủ ngăn kéo/ })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Kính lúp/ })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Phễu/ })).toBeNull();
  });

  it("carries no aria-live region of its own", () => {
    const { container } = draw({ slip });
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(0);
  });
});
