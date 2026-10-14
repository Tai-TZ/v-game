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

import { describe, expect, it } from "vitest";

import { articleStrip, cutSentence, focusArticle, type VizData } from "./strip";
import { readText } from "./test-fixtures";

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

  // The spec drives radios, not switches or sliders (which is what the first draft assumed).
  // These are the labels it clicks, straight out of the shipped block schema.
  it("offers the blade's options under the words the spec clicks", () => {
    const blocks = JSON.parse(readText("e2e", "data", "blocks.json")) as {
      blocks: { type: string; params: { properties: Record<string, { enum?: unknown[] }> } }[];
    };
    const chunker = blocks.blocks.find((b) => b.type === "chunker");
    expect(chunker?.params.properties.strategy?.enum).toEqual(["co_dinh", "theo_dieu"]);
    expect(chunker?.params.properties.chunk_size?.enum).toContain(512);
    expect(chunker?.params.properties.overlap_pct?.enum).toContain(10);
  });
});
