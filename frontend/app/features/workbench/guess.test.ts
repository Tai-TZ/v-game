import { describe, expect, it } from "vitest";

import { EMPTY_SLIP, gradeSlip, isEmptySlip, whyCase, type Slip } from "./guess";
import { frame, parseSse, readText, replay, type SseFrame } from "./test-fixtures";

const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
const reference = parseSse(readText("e2e", "data", "run-l1-reference.sse"));

const CASES = [
  { id: "lib-l1-v01", role: "visible", vai: "su-kien", question: "Câu một?" },
  { id: "lib-l1-v02", role: "visible", vai: "su-kien", question: "Câu hai?" },
  { id: "lib-l1-h01", role: "hidden", vai: "su-kien" },
  { id: "lib-l1-h02", role: "hidden", vai: "su-kien" },
  { id: "lib-l1-t01", role: "trap", vai: "dieu-khong-ton-tai" },
];
const NORMAL_OK = { points: true, cited: true, no_fabrication: true, no_forbidden: true };

interface Grade {
  passed: boolean;
  counted?: boolean;
  status?: string;
  criteria?: Record<string, boolean>;
  labels?: string[];
  docs?: number;
}

/** A finished run over CASES with these grades, optional pack facts and stars. */
function run(grades: Record<string, Grade>, s2 = true) {
  const frames: SseFrame[] = [frame(1, "run.started", { cases: CASES, ingestion: [] })];
  let seq = 2;
  for (const c of CASES) {
    const g = grades[c.id] ?? { passed: true };
    if (g.docs !== undefined) {
      frames.push(
        frame(seq++, "step.finished", {
          case: c.id,
          node: "pk",
          block: "context_packer",
          status: "ok",
          summary: "",
          tokens: { in: 0, out: 0 },
          ms: 1,
          facts: [
            {
              kind: "pack",
              included: [],
              dropped: [],
              tokens: { docs: g.docs, query: 20, total: g.docs + 20, budget: 3000 },
            },
          ],
        }),
      );
    }
    frames.push(
      frame(seq++, "case.graded", {
        case: c.id,
        status: g.status ?? "ok",
        passed: g.passed,
        counted: g.counted ?? true,
        criteria: g.criteria ?? NORMAL_OK,
        labels: g.labels ?? [],
      }),
    );
  }
  frames.push(
    frame(seq++, "run.scored", {
      score: {
        stars: 1,
        s1: true,
        s2,
        s3: true,
        normal_passed: 4,
        normal_total: 4,
        traps_passed: 1,
        traps_total: 1,
        tokens: 2000,
        budget: 15000,
      },
    }),
    frame(seq + 1, "run.finished", { report: { gold: {}, diagnosis: [] }, models: {} }),
  );
  const view = replay(frames);
  if (!view) throw new Error("no run");
  return view;
}

