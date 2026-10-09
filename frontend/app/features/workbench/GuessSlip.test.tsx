import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { graphFromBench, starterBench } from "./bench";
import { EMPTY_SLIP, type Slip } from "./guess";
import { GuessSlip } from "./GuessSlip";
import { Results } from "./Results";
import type { RunView } from "./run";
import { frame, parseSse, readText, replay, testEnv } from "./test-fixtures";

const l1 = testEnv("grounded-citation");
const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
const gradedAt = short.findIndex((f) => f.event === "case.graded");
const finishedAt = short.findIndex((f) => f.event === "run.finished");

/** The short L1 run (v01 = #1, t01 = #2) with v01 failing for want of a citation. */
function citeMissingRun(diagnosis: object[] = []): RunView {
  const frames = short.slice(0, finishedAt).map((f, index) =>
    index === gradedAt
      ? frame(f.id, "case.graded", {
          case: "lib-l1-v01",
          status: "ok",
          passed: false,
          counted: true,
          criteria: { points: true, cited: false, no_fabrication: true, no_forbidden: true },
          labels: ["cite_missing"],
        })
      : f,
  );
  const run = replay([
    ...frames,
    frame(99, "run.finished", { report: { gold: {}, diagnosis }, models: {} }),
  ]);
  if (!run) throw new Error("no run");
  return run;
}

function show(run: RunView, slip: Slip | null) {
  const bench = starterBench(l1);
  if (!bench) throw new Error("starter");
  const graph = graphFromBench(l1, bench);
  render(
    <MemoryRouter>
      <Results
        env={l1}
        run={run}
        changed={false}
        runGraph={graph}
        graph={graph}
        backTo="/play/library"
        slip={slip}
        onEdit={() => undefined}
        onFocusSlot={() => undefined}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("GuessSlip", () => {
  function Harness({ onSlip }: { onSlip: (slip: Slip) => void }) {
    const [slip, setSlip] = useState<Slip>(EMPTY_SLIP);
    return (
      <GuessSlip
        env={l1}
        slip={slip}
        onChange={(next) => {
          setSlip(next);
          onSlip(next);
        }}
      />
    );
  }

  it("takes a count, a sure bet on a sample case and picked failures, one click each", () => {
    let last: Slip = EMPTY_SLIP;
    render(<Harness onSlip={(slip) => (last = slip)} />);
    // L1: 8 normal + 2 trap = 10 cases, 3 of them samples.
    const count = screen.getByRole("group", { name: "Đạt mấy/10?" });
    expect(within(count).getAllByRole("radio")).toHaveLength(11);
    fireEvent.click(within(count).getByRole("radio", { name: "7" }));

    // No confidence before a call is made; "Đoán" by default once it is.
    expect(screen.queryByRole("group", { name: /Mức chắc/ })).toBeNull();
    const first = screen.getByRole("group", { name: "Câu #1 · Câu mẫu" });
    fireEvent.click(within(first).getByRole("radio", { name: "Trượt" }));
    expect(within(first).getByRole("radio", { name: "Đoán" })).toHaveProperty("checked", true);
    fireEvent.click(within(first).getByRole("radio", { name: "Chắc" }));

    // Hidden and trap cases by number only: #4–#10.
    const failing = screen.getByRole("group", { name: "Câu nào trượt?" });
    expect(within(failing).getAllByRole("checkbox")).toHaveLength(7);
    fireEvent.click(within(failing).getByRole("checkbox", { name: "Câu #9" }));
    fireEvent.click(within(failing).getByRole("checkbox", { name: "Câu #5" }));

    expect(last).toEqual({
      passed: 7,
      failing: [5, 9],
      bets: { "lib-l1-v01": { pass: false, confidence: "high" } },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xóa phiếu" }));
    expect(last).toEqual(EMPTY_SLIP);
    expect(screen.queryByRole("button", { name: "Xóa phiếu" })).toBeNull();
  });
});

describe("Results with the guess loop", () => {
  it("grades the slip after run.finished and shows a surprise for a sure bet gone wrong", () => {
    show(citeMissingRun(), {
      passed: 2,
      failing: [],
      bets: { "lib-l1-v01": { pass: true, confidence: "high" } },
    });
    const slip = screen.getByRole("region", { name: "Phiếu đoán của bạn" });
    expect(slip.textContent).toContain("Bạn đoán 2 câu đạt; thực tế 1/2 câu đạt. Lệch 1 câu.");
    expect(slip.textContent).toContain("Đoán sai · câu #1: bạn đoán đạt (chắc).");
    expect(slip.textContent).toContain(
      "Bằng chứng: Trượt · chưa đạt: Có nguồn · Không trích nguồn.",
    );
    expect(screen.getByText("Bất ngờ ở câu #1")).toBeDefined();
    expect(screen.getByText("Bạn chắc câu này sẽ đạt, nhưng nó trượt.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Xem bằng chứng ở câu #1" }).getAttribute("href")).toBe(
      "#cau-1",
    );
  });

  it("shows no slip section without a slip, and no surprise for an unsure miss", () => {
    show(citeMissingRun(), null);
    expect(screen.queryByRole("region", { name: "Phiếu đoán của bạn" })).toBeNull();
    cleanup();
    show(citeMissingRun(), {
      ...EMPTY_SLIP,
      bets: { "lib-l1-v01": { pass: true, confidence: "medium" } },
    });
    expect(screen.queryByText(/Bất ngờ/)).toBeNull();
  });

  it("asks 'Vì sao câu #1 sai?' before the diagnosis; any answer opens it", () => {
    const lesson = { case: "lib-l1-v01", flag: "llm.cite_missing", message_vi: "Câu #1 thiếu mã." };
    show(citeMissingRun([lesson]), null);
    const menu = screen.getByRole("group", { name: "Vì sao câu #1 sai?" });
    expect(screen.queryByText("Câu #1 thiếu mã.")).toBeNull();
    fireEvent.click(within(menu).getByRole("radio", { name: "Model quên trích dẫn" }));
    expect(screen.getByText(/^Chưa đúng\. Lý do là: Các đoạn trong thùng không mang mã/)).toBe(
      document.activeElement,
    );
    expect(screen.getByText("Câu #1 thiếu mã.")).toBeDefined();
    expect(within(menu).getByRole("radio", { name: "Thùng bị cắt" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("lets the player skip the menu straight to the diagnosis", () => {
    const lesson = { case: "lib-l1-v01", flag: "llm.cite_missing", message_vi: "Câu #1 thiếu mã." };
    show(citeMissingRun([lesson]), null);
    fireEvent.click(screen.getByRole("button", { name: "Xem chẩn đoán luôn" }));
    expect(screen.queryByRole("group", { name: "Vì sao câu #1 sai?" })).toBeNull();
    expect(screen.getByText("Câu #1 thiếu mã.")).toBeDefined();
    expect(document.activeElement?.id).toBe("wb-diagnosis-title");
  });

  it("asks nothing when every case passed", () => {
    const run = replay(short);
    if (!run) throw new Error("no run");
    show(run, null);
    expect(screen.queryByRole("group", { name: /Vì sao/ })).toBeNull();
    expect(screen.getByText("Không có câu nào cần chẩn đoán.")).toBeDefined();
  });
});
