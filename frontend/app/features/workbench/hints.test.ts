import { afterEach, describe, expect, it } from "vitest";

import {
  canOpen,
  configKey,
  firstTouches,
  firstTouchTypes,
  hintFor,
  hint3Gate,
  hintTarget,
  loadHints,
  look,
  open,
  recordFail,
  saveHints,
  type HintBook,
  type Target,
} from "./hints";
import type { CaseView, RunView } from "./run";
import type { Graph } from "./schema";

afterEach(() => window.localStorage.clear());

const L1 = "grounded-citation";
const L3 = "article-number-lookup";

function kase(
  n: number,
  role: CaseView["role"],
  passed: boolean,
  extra: Partial<CaseView> = {},
): CaseView {
  return {
    id: `c${n}`,
    n,
    role,
    vai: "",
    state: "graded",
    steps: {},
    tokens: { in: 100 * n, out: 0 },
    graded: { status: passed ? "ok" : "fail", passed, counted: true, criteria: {}, labels: [] },
    ...extra,
  };
}

function starRun(
  score: { s1: boolean; s2: boolean; s3: boolean },
  cases: CaseView[],
  diagnosis: { case: string | null; flag: string }[] = [],
): RunView {
  return {
    runId: "r1",
    lastSeq: 0,
    stream: "closed",
    phase: "finished",
    ingestion: [],
    cases,
    score: {
      stars: 0,
      ...score,
      normal_passed: 0,
      normal_total: 0,
      traps_passed: 0,
      traps_total: 0,
      tokens: 0,
      budget: 0,
    },
    report: { gold: {}, diagnosis: diagnosis.map((d) => ({ ...d, message_vi: "" })) },
  };
}

describe("hintTarget", () => {
  it("aims at the lowest star not yet earned", () => {
    const cases = [kase(1, "visible", false), kase(2, "visible", true)];
    expect(hintTarget(L1, starRun({ s1: false, s2: false, s3: false }, cases))?.star).toBe(1);
    expect(hintTarget(L1, starRun({ s1: true, s2: false, s3: false }, cases))?.star).toBe(2);
    expect(hintTarget(L1, starRun({ s1: true, s2: true, s3: false }, cases))?.star).toBe(3);
    expect(hintTarget(L1, starRun({ s1: true, s2: true, s3: true }, cases))).toBeNull();
  });

  it("names the first failing case for star 1", () => {
    const cases = [kase(1, "visible", true), kase(2, "visible", false), kase(3, "hidden", false)];
    expect(hintTarget(L1, starRun({ s1: false, s2: false, s3: false }, cases))?.n).toBe(2);
  });

  it("names the costliest case for star 2, the run's budget", () => {
    const cases = [kase(1, "visible", true), kase(4, "hidden", true), kase(2, "visible", true)];
    expect(hintTarget(L1, starRun({ s1: true, s2: false, s3: true }, cases))?.n).toBe(4);
  });

  it("tells a missing source from missing retrieval on L1 star 1", () => {
    const cases = [kase(1, "visible", false)];
    const noSource = starRun({ s1: false, s2: false, s3: false }, cases, [
      { case: "c1", flag: "llm.cite_missing" },
    ]);
    expect(hintTarget(L1, noSource)?.key).toBe("s1_source");
    const noRetrieval = starRun({ s1: false, s2: false, s3: false }, cases, [
      { case: "c1", flag: "ret.gold_missing" },
      { case: "c1", flag: "llm.cite_missing" },
    ]);
    expect(hintTarget(L1, noRetrieval)?.key).toBe("s1");
  });

  it("tells L3's three traps apart by the failing trap", () => {
    const run = (trapId: string) =>
      starRun({ s1: true, s2: true, s3: false }, [
        kase(1, "visible", true),
        kase(9, "trap", false, { id: trapId }),
      ]);
    expect(hintTarget(L3, run("lib-l3-t02"))?.key).toBe("s3_t02");
    expect(hintTarget(L3, run("lib-l3-t03"))?.key).toBe("s3_t03");
    expect(hintTarget(L3, run("lib-l3-x99"))?.key).toBe("s3");
  });

  it("counts a sample run with a failing sample for star 1 (kẹt ở câu mẫu)", () => {
    const sample: RunView = {
      ...starRun({ s1: true, s2: true, s3: true }, [
        kase(1, "visible", true),
        kase(2, "visible", false),
      ]),
      scope: "mau",
    };
    delete sample.score;
    expect(hintTarget(L1, sample)).toMatchObject({ star: 1, n: 2 });
  });

  it("aims at nothing for a recorded run, a run still going or one the daily cap cut", () => {
    const cases = [kase(1, "visible", false)];
    const base = starRun({ s1: false, s2: false, s3: false }, cases);
    expect(hintTarget(L1, { ...base, scope: "da_ghi" })).toBeNull();
    expect(hintTarget(L1, { ...base, phase: "running" })).toBeNull();
    const capped = kase(1, "visible", false, {
      graded: {
        status: "skipped_budget",
        passed: false,
        counted: true,
        reason: "daily_cap",
        criteria: {},
        labels: [],
      },
    });
    expect(hintTarget(L1, starRun({ s1: false, s2: false, s3: false }, [capped]))).toBeNull();
  });
});

