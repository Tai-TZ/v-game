import { afterEach, describe, expect, it, vi } from "vitest";

import { graphFromBench, setParam, starterBench } from "./bench";
import { EMPTY_SLIP, type Slip } from "./guess";
import type { Stars } from "~/features/progress/progress";

import {
  loadHistory,
  loadSaved,
  loadSlip,
  recordRun,
  save,
  saveSlip,
  type RunMark,
} from "./storage";
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

describe("run history (N3)", () => {
  const mark = (stars: Stars, body: string, cases: RunMark["cases"] = []): RunMark => ({
    body,
    at: 1000,
    stars,
    tokens: 420,
    budget: 3000,
    cases,
  });

  it("keeps a finished run and hands it back", () => {
    recordRun("grounded-citation", mark(3, "{a}"));
    expect(loadHistory("grounded-citation")).toEqual([mark(3, "{a}")]);
  });

  it("puts the newest run first, so the strip reads downward in time", () => {
    recordRun("grounded-citation", mark(1, "{a}"));
    recordRun("grounded-citation", mark(2, "{b}"));
    expect(loadHistory("grounded-citation").map((r) => r.body)).toEqual(["{b}", "{a}"]);
  });

  it("keeps five runs and drops the oldest, because this is a summary and not a log", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) recordRun("grounded-citation", mark(0, `{${n}}`));
    const kept = loadHistory("grounded-citation");
    expect(kept).toHaveLength(5);
    expect(kept.map((r) => r.body)).toEqual(["{6}", "{5}", "{4}", "{3}", "{2}"]);
  });

  it("keeps each level's history to itself", () => {
    recordRun("grounded-citation", mark(3, "{l1}"));
    recordRun("chunk-tuning", mark(1, "{l2}"));
    expect(loadHistory("grounded-citation").map((r) => r.body)).toEqual(["{l1}"]);
    expect(loadHistory("chunk-tuning").map((r) => r.body)).toEqual(["{l2}"]);
  });

  it("stores the per-case verdicts the strip needs, and nothing of the event log", () => {
    const cases = [
      { n: 1, role: "visible" as const, passed: true },
      { n: 2, role: "hidden" as const, passed: false },
    ];
    recordRun("grounded-citation", mark(1, "{a}", cases));
    expect(loadHistory("grounded-citation")[0]?.cases).toEqual(cases);
    const raw = window.localStorage.getItem("vg.history.v1.grounded-citation") ?? "";
    // The log is megabytes of facts; a summary must not grow with it.
    expect(raw).not.toContain("step.finished");
    expect(raw).not.toContain("facts");
  });

  it("reads as no history when the entry is not what this version writes", () => {
    window.localStorage.setItem("vg.history.v1.grounded-citation", '{"runs":[{"stars":9}]}');
    expect(loadHistory("grounded-citation")).toEqual([]);
  });

  // Spied on the prototype, not the instance: jsdom's localStorage inherits its methods, and an
  // own-property spy never runs -- which made the first version of both these tests pass
  // whatever the code did.
  it("reads as no history when storage cannot be read at all", () => {
    const blocked = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadHistory("grounded-citation")).toEqual([]);
    expect(blocked).toHaveBeenCalled();
  });

  it("keeps playing when storage refuses the write", () => {
    const full = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => recordRun("grounded-citation", mark(3, "{a}"))).not.toThrow();
    expect(full).toHaveBeenCalled();
  });
});
