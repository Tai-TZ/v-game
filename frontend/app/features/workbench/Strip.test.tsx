import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { STRIP_VI, VIZ_STAMP } from "./copy";
import { Strip } from "./Strip";
import { articleStrip, cutSentence, type VizData } from "./strip";
import { readText } from "./test-fixtures";

afterEach(cleanup);

const l2 = JSON.parse(readText("public", "viz", "chunk-tuning.json")) as VizData;

/** The real article the level's story turns on, cut by a real variant. */
function draw(variant: string, docId = "qcdt-2024", dieu = 12) {
  const strip = articleStrip(l2, variant, docId, dieu);
  if (!strip) throw new Error(`${variant} has no ${docId} Điều ${dieu}`);
  render(<Strip strip={strip} variant={variant} />);
  return strip;
}

const cuts = () => document.querySelectorAll("[data-strip-cut]");
const pieces = () => document.querySelectorAll("[data-strip-piece]");

describe("Strip", () => {
  it("draws one more piece than there are cuts inside the article", () => {
    // co_dinh-256-0 cuts Điều 12 in two; theo_dieu keeps it whole. Both are read off the
    // shipped data, so a change to the chunker shows up here rather than in a stale fixture.
    const cut = draw("co_dinh-256-0");
    expect(pieces()).toHaveLength(cut.cuts.length + 1);
    expect(cut.cuts.length).toBeGreaterThan(0);
    cleanup();
    const whole = draw("theo_dieu-512-10");
    expect(whole.cuts).toEqual([]);
    expect(pieces()).toHaveLength(1);
  });

  // With overlap on, a chunk can lap an article's tail without cutting it. Counting overlaps
  // drew a boundary the blade never made and called a whole article "2 đoạn".
  it("calls an article whole when chunks only lap it, drawing no cut at all", () => {
    draw("co_dinh-512-10", "qcdt-2019", 10);
    expect(pieces()).toHaveLength(1);
    expect(cuts()).toHaveLength(0);
    expect(screen.getByText("Điều 10 được chia thành 1 đoạn.", { exact: false })).toBeDefined();
  });

  // L2's corpus holds both the in-force and the superseded document, and their Điều numbers
  // repeat. Drawing the stale one without saying so is the stale_doc trap drawn as the answer.
  it("says when the article it drew comes from the superseded document", () => {
    draw("co_dinh-128-0", "qcdt-2019", 10);
    expect(screen.getByText(STRIP_VI.stale)).toBeDefined();
    cleanup();
    draw("co_dinh-128-0", "qcdt-2024", 10);
    expect(screen.queryByText(STRIP_VI.stale)).toBeNull();
  });

  it("marks the cut that severs a sentence, and quotes the sentence", () => {
    const strip = draw("co_dinh-256-0");
    const severed = strip.cuts
      .map((at) => cutSentence(strip.text, strip.start, at))
      .find((c) => c !== null);
    expect(severed).toBeDefined();
    expect(cuts()).toHaveLength(1);
    expect(cuts()[0]?.getAttribute("data-strip-cut")).toBe("severed");
    expect(screen.getByText(severed?.text ?? "never", { exact: false })).toBeDefined();
  });

  it("draws no severed cut when the variant respects the article", () => {
    draw("theo_dieu-512-10");
    expect(document.querySelectorAll('[data-strip-cut="severed"]')).toHaveLength(0);
    expect(screen.queryByText(STRIP_VI.severedLegend, { exact: false })).toBeNull();
  });

  it("says how many pieces the article became, in words as well as in the picture", () => {
    draw("co_dinh-256-0");
    expect(screen.getByText(STRIP_VI.pieces(12, 2), { exact: false })).toBeDefined();
  });

  // §8.4: the data is computed from the shipped index, not measured from the player's run.
  it("stamps the figure as precomputed from the index, never as the player's measurement", () => {
    draw("co_dinh-256-0");
    expect(screen.getByText(VIZ_STAMP.index, { exact: false })).toBeDefined();
    expect(screen.queryByText(VIZ_STAMP.run, { exact: false })).toBeNull();
  });

  it("offers the table alternative every figure owes a reader", () => {
    draw("co_dinh-256-0");
    const figure = document.querySelector("[data-vg-viz]");
    expect(figure?.getAttribute("data-vg-viz")).toBe("both");
    fireEvent.click(screen.getByRole("button", { name: /Xem dạng bảng/ }));
    expect(document.querySelectorAll("table")).toHaveLength(1);
  });

  // Pieces are now spans between cuts inside the article, so none can leave the bar by
  // construction -- but a regression that went back to drawing whole chunks would, and real
  // data overshoots constantly (a 128-token cut covers Điều 2 from -1% to 102% of its span).
  it("keeps every drawn piece inside the bar", () => {
    draw("co_dinh-128-0", "qcdt-2024", 2);
    const edges = [...pieces()].map((el) => {
      const { left, width } = (el as HTMLElement).style;
      return { left: Number.parseFloat(left), width: Number.parseFloat(width) };
    });
    expect(edges.length).toBeGreaterThan(0);
    for (const { left, width } of edges) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100.001);
    }
  });

  // A table with no caption is a grid of numbers a screen reader reaches with no idea what it
  // is of -- and below 640 px this table IS the figure, not an alternative to it.
  it("names its table, which is the whole figure on a narrow screen", () => {
    draw("co_dinh-256-0");
    fireEvent.click(screen.getByRole("button", { name: /Xem dạng bảng/ }));
    const table = screen.getByRole("table");
    expect(table.querySelector("caption")?.textContent).toBe(STRIP_VI.caption(12));
  });

  it("answers axe's structural rules", async () => {
    const strip = articleStrip(l2, "co_dinh-256-0", "qcdt-2024", 12);
    if (!strip) throw new Error("L2 has no Điều 12");
    const { container } = render(<Strip strip={strip} variant="co_dinh-256-0" />);
    const result = await axe.run(container, {
      runOnly: {
        type: "rule",
        values: ["role-img-alt", "image-alt", "aria-allowed-attr", "nested-interactive", "list"],
      },
    });
    expect(result.passes.length).toBeGreaterThan(0);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
