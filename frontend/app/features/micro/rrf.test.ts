import { describe, expect, it } from "vitest";

import {
  ANSWER,
  FUSED,
  fuseRrf,
  gradeOrder,
  LISTS,
  PASSAGES,
  RRF,
  RRF_K,
  rawSumOrder,
  type RankedList,
} from "./rrf";

/**
 * "Tự tay trộn RRF" (lesson-visualization: vi mô, Thư viện, L3): the fused order is computed
 * from the two lists, never typed, and checked here against the formula itself.
 */

/** The formula, written out apart from the code under test: Σ over lists of 1 / (k + rank). */
function formula(lists: readonly RankedList[], passage: string, k: number) {
  let sum = 0;
  for (const list of lists) {
    const index = list.hits.findIndex((hit) => hit.passage === passage);
    if (index >= 0) sum += 1 / (k + index + 1);
  }
  return sum;
}

const list = (id: RankedList["id"], passages: string[]): RankedList => ({
  id,
  name: id,
  method: id,
  hits: passages.map((passage, index) => ({ passage, score: 10 - index })),
});

describe("fuseRrf, as the engine's fusion block runs it", () => {
  it("uses k = 60, the fusion block's default", () => {
    expect(RRF_K).toBe(60);
  });

  it("gives each rank a chip of 1/(k + rank), counting ranks from 1", () => {
    for (const fused of FUSED) {
      for (const chip of fused.chips) expect(chip.value).toBe(1 / (RRF_K + chip.rank));
    }
    const top = LISTS.map((l) => l.hits[0]?.passage);
    for (const passage of top) {
      const chips = FUSED.find((f) => f.passage === passage)?.chips ?? [];
      expect(chips.map((c) => c.rank)).toContain(1);
    }
  });

  it("sums each passage's chips over both lists, as the formula says", () => {
    expect(FUSED).toHaveLength(PASSAGES.length);
    for (const fused of FUSED) {
      expect(fused.score, fused.passage).toBeCloseTo(formula(LISTS, fused.passage, RRF_K), 15);
    }
  });

  it("gives a passage missing from one list that list's nothing", () => {
    const fused = fuseRrf([list("vom_sao", ["b", "a"]), list("tu_ngan_keo", ["b"])], 60);
    expect(fused.find((f) => f.passage === "a")).toMatchObject({
      score: 1 / 62,
      chips: [{ list: "vom_sao", rank: 2 }],
    });
    expect(fused.find((f) => f.passage === "b")?.chips).toHaveLength(2);
  });

  it("orders by the sum, then breaks a tie by passage id like the engine", () => {
    const fused = fuseRrf([list("vom_sao", ["b", "c"]), list("tu_ngan_keo", ["a", "c"])], 60);
    // b and a both get 1/61 alone; c gets 1/62 twice and wins.
    expect(fused.map((f) => f.passage)).toEqual(["c", "a", "b"]);
  });

  it("puts the lesson's lists in the order the formula gives", () => {
    const byFormula = PASSAGES.map((p) => p.id).sort(
      (a, b) => formula(LISTS, b, RRF_K) - formula(LISTS, a, RRF_K) || (a < b ? -1 : 1),
    );
    expect(FUSED.map((f) => f.passage)).toEqual(byFormula);
  });
});

describe("the lesson's two lists", () => {
  const scores = (id: RankedList["id"]) =>
    LISTS.find((l) => l.id === id)?.hits.map((h) => h.score) ?? [];

  it("score on scales that cannot be added: cosine under 1, BM25 far above", () => {
    expect(Math.max(...scores("vom_sao"))).toBeLessThan(1);
    expect(Math.min(...scores("tu_ngan_keo"))).toBeGreaterThan(1);
    for (const l of LISTS) {
      expect(l.hits).toHaveLength(5);
      const s = l.hits.map((h) => h.score);
      expect(s, l.id).toEqual([...s].sort((a, b) => b - a));
    }
  });

  it("have no tie after fusion, so the player never needs the id rule", () => {
    expect(new Set(FUSED.map((f) => f.score)).size).toBe(FUSED.length);
  });

  it("make the answer win without topping either list", () => {
    expect(FUSED[0]?.passage).toBe(ANSWER);
    for (const l of LISTS) {
      expect(l.hits[0]?.passage, l.id).not.toBe(ANSWER);
      expect(
        l.hits.some((h) => h.passage === ANSWER),
        l.id,
      ).toBe(true);
    }
  });

  it("rank every passage both searches found above every passage only one found", () => {
    const both = FUSED.filter((f) => f.chips.length === 2);
    const one = FUSED.filter((f) => f.chips.length === 1);
    expect(one.length).toBeGreaterThan(0);
    expect(FUSED).toEqual([...both, ...one]);
  });

  it("would let the bigger scale decide alone if the raw scores were added", () => {
    const bm25 = LISTS.find((l) => l.id === "tu_ngan_keo")?.hits.map((h) => h.passage) ?? [];
    const raw = rawSumOrder(LISTS);
    expect(raw.slice(0, bm25.length).map((r) => r.passage)).toEqual(bm25);
    expect(raw[0]?.passage).not.toBe(FUSED[0]?.passage);
  });
});

describe("gradeOrder", () => {
  const right = FUSED.map((f) => f.passage);

  it("marks the fused order right, place by place", () => {
    const grade = gradeOrder(right);
    expect(grade).toMatchObject({ right: right.length, total: right.length });
    expect(grade?.places.every((p) => p.verdict === "right")).toBe(true);
  });

  it("marks two swapped passages wrong and says where each belongs", () => {
    const swapped = [right[1], right[0], ...right.slice(2)] as string[];
    const grade = gradeOrder(swapped);
    expect(grade?.right).toBe(right.length - 2);
    expect(grade?.places[0]).toMatchObject({ passage: right[1], verdict: "wrong", belongs: 2 });
    expect(grade?.places[1]).toMatchObject({ passage: right[0], verdict: "wrong", belongs: 1 });
  });

  it("is not ready until every passage has a place, once", () => {
    expect(gradeOrder(right.slice(1))).toBeNull();
    expect(gradeOrder([right[0], ...right.slice(0, -1)] as string[])).toBeNull();
  });

  it("names itself for the route and the brief", () => {
    expect(RRF).toMatchObject({
      id: "tu-tay-tron-rrf",
      zone: "library",
      before: "article-number-lookup",
    });
  });
});