describe("the ladder", () => {
  const book = (): HintBook => loadHints(L1);

  it("opens hint 1 on request once a run has failed", () => {
    expect(canOpen(book(), "s1")).toBe(1);
    expect(open(book(), "s1", 1, 1000).targets.s1).toEqual({ opened: 1, looked: false });
  });

  it("holds hint 2 until the player has looked at something since hint 1", () => {
    const after1 = open(book(), "s1", 1, 1000);
    expect(canOpen(after1, "s1")).toBeNull();
    expect(canOpen(look(after1), "s1")).toBe(2);
  });

  it("does not count a look made before hint 1 toward hint 2", () => {
    const after1 = open(look(book()), "s1", 1, 1000);
    expect(canOpen(after1, "s1")).toBeNull();
  });

  it("stops at hint 2: hint 3 has its own gate (B4b)", () => {
    const after2 = open(look(open(book(), "s1", 1, 1000)), "s1", 1, 2000);
    expect(after2.targets.s1?.opened).toBe(2);
    expect(canOpen(look(after2), "s1")).toBeNull();
  });

  it("keeps a separate ladder per target", () => {
    const after1 = open(book(), "s1", 1, 1000);
    expect(canOpen(after1, "s3")).toBe(1);
  });

  it("logs every hint opened, with its star, for the pilot", () => {
    const after = open(look(open(book(), "s3", 3, 1000)), "s3", 3, 2000);
    expect(after.log).toEqual([
      { at: 1000, target: "s3", star: 3, n: 1 },
      { at: 2000, target: "s3", star: 3, n: 2 },
    ]);
  });

  it("keeps the log to the most recent 50 entries", () => {
    let b = book();
    for (let i = 0; i < 60; i += 1) b = { ...open(b, "s2", 2, i), targets: {} };
    expect(b.log).toHaveLength(50);
    expect(b.log[0]?.at).toBe(10);
  });

  it("survives a reload, and an unreadable entry reads as a fresh ladder", () => {
    saveHints(L1, open(book(), "s1", 1, 1000));
    expect(loadHints(L1).targets.s1?.opened).toBe(1);
    window.localStorage.setItem(`vg.hints.v1.${L1}`, "{nope");
    expect(loadHints(L1)).toEqual({ targets: {}, log: [], fails: {} });
  });
});

