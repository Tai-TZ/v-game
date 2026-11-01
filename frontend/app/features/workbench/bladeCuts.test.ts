import { describe, expect, it } from "vitest";

import { bladeCuts } from "./bladeCuts";

describe("bladeCuts", () => {
  it("cuts more often the smaller the pieces are", () => {
    // L2's starter is co_dinh-128-0 at ~128 tokens a piece; L3's is theo_dieu-512-10 at ~158.
    const fine = bladeCuts(128);
    const coarse = bladeCuts(512);
    expect(fine.length).toBeGreaterThan(coarse.length);
  });

  it("spaces the cuts by the measured average, against the widest preset", () => {
    // 1024 is the largest chunk_size the levels offer, so it is one uncut strip.
    expect(bladeCuts(1024)).toEqual([]);
    expect(bladeCuts(512)).toEqual([50]);
  });

  it("never draws so many cuts that the strip turns into a solid block", () => {
    expect(bladeCuts(1).length).toBeLessThanOrEqual(24);
  });

  it("draws no cut for a size it cannot believe", () => {
    expect(bladeCuts(0)).toEqual([]);
    expect(bladeCuts(-5)).toEqual([]);
  });
});

describe("the last cut", () => {
  it("cuts the widest chunk the level offers instead of leaving the strip whole", () => {
    // chunk-tuning leaves chunk_size free, and co_dinh/1024 bakes to 15 chunks averaging 979
    // tokens. floor(100/95,6) - 1 gave no cut at all: a picture of an uncut corpus above a
    // caption reading "15 đoạn".
    const cuts = bladeCuts(979);
    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toBeCloseTo(95.6, 1);
  });

  it("leaves a short remainder rather than stretching the last piece", () => {
    // avg 158 is the shipped L3 run. Five cuts made the rightmost piece 22,8 % wide against
    // 15,4 % for every other; six leave a 7,4 % tail, which is what a real last chunk is.
    const cuts = bladeCuts(158);
    expect(cuts).toHaveLength(6);
    const widths = [...cuts, 100].map((at, i) => at - (cuts[i - 1] ?? 0));
    const full = widths.slice(0, -1);
    expect(Math.max(...full) - Math.min(...full)).toBeCloseTo(0, 6);
    expect(widths.at(-1)).toBeLessThan(full[0] ?? 0);
  });

  it("makes no cut only when one chunk really spans the whole corpus", () => {
    expect(bladeCuts(1024)).toEqual([]);
    expect(bladeCuts(2048)).toEqual([]);
  });

  it("cuts a half-width chunk once, in the middle", () => {
    expect(bladeCuts(512)).toHaveLength(1);
    expect(bladeCuts(512)[0]).toBeCloseTo(50, 6);
  });
});
