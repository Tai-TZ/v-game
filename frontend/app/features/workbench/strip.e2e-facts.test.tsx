/**
 * The numbers `e2e/workbench.spec.ts` hard-codes about the shipped static data, pinned here.
 *
 * Every "Điều 10 được chia thành 3 đoạn" in a Playwright spec is a fact somebody derived by
 * hand from `public/viz/*.json`. Derived wrong, it fails ten minutes into a CI run; derived
 * right and then invalidated by a content change, the same. Twice in one day that is exactly
 * what happened -- once from reading the wrong document in a throwaway probe, once from an edit
 * that silently never ran.
 *
 * So: assert them against the real data, in milliseconds, next to the code. A failure here
 * names the spec line to update.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { starterBench } from "./bench";

import { articleStrip, cutSentence, focusArticle, type VizData } from "./strip";
import { Strip } from "./Strip";
import { readText, testEnv } from "./test-fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

const l2 = JSON.parse(readText("public", "viz", "chunk-tuning.json")) as VizData;

/**
 * What the strip says for one variant, following L2's first sample case.
 *
 * `docId` and `inForce` are in here deliberately. The first version of this gate recorded only
 * the article NUMBER, and L2 ships two documents whose numbers collide (qcdt-2024 Điều 1-84,
 * qcdt-2019 Điều 1-16). Both Điều 10s cut into 3 pieces with 2 severed sentences, so when the
 * code resolved by number alone and drew the wrong document, every count here still matched.
 * A gate blind to the identity of the thing it measures is not a gate.
 */
function facts(variant: string) {
  const ref = focusArticle(l2, variant, "lib-l2-v01");
  if (ref === null) return null;
  const strip = articleStrip(l2, variant, ref.docId, ref.dieu);
  if (strip === null) return null;
  const severed = strip.cuts
    .map((at) => cutSentence(strip.text, strip.start, at))
    .filter((c) => c !== null);
  return {
    docId: ref.docId,
    dieu: ref.dieu,
    inForce: strip.inForce,
    pieces: strip.cuts.length + 1,
    severed: severed.length,
  };
}

describe("the facts e2e/workbench.spec.ts asserts about the blade's strip", () => {
  // Spec: 'Dải đoạn Điều 10', 3 piece rows, a «severed» cell, and the stale-document line.
  // The starter blade cuts the very sentence that answers Hà's question, in the superseded
  // document -- the whole lesson of the level, drawn before a single AI call.
  it("the L2 starter favours the superseded Điều 10, in 3 pieces, 2 severed", () => {
    expect(facts("co_dinh-128-0")).toEqual({
      docId: "qcdt-2019",
      dieu: 10,
      inForce: false,
      pieces: 3,
      severed: 2,
    });
  });

  // Spec: after picking Bám điều, khoản / 512 token / 10 %.
  it("the reference blade favours the in-force Điều 12, whole, nothing severed", () => {
    expect(facts("theo_dieu-512-10")).toEqual({
      docId: "qcdt-2024",
      dieu: 12,
      inForce: true,
      pieces: 1,
      severed: 0,
    });
  });

  // The lesson the level is built on, and the reason the strip is worth drawing at all.
  it("keeps the two apart: a fixed cut hides Điều 12 inside a piece filed under Điều 11", () => {
    expect(focusArticle(l2, "co_dinh-512-0", "lib-l2-v01")).toEqual({
      docId: "qcdt-2024",
      dieu: 11,
    });
  });
});
/**
 * The locators the spec uses, resolved against the real page in jsdom.
 *
 * The blade's knobs turned out to be chip radios -- `peer sr-only` inputs covered by their own
 * labels -- not the switches and sliders the first draft of the spec assumed, and Playwright's
 * `.check()` on such an input times out clicking a hidden 1px box. Both facts cost a CI round.
 */
describe("the locators e2e/workbench.spec.ts uses on the blade", () => {
  function page() {
    const l2 = testEnv("chunk-tuning");
    const starter = starterBench(l2);
    if (!starter) throw new Error("L2 starter is not drawable");
    return render(
      <MemoryRouter>
        <WorkbenchPage env={l2} starter={starter} back="/play/library" />
      </MemoryRouter>,
    );
  }

  afterEach(cleanup);

  it.each([
    [/Cách chia/, "Bám điều, khoản"],
    [/Cỡ đoạn/, "512 token"],
    [/Chồng lấp/, "10 %"],
  ])("group %s holds exactly one option reading %s", (group, option) => {
    page();
    const fieldset = screen.getByRole("group", { name: group });
    expect(within(fieldset).getAllByText(option, { exact: true })).toHaveLength(1);
  });

  // The reason the spec clicks words rather than the radio: the input cannot be clicked.
  it("hides the radio behind its own label, which is why .check() cannot be used", () => {
    page();
    const fieldset = screen.getByRole("group", { name: /Cách chia/ });
    const radio = within(fieldset).getAllByRole("radio")[0];
    expect(radio?.className).toContain("sr-only");
    expect(radio?.closest("label")).not.toBeNull();
  });
});

