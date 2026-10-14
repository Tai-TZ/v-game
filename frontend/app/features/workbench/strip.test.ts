import { describe, expect, it } from "vitest";

import { articleStrip, cutSentence, type VizData } from "./strip";

/** One article per 100 chars, cuts wherever the test says. */
const data = (text: string, articles: [number, number, number][], cuts: [number, number][]) =>
  ({
    corpus: { d: text },
    articles: { d: articles },
    strips: { v: cuts.map(([s, e]) => ["d", 0, [], s, e, e - s, true]) },
    ranks: {},
  }) as unknown as VizData;

describe("articleStrip", () => {
  const text = "A".repeat(300);

  it("takes every chunk overlapping the article, not the ones labelled with it", () => {
    // The lesson of L2: a 0-100 cut running into Điều 2's range belongs on Điều 2's strip even
    // though its first token sits in Điều 1, which is the only thing `dieu` records.
    const strip = articleStrip(
      data(
        text,
        [
          [1, 0, 80],
          [2, 80, 200],
        ],
        [
          [0, 100],
          [100, 200],
        ],
      ),
      "v",
      2,
    );
    expect(strip?.chunks.map((c) => [c.start, c.end])).toEqual([
      [0, 100],
      [100, 200],
    ]);
  });

  it("leaves out a chunk that stops before the article starts", () => {
    const strip = articleStrip(
      data(
        text,
        [
          [1, 0, 100],
          [2, 100, 200],
        ],
        [
          [0, 100],
          [100, 200],
        ],
      ),
      "v",
      2,
    );
    expect(strip?.chunks.map((c) => c.start)).toEqual([100]);
  });

  it("carries the article's own text, so the strip can draw the cuts against it", () => {
    const strip = articleStrip(data("0123456789", [[1, 2, 8]], [[0, 10]]), "v", 1);
    expect(strip?.text).toBe("234567");
    expect(strip?.start).toBe(2);
  });

  it("has nothing to draw for an article the level's corpus does not hold", () => {
    expect(articleStrip(data(text, [[1, 0, 100]], [[0, 100]]), "v", 99)).toBeNull();
  });

  it("has nothing to draw for a variant nobody built", () => {
    expect(articleStrip(data(text, [[1, 0, 100]], [[0, 100]]), "nope", 1)).toBeNull();
  });
});

describe("cutSentence", () => {
  const text = "Câu một. Câu hai dài hơn. Câu ba.";

  it("finds the sentence a cut lands inside, and says where it was cut", () => {
    // "Câu hai dài hơn." runs 9..25; cutting at 16 lands inside it.
    const cut = cutSentence(text, 0, 16);
    expect(cut?.text).toBe("Câu hai dài hơn.");
    expect(cut?.at).toBe(16);
  });

  it("says nothing when the cut falls on a sentence boundary, which is the good case", () => {
    expect(cutSentence(text, 0, 9)).toBeNull();
  });

  // The reader got the whole sentence bar its full stop; calling that severed would paint a
  // cut red that cost nothing.
  it("says nothing for a cut that falls just before the full stop", () => {
    expect(cutSentence(text, 0, 24)).toBeNull();
  });

  it("says nothing for a cut at the very end of the text", () => {
    expect(cutSentence(text, 0, text.length)).toBeNull();
  });

  it("counts a newline as a boundary: a clause break is not a severed sentence", () => {
    expect(cutSentence("Khoản một\nKhoản hai", 0, 10)).toBeNull();
  });

  it("reads offsets against the whole document, not the slice handed in", () => {
    const strip = cutSentence(text.slice(9), 9, 16);
    expect(strip?.text).toBe("Câu hai dài hơn.");
  });
});