describe("hintFor", () => {
  it("puts the case number and an object on screen in every hint", () => {
    for (const level of [L1, "chunk-tuning", L3]) {
      for (const key of ["s1", "s1_source", "s2", "s3", "s3_t01", "s3_t02", "s3_t03"] as const) {
        for (const n of [1, 2] as const) {
          const hint = hintFor(level, { key, star: 1, n: 4 }, n);
          if (!hint) continue;
          expect(hint.text.length).toBeGreaterThan(0);
          expect(hint.pointer).toBeDefined();
          if (hint.pointer.kind === "case") expect(hint.pointer.n).toBe(4);
        }
      }
    }
  });

  it("has hints 1 and 2 for every star of every Library level", () => {
    for (const level of [L1, "chunk-tuning", L3]) {
      for (const key of ["s1", "s2", "s3"] as const) {
        expect(hintFor(level, { key, star: 1, n: 1 }, 1)).not.toBeNull();
        expect(hintFor(level, { key, star: 1, n: 1 }, 2)).not.toBeNull();
      }
    }
  });

  it("knows no level it was not written for", () => {
    expect(hintFor("watchtower-l1", { key: "s1", star: 1, n: 1 }, 1)).toBeNull();
  });
});

describe("firstTouchTypes", () => {
  const graph = (nodes: Graph["nodes"]): Graph => ({ schema: 1, nodes, edges: [] });

  it("names the toys whose node was added, removed or turned", () => {
    const before = graph([
      { id: "a", type: "vector_search", params: { top_k: 3 } },
      { id: "b", type: "llm", params: { system_prompt: "x" } },
    ] as Graph["nodes"]);
    const after = graph([
      { id: "a", type: "vector_search", params: { top_k: 5 } },
      { id: "c", type: "rerank", params: {} },
    ] as Graph["nodes"]);
    expect(firstTouchTypes(before, after).sort()).toEqual(["llm", "rerank", "vector_search"]);
  });

  it("names nothing when the bench did not change", () => {
    const same = graph([
      { id: "a", type: "llm", params: { system_prompt: "x" } },
    ] as Graph["nodes"]);
    expect(firstTouchTypes(same, same)).toEqual([]);
  });
});

describe("firstTouches", () => {
  it("answers each toy once per browser, across levels", () => {
    expect(firstTouches(["vector_search", "llm"])).toEqual(["vector_search", "llm"]);
    expect(firstTouches(["vector_search", "rerank"])).toEqual(["rerank"]);
    expect(firstTouches(["llm"])).toEqual([]);
  });

  it("starts over on an unreadable store", () => {
    window.localStorage.setItem("vg.touched.v1", "{x");
    expect(firstTouches(["fusion"])).toEqual(["fusion"]);
  });
});

