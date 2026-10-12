import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CitationLedger } from "./CitationLedger";

afterEach(cleanup);

const item = (chunkId: string, rank: number) => ({
  chunk_id: chunkId,
  rank,
  score: 1 - rank / 100,
  doc_id: "quy-che",
  dieu: 10 + rank,
  khoan: [1],
  hieu_luc: true,
});

/** The cells of one stage row, in column order. */
const row = (stage: string) =>
  [...(document.querySelector(`[data-row="${stage}"]`)?.querySelectorAll("td") ?? [])].map(
    (td) => td as HTMLElement,
  );

const draw = (props: Partial<Parameters<typeof CitationLedger>[0]> = {}) =>
  render(
    <CitationLedger
      caseRole="visible"
      ranked={[item("a1", 1), item("b2", 2), item("c3", 3)]}
      included={["a1", "c3"]}
      cited={["a1", "zz"]}
      gold={null}
      {...props}
    />,
  );

describe("CitationLedger", () => {
  it("keeps every stage on the same column, so a dropped code leaves a hole", () => {
    draw();
    // One column per code, in rank order, with the fabricated code last.
    expect(row("pull").map((td) => td.dataset.id)).toEqual(["a1", "b2", "c3", "zz"]);
    expect(row("bin").map((td) => td.dataset.id)).toEqual(["a1", "b2", "c3", "zz"]);
    expect(row("cite").map((td) => td.dataset.id)).toEqual(["a1", "b2", "c3", "zz"]);
    // b2 was pulled and then left out: its bin cell is a marked gap, not c3 shifted left.
    expect(row("bin")[1]?.dataset.state).toBe("gap");
    expect(row("bin")[2]?.dataset.state).toBe("here");
  });

  it("marks a cited code the bin never held, in the words the stamps use", () => {
    draw();
    const ghost = row("cite")[3];
    expect(ghost?.dataset.state).toBe("ghost");
    expect(ghost?.querySelector("[class*='border-dashed']")).not.toBeNull();
    expect(ghost?.querySelector("svg")).not.toBeNull();
    expect(ghost?.textContent).toContain("không có trong thùng");
    // A code that was really in the bin must not look the same.
    const real = row("cite")[0];
    expect(real?.dataset.state).toBe("here");
    expect(real?.querySelector("[class*='border-dashed']")).toBeNull();
  });

  it("counts codes rather than sentences, and drops the clause it has no number for", () => {
    draw();
    expect(document.querySelector("[data-ledger-note]")?.textContent).toBe(
      "Trợ lý trích 2 mã: 1 có trong thùng, 1 không có.",
    );
    cleanup();
    draw({ cited: ["a1", "c3"] });
    expect(document.querySelector("[data-ledger-note]")?.textContent).toBe(
      "Trợ lý trích 2 mã: cả 2 đều có trong thùng.",
    );
  });

  it("marks the answer passage on the row that pulled it, and only when it may be shown", () => {
    draw({ gold: { chunks: ["c3"], ranks: {}, flags: [], visible: true } });
    expect(row("pull")[2]?.textContent).toContain("Đoạn đáp án");
    expect(row("pull")[0]?.textContent).not.toContain("Đoạn đáp án");
    // Once, on the row that pulled it: the bin and the answer rows say something else about
    // the same code, and repeating the marker three times says nothing new.
    expect(document.body.textContent.match(/Đoạn đáp án/g)).toHaveLength(1);
    expect(row("bin")[2]?.textContent).not.toContain("Đoạn đáp án");
    cleanup();
    draw({ gold: { chunks: ["c3"], ranks: {}, flags: [], visible: false } });
    expect(document.body.textContent).not.toContain("Đoạn đáp án");
  });

  it.each(["hidden", "trap"] as const)("draws nothing for a %s case", (role) => {
    // A hidden case's valid citation code points straight at the gold chunk (roadmap B0), so
    // lining its cited row up against its bin row would hand over where the answer sits.
    const { container } = draw({ caseRole: role });
    expect(container.innerHTML).toBe("");
  });

  it("draws nothing when the case neither pulled nor cited anything", () => {
    const { container } = draw({ ranked: [], included: [], cited: [] });
    expect(container.innerHTML).toBe("");
  });

  it("gives no chip a tab stop, because activating one does nothing", () => {
    // Same call as StarDome's sr-only list: no handler is wired, so a focusable chip would be
    // a stop that leads nowhere. The table is the thing a screen reader walks.
    draw();
    // Narrow to the cells: the scrolling wrapper around the table is focusable on purpose,
    // because there a tab stop is how a keyboard user scrolls.
    expect(document.querySelectorAll("td [tabindex], th [tabindex]")).toHaveLength(0);
  });
});

describe("the ledger scrolls sideways when there are many codes", () => {
  it("gives its scrolling wrapper a tab stop for the same reason", () => {
    const { container } = draw();
    const scroller = container.querySelector(".overflow-x-auto");
    expect(scroller?.getAttribute("tabindex")).toBe("0");
  });
});