/**
 * What the spec reads out of the strip, in BOTH forms.
 *
 * Below 640 px `Viz` opens a figure as its table alternative, so on the mobile Playwright
 * project the bar and the two caption lines are not in the DOM at all -- and the table's own
 * sr-only <caption> carries the same words as the <figcaption>, which made a plain
 * getByText("Dải đoạn Điều 10") match two elements and fail Playwright's strict mode. Both
 * cost a CI round.
 */
describe("what the spec reads off the strip at both widths", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** jsdom has no matchMedia; `narrow` decides what every query answers (as Viz.test.tsx). */
  function viewport(narrow: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: narrow && query.includes("max-width"),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  }

  function drawStrip(variant: string, narrow: boolean) {
    viewport(narrow);
    const ref = focusArticle(l2, variant, "lib-l2-v01");
    if (ref === null) throw new Error(`${variant} ranks nothing`);
    const strip = articleStrip(l2, variant, ref.docId, ref.dieu);
    if (strip === null) throw new Error(`${variant} has no ${ref.docId} Điều ${ref.dieu}`);
    render(<Strip strip={strip} variant={variant} />);
    return ref.dieu;
  }

  it.each([false, true])("names the figure exactly once, narrow=%s", (narrow) => {
    const dieu = drawStrip("co_dinh-128-0", narrow);
    // By role, the way the spec locates it: the figcaption and the table's sr-only caption
    // hold identical words, so a text locator matches two and Playwright refuses to act.
    const figures = screen
      .getAllByRole("figure")
      .filter((f) => f.textContent.includes(`Dải đoạn Điều ${dieu}`));
    expect(figures).toHaveLength(1);
  });

  it("hides the drawn bar and its caption lines on a narrow screen", () => {
    drawStrip("co_dinh-128-0", true);
    expect(document.querySelectorAll("[data-strip-piece]")).toHaveLength(0);
    expect(screen.queryByText("Điều 10 được chia thành 3 đoạn.", { exact: false })).toBeNull();
    expect(screen.getByRole("table")).toBeDefined();
  });

  /**
   * The table, which is reachable at every width -- so the spec reads the facts from it. Call
   * once per render: the toggle renames itself to "Xem dạng hình" after the click.
   */
  function table(narrow: boolean) {
    const toTable = screen.queryByRole("button", { name: "Xem dạng bảng" });
    // Wide screens open the picture, so the toggle must be there to reach the table at all.
    expect(toTable === null).toBe(narrow);
    if (toTable) fireEvent.click(toTable);
    return screen.getByRole("table");
  }

  // The warning that tells L2's two Điều 10s apart. Put beside the drawing it was invisible on
  // a phone, because a narrow screen renders the table INSTEAD of the picture -- so the one
  // line that identifies the trap was the one line a phone never showed.
  it.each([false, true])("says the document is superseded at narrow=%s too", (narrow) => {
    drawStrip("co_dinh-128-0", narrow);
    const figure = screen.getAllByRole("figure")[0];
    expect(figure?.textContent).toContain("văn bản hết hiệu lực");
  });

  it.each([false, true])("says nothing of the sort for the in-force document, narrow=%s", (n) => {
    drawStrip("theo_dieu-512-10", n);
    expect(screen.getAllByRole("figure")[0]?.textContent).not.toContain("hết hiệu lực");
  });

  it.each([false, true])("gives the starter 3 piece rows and a severed cell, narrow=%s", (n) => {
    drawStrip("co_dinh-128-0", n);
    const rows = table(n);
    expect(rows.querySelectorAll("tr")).toHaveLength(4); // head + 3 pieces
    expect(rows.textContent).toContain("«");
  });

  it.each([false, true])("gives the reference blade 1 row and nothing severed, narrow=%s", (n) => {
    drawStrip("theo_dieu-512-10", n);
    const rows = table(n);
    expect(rows.querySelectorAll("tr")).toHaveLength(2); // head + the one piece
    expect(rows.textContent).not.toContain("«");
    expect(rows.textContent).toContain("Không");
  });
});
