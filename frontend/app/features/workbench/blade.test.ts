import { describe, expect, it } from "vitest";

import { bladeCuts } from "./blade";

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
