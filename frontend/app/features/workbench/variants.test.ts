import { afterEach, describe, expect, it } from "vitest";

import { loadSeen, markSeen, pickVariant } from "./variants";

afterEach(() => window.localStorage.clear());

const L1 = "grounded-citation";

describe("pickVariant (daily-shift §2)", () => {
  it("takes the lesson's review case for each star that has one", () => {
    expect(pickVariant(L1, "s1", {})).toBe("lib-l1-r01");
    expect(pickVariant(L1, "s1_source", {})).toBe("lib-l1-r01");
    expect(pickVariant(L1, "s3", {})).toBe("lib-l1-r02");
    expect(pickVariant("chunk-tuning", "s3", {})).toBe("lib-l2-r02");
    expect(pickVariant("article-number-lookup", "s3_t01", {})).toBe("lib-l3-r02");
    expect(pickVariant("article-number-lookup", "s2", {})).toBe("lib-l3-r03");
  });

  it("has none for a run's whole budget, nor for L3's t02 and t03", () => {
    expect(pickVariant(L1, "s2", {})).toBeNull();
    expect(pickVariant("chunk-tuning", "s2", {})).toBeNull();
    expect(pickVariant("article-number-lookup", "s3_t02", {})).toBeNull();
    expect(pickVariant("article-number-lookup", "s3_t03", {})).toBeNull();
    expect(pickVariant("watchtower-l1", "s1", {})).toBeNull();
  });

  it("prefers the case met least, so two variants in a row differ", () => {
    expect(pickVariant(L1, "s1", { "lib-l1-r01": 1 })).toBe("lib-l1-r04");
    expect(pickVariant(L1, "s1", { "lib-l1-r01": 2, "lib-l1-r04": 1 })).toBe("lib-l1-r04");
    expect(pickVariant(L1, "s1", { "lib-l1-r01": 1, "lib-l1-r04": 1 })).toBe("lib-l1-r01");
  });
});

describe("seen variants", () => {
  it("count per case and level, and survive a reload", () => {
    markSeen(L1, "lib-l1-r01");
    markSeen(L1, "lib-l1-r01");
    expect(loadSeen(L1)).toEqual({ "lib-l1-r01": 2 });
    expect(loadSeen("chunk-tuning")).toEqual({});
  });

  it("read as none from an unreadable store", () => {
    window.localStorage.setItem(`vg.variants.v1.${L1}`, "[1]");
    expect(loadSeen(L1)).toEqual({});
  });
});
