import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, setAttached, setParam, starterBench, type Bench } from "./bench";
import { BenchSection } from "./BenchView";
import { testEnv } from "./test-fixtures";
import { validateGraph } from "./validate";

const l3 = testEnv("article-number-lookup");

function Bench({ bench }: { bench: Bench }) {
  const graph = graphFromBench(l3, bench);
  return (
    <BenchSection
      env={l3}
      bench={bench}
      graph={graph}
      onChange={() => undefined}
      locked={false}
      issues={validateGraph(l3, graph)}
      highlight={null}
      view={null}
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
});
