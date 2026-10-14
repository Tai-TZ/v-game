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

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { starterBench } from "./bench";

import { articleStrip, cutSentence, focusArticle, type VizData } from "./strip";
import { readText, testEnv } from "./test-fixtures";
import { WorkbenchPage } from "./WorkbenchPage";

const l2 = JSON.parse(readText("public", "viz", "chunk-tuning.json")) as VizData;

/** What the strip says for one variant, following L2's first sample case. */
function facts(variant: string) {
  const dieu = focusArticle(l2, variant, "lib-l2-v01");
  if (dieu === null) return null;
  const strip = articleStrip(l2, variant, dieu);
  if (strip === null) return null;
  const severed = strip.chunks
    .map((c) => cutSentence(strip.text, strip.start, c.end))
    .filter((c) => c !== null);
  return { dieu, pieces: strip.chunks.length, severed: severed.length };
}

describe("the facts e2e/workbench.spec.ts asserts about the blade's strip", () => {
  // Spec: 'Dải đoạn Điều 10', 'Điều 10 được chia thành 3 đoạn.', 'Câu bị cắt ngang:' visible.
  it("the L2 starter (co_dinh/128/0) favours Điều 10, in 3 pieces, with a severed sentence", () => {
    expect(facts("co_dinh-128-0")).toEqual({ dieu: 10, pieces: 3, severed: 2 });
  });

  // Spec: after picking Bám điều, khoản / 512 token / 10 %.
  it("the reference blade (theo_dieu/512/10) favours Điều 12, whole, with nothing severed", () => {
    expect(facts("theo_dieu-512-10")).toEqual({ dieu: 12, pieces: 1, severed: 0 });
  });

  // The lesson the level is built on, and the reason the strip is worth drawing at all.
  it("keeps the two apart: a fixed cut hides Điều 12 inside a piece filed under Điều 11", () => {
    expect(focusArticle(l2, "co_dinh-512-0", "lib-l2-v01")).toBe(11);
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
