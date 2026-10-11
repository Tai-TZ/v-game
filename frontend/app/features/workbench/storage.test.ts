import { afterEach, describe, expect, it, vi } from "vitest";

import { graphFromBench, setParam, starterBench } from "./bench";
import { EMPTY_SLIP, type Slip } from "./guess";
import { loadSaved, loadSlip, save, saveSlip } from "./storage";
import { testEnv } from "./test-fixtures";

const env = testEnv("chunk-tuning");
const STORED_AT = "vg.bench.v1.chunk-tuning";

afterEach(() => window.localStorage.clear());

describe("bench storage", () => {
  it("saves and reads back the last graph of a level", () => {
    const starter = starterBench(env);
    if (!starter) throw new Error("starter");
    const bench = setParam(env, starter, "vector_search", "top_k", 6);
    expect(save(env.level.id, env.level.version, graphFromBench(env, bench))).toBe(true);
    expect(loadSaved(env)).toEqual({ bench, discarded: false });
  });

  it("returns nothing when nothing is saved", () => {
    expect(loadSaved(env)).toEqual({ bench: null, discarded: false });
  });

  it("discards a graph saved for another version or that no longer fits", () => {
    const starter = starterBench(env);
    if (!starter) throw new Error("starter");
    save(env.level.id, env.level.version + 1, graphFromBench(env, starter));
    expect(loadSaved(env)).toEqual({ bench: null, discarded: true });
    window.localStorage.setItem(STORED_AT, "{broken");
    expect(loadSaved(env)).toEqual({ bench: null, discarded: true });
    const graph = graphFromBench(env, setParam(env, starter, "vector_search", "top_k", 99));
    save(env.level.id, env.level.version, graph);
    expect(loadSaved(env)).toEqual({ bench: null, discarded: true });
  });

  it("keeps working when storage throws on read and on write", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(loadSaved(env)).toEqual({ bench: null, discarded: false });
    expect(save(env.level.id, 1, env.level.starter_graph)).toBe(false);
  });
});

describe("guess slip storage", () => {
  const slip: Slip = {
    passed: 7,
    failing: [4, 9],
    bets: { "lib-l2-v01": { pass: false, confidence: "high" } },
  };

  it("keeps a draft per level and forgets it once cleared", () => {
    saveSlip("chunk-tuning", slip);
    expect(loadSlip("chunk-tuning")).toEqual(slip);
    expect(loadSlip("grounded-citation")).toEqual(EMPTY_SLIP);
    saveSlip("chunk-tuning", EMPTY_SLIP);
    expect(window.localStorage.getItem("vg.guess.v1.chunk-tuning")).toBeNull();
  });

  it("starts empty on a broken or foreign draft", () => {
    window.localStorage.setItem("vg.guess.v1.chunk-tuning", "{broken");
    expect(loadSlip("chunk-tuning")).toEqual(EMPTY_SLIP);
    window.localStorage.setItem(
      "vg.guess.v1.chunk-tuning",
      JSON.stringify({ ...slip, bets: { x: { pass: true, confidence: "very" } } }),
    );
    expect(loadSlip("chunk-tuning")).toEqual(EMPTY_SLIP);
  });

  it("keeps working when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(loadSlip("chunk-tuning")).toEqual(EMPTY_SLIP);
    expect(() => saveSlip("chunk-tuning", slip)).not.toThrow();
    vi.restoreAllMocks();
  });
});