describe("hint 3's gate (L1 §11, X28; roadmap B4 test list)", () => {
  const L2 = "chunk-tuning";
  const star1: Target = { key: "s1", star: 1, n: 1 };
  // A ladder at hint 2 for star 1, with or without a look since.
  const atTwo = (looked: boolean, b: HintBook = loadHints(L2)): HintBook => {
    const two = open(look(open(b, "s1", 1, 1)), "s1", 1, 2);
    return looked ? look(two) : two;
  };
  const gate = (b: HintBook, left: number | null, price = 13) =>
    canOpen(b, "s1", hint3Gate(b, star1, { left, starPrice: price }));

  it("L2: a sample run and a failed star run with the pool at 0 wait for a look after hint 2", () => {
    let b = recordFail(atTwo(false), 1, "cfg-a", true);
    b = recordFail(b, 1, "cfg-b", false);
    expect(gate(b, 0)).toBeNull();
    expect(gate(look(b), 0)).toBe(3);
  });

  it("stays shut with no failed graded run, even with the pool empty", () => {
    expect(gate(atTwo(true), 0)).toBeNull();
  });

  it("stuck at the samples on L1: three failed samples on three configs open it (pool 4)", () => {
    let b = atTwo(true, loadHints(L1));
    for (const cfg of ["a", "b", "c"]) b = recordFail(b, 1, cfg, true);
    expect(canOpen(b, "s1", hint3Gate(b, star1, { left: 4, starPrice: 10 }))).toBe(3);
  });

  it("stuck at the samples on L1: two failed samples (pool 7) do not", () => {
    let b = atTwo(true, loadHints(L1));
    for (const cfg of ["a", "b"]) b = recordFail(b, 1, cfg, true);
    expect(canOpen(b, "s1", hint3Gate(b, star1, { left: 7, starPrice: 10 }))).toBeNull();
  });

  it("does not count the same configuration failing again", () => {
    let b = atTwo(true);
    for (let i = 0; i < 3; i += 1) b = recordFail(b, 1, "same", false);
    expect(b.fails["1"]?.configs).toEqual(["same"]);
    expect(gate(b, 13)).toBeNull();
  });

  it("opens on the third failed star run while the pool still has calls", () => {
    let b = atTwo(true);
    for (const cfg of ["a", "b", "c"]) b = recordFail(b, 1, cfg, false);
    expect(gate(b, 13)).toBe(3);
  });

  it("prices the next attempt at a sample run when the latest counted failure was one", () => {
    const b = recordFail(atTwo(true), 1, "a", true);
    expect(gate(b, 2)).toBe(3); // less than the 3 a sample run costs
    expect(gate(b, 5)).toBeNull(); // a sample run still fits
    const star = recordFail(atTwo(true), 1, "a", false);
    expect(gate(star, 12)).toBe(3); // less than a 13-call star run
  });

  it("does not open on the pool while the pool is unknown", () => {
    const b = recordFail(atTwo(true), 1, "a", false);
    expect(gate(b, null)).toBeNull();
  });

  it("counts failures per star, not per ladder", () => {
    const b = recordFail(atTwo(true), 3, "a", false);
    expect(gate(b, 0)).toBeNull();
  });

  it("keeps failures across reloads, so earlier days count", () => {
    saveHints(L2, recordFail(loadHints(L2), 2, "a", false));
    expect(loadHints(L2).fails["2"]).toEqual({ configs: ["a"], lastSample: false });
  });

  it("reads a book saved before failures were kept", () => {
    window.localStorage.setItem(`vg.hints.v1.${L2}`, JSON.stringify({ targets: {}, log: [] }));
    expect(loadHints(L2).fails).toEqual({});
  });
});

describe("a failing sample aims at the lowest star not yet earned", () => {
  const sample = (): RunView => {
    const run: RunView = {
      ...starRun({ s1: true, s2: true, s3: true }, [kase(1, "visible", false)]),
      scope: "mau",
    };
    delete run.score;
    return run;
  };

  it("is star 1 before any star, star 2 once star 1 is earned, nothing after star 3", () => {
    expect(hintTarget(L1, sample(), 0)?.star).toBe(1);
    expect(hintTarget(L1, sample(), 1)?.star).toBe(2);
    expect(hintTarget(L1, sample(), 2)?.star).toBe(3);
    expect(hintTarget(L1, sample(), 3)).toBeNull();
  });
});

describe("hint 3 is the worked example", () => {
  it("is written for every star of every Library level", () => {
    for (const level of [L1, "chunk-tuning", L3]) {
      for (const key of ["s1", "s2", "s3"] as const) {
        const hint = hintFor(level, { key, star: 1, n: 1 }, 3);
        expect(hint?.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("follows L3's trap split", () => {
    const t02 = hintFor(L3, { key: "s3_t02", star: 3, n: null }, 3);
    const t03 = hintFor(L3, { key: "s3_t03", star: 3, n: null }, 3);
    expect(t02?.text).not.toBe(t03?.text);
  });
});

describe("configKey", () => {
  it("is stable for the same body and differs for another", () => {
    expect(configKey('{"a":1}')).toBe(configKey('{"a":1}'));
    expect(configKey('{"a":1}')).not.toBe(configKey('{"a":2}'));
  });
});