describe("guess slip", () => {
  it("is empty until the player picks something", () => {
    expect(isEmptySlip(EMPTY_SLIP)).toBe(true);
    expect(isEmptySlip({ ...EMPTY_SLIP, passed: 0 })).toBe(false);
    expect(isEmptySlip({ ...EMPTY_SLIP, failing: [4] })).toBe(false);
    expect(isEmptySlip({ ...EMPTY_SLIP, bets: { x: { pass: true, confidence: "low" } } })).toBe(
      false,
    );
  });

  it("grades only after run.finished", () => {
    const slip: Slip = { ...EMPTY_SLIP, passed: 2 };
    const finishedAt = short.findIndex((f) => f.event === "run.finished");
    const scored = replay(short.slice(0, finishedAt));
    expect(scored && gradeSlip(slip, scored)).toBeNull();
    const done = replay(short);
    expect(done && gradeSlip(slip, done)?.count).toEqual({ guess: 2, actual: 2, total: 2 });
  });

  it("grades the count and the picked failures against case.graded", () => {
    const view = run({
      "lib-l1-h01": { passed: false, criteria: { ...NORMAL_OK, cited: false } },
      "lib-l1-t01": { passed: false, criteria: { refusal: false }, labels: ["cite_unknown"] },
    });
    // #3 = h01, #4 = h02, #5 = t01. The player says #3 and #4 fail.
    const grade = gradeSlip({ passed: 4, failing: [3, 4], bets: {} }, view);
    expect(grade?.count).toEqual({ guess: 4, actual: 3, total: 5 });
    // Samples have no bet: no prediction on them. Unpicked others are predicted to pass.
    expect(grade?.predictions.map((p) => [p.c.n, p.pass, p.right])).toEqual([
      [3, false, true], // hit
      [4, false, false], // miss: it passed
      [5, true, false], // unexpected failure
    ]);
    expect(grade?.surprises).toEqual([]);
  });

  it("makes no claim on unpicked cases when the player left 'which fail' empty", () => {
    const view = run({ "lib-l1-h01": { passed: false } });
    const grade = gradeSlip({ passed: 5, failing: [], bets: {} }, view);
    expect(grade?.predictions).toEqual([]);
    expect(grade?.count).toEqual({ guess: 5, actual: 4, total: 5 });
  });

  it("evaluates the confidence bets on the sample cases; only a sure miss is a surprise", () => {
    const view = run({
      "lib-l1-v01": { passed: false, criteria: { ...NORMAL_OK, cited: false } },
      "lib-l1-v02": { passed: false },
    });
    const grade = gradeSlip(
      {
        passed: null,
        failing: [],
        bets: {
          "lib-l1-v01": { pass: true, confidence: "high" }, // sure and wrong: surprise
          "lib-l1-v02": { pass: true, confidence: "medium" }, // wrong, not sure
        },
      },
      view,
    );
    expect(grade?.count).toBeNull();
    expect(grade?.predictions.map((p) => [p.c.id, p.right, p.confidence])).toEqual([
      ["lib-l1-v01", false, "high"],
      ["lib-l1-v02", false, "medium"],
    ]);
    expect(grade?.surprises.map((p) => p.c.id)).toEqual(["lib-l1-v01"]);

    const right = gradeSlip(
      { ...EMPTY_SLIP, bets: { "lib-l1-v01": { pass: false, confidence: "high" } } },
      view,
    );
    expect(right?.surprises).toEqual([]);
    expect(right?.predictions[0]?.right).toBe(true);
  });

  it("leaves cases the server did not finish out of the grade", () => {
    const view = run({ "lib-l1-h01": { passed: false, status: "skipped_budget" } });
    const grade = gradeSlip({ passed: 5, failing: [3], bets: {} }, view);
    expect(grade?.unfinished).toBe(1);
    expect(grade?.predictions.some((p) => p.c.n === 3)).toBe(false);
    // ...including out of the count: a case the daily cap never ran cannot have passed, so
    // counting it in the denominator charges the player for the server's outage
    // (daily-shift §3.3 exempts such a run from counting at all).
    expect(grade?.count).toEqual({ guess: 5, actual: 4, total: 4 });
  });

  it("counts only the cases that count towards the stars", () => {
    // §8.2 words the header "{normal + trap} câu tính sao" precisely so the slip's denominator
    // and the header cannot disagree: at L3 the header says 12 while the run has 13 cases, the
    // extra one being the info case that no star reads. A graded info case is still shown, it
    // just does not move the count.
    const view = run({ "lib-l1-t01": { passed: true, counted: false } });
    const grade = gradeSlip({ passed: 4, failing: [], bets: {} }, view);
    expect(grade?.count).toEqual({ guess: 4, actual: 4, total: 4 });
  });

  it("grades the captured reference run (every case passed)", () => {
    const view = replay(reference);
    if (!view) throw new Error("no run");
    const grade = gradeSlip(
      { passed: 10, failing: [9], bets: { "lib-l1-v01": { pass: true, confidence: "high" } } },
      view,
    );
    expect(grade?.count).toEqual({ guess: 10, actual: 10, total: 10 });
    expect(grade?.predictions.filter((p) => !p.right).map((p) => p.c.n)).toEqual([9]);
    expect(grade?.surprises).toEqual([]);
  });
});

describe("whyCase (L1 §11 reason menu)", () => {
  it("asks about the first failed case: no passage in the box", () => {
    const view = run({
      "lib-l1-v01": { passed: false, criteria: { ...NORMAL_OK, points: false }, docs: 0 },
    });
    expect(whyCase(view)).toMatchObject({ why: "no_docs", c: { n: 1 } });
  });

  it("tells a missing citation apart from a missing passage", () => {
    const view = run({
      "lib-l1-v02": {
        passed: false,
        criteria: { ...NORMAL_OK, cited: false },
        labels: ["cite_missing"],
        docs: 800,
      },
    });
    expect(whyCase(view)).toMatchObject({ why: "cite", c: { n: 2 } });
  });

  it("asks about an answered trap, and about the budget when no case fits", () => {
    const trap = run({ "lib-l1-t01": { passed: false, criteria: { refusal: false } } });
    expect(whyCase(trap)).toMatchObject({ why: "trap", c: { n: 5 } });
    expect(whyCase(run({}, false))).toEqual({ why: "budget", c: null });
    expect(whyCase(run({}))).toBeNull();
    // A failure with passages and a citation is none of the menu's situations.
    expect(whyCase(run({ "lib-l1-h01": { passed: false, docs: 600 } }))).toBeNull();
  });

  it("never asks before run.finished or about a case the server did not finish", () => {
    const finishedAt = short.findIndex((f) => f.event === "run.finished");
    const scored = replay(short.slice(0, finishedAt));
    expect(scored && whyCase(scored)).toBeNull();
    const skipped = run({ "lib-l1-v01": { passed: false, status: "llm_error", docs: 0 } });
    expect(whyCase(skipped)).toBeNull();
  });
});
