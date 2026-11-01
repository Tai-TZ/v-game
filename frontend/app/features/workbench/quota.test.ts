import { afterEach, describe, expect, it } from "vitest";

import type { Slip } from "./guess";
import {
  loadLedger,
  loadRefundMarks,
  openMode,
  parseQuota,
  refundClaim,
  remaining,
  resetsAtLabel,
  saveLedger,
  saveRefundMarks,
  shiftCost,
  spend,
  credit,
  utcDay,
  type Ledger,
} from "./quota";
import type { CaseView, RunView } from "./run";

afterEach(() => window.localStorage.clear());

const MORNING = new Date("2026-11-01T03:00:00Z");
const NEXT_DAY = new Date("2026-11-02T00:00:01Z");

describe("ledger", () => {
  it("starts full when nothing is stored", () => {
    const ledger = loadLedger(MORNING);
    expect(ledger.day).toBe("2026-11-01");
    expect(ledger.pools.learner).toEqual({ used: 0, refunded: 0 });
    expect(ledger.pools.projector).toEqual({ used: 0, refunded: 0 });
  });

  it("keeps what was spent earlier the same UTC day", () => {
    saveLedger(spend(loadLedger(MORNING), "learner", 7, "level"));
    expect(loadLedger(new Date("2026-11-01T23:59:59Z")).pools.learner.used).toBe(7);
  });

  it("refills at 00:00 UTC, when the server's DailyCap does", () => {
    saveLedger(spend(loadLedger(MORNING), "learner", 13, "level"));
    const ledger = loadLedger(NEXT_DAY);
    expect(ledger.day).toBe("2026-11-02");
    expect(ledger.pools.learner.used).toBe(0);
  });

  it("treats an unreadable entry as a full pool", () => {
    window.localStorage.setItem("vg.quota.v1", "{not json");
    expect(loadLedger(MORNING).pools.learner.used).toBe(0);
    window.localStorage.setItem("vg.quota.v1", JSON.stringify({ day: "2026-11-01", pools: 1 }));
    expect(loadLedger(MORNING).pools.learner.used).toBe(0);
  });

  it("counts what each spend was for", () => {
    let ledger = spend(loadLedger(MORNING), "learner", 3, "level");
    ledger = spend(ledger, "learner", 2, "shift");
    expect(ledger.spent).toEqual({ level: 3, shift: 2 });
    expect(ledger.pools.learner.used).toBe(5);
  });

  it("keeps the projector pool apart from the learner's", () => {
    const ledger = spend(loadLedger(MORNING), "projector", 10, "level");
    expect(ledger.pools.projector.used).toBe(10);
    expect(ledger.pools.learner.used).toBe(0);
  });
});

describe("remaining", () => {
  const used = (n: number, refunded = 0): Ledger => ({
    ...loadLedger(MORNING),
    pools: { learner: { used: n, refunded }, projector: { used: 0, refunded: 0 } },
  });

  it("is the daily share less what was spent, plus refunds", () => {
    expect(remaining(used(7, 3), "learner", 13, null)).toBe(9);
  });

  it("shows the smaller of the player's pool and the server's (daily-shift §3.3)", () => {
    expect(remaining(used(0), "learner", 13, 4)).toBe(4);
    expect(remaining(used(10), "learner", 13, 400)).toBe(3);
  });

  it("never goes below zero", () => {
    expect(remaining(used(20), "learner", 13, null)).toBe(0);
  });
});

describe("shiftCost and openMode", () => {
  it("prices Mở ca at every case, less the 3 samples when they are already cached", () => {
    expect(shiftCost(10, false)).toBe(10);
    expect(shiftCost(10, true)).toBe(7);
    expect(shiftCost(13, true)).toBe(10);
  });

  it("opens the shift only when the pool covers its worst case", () => {
    expect(openMode(10, 10)).toBe("shift");
    expect(openMode(9, 10)).toBe("sample");
    expect(openMode(3, 10)).toBe("sample");
    expect(openMode(2, 10)).toBe("recorded");
  });
});

describe("parseQuota", () => {
  const body = {
    cap: 500,
    used: 12,
    remaining: 488,
    resets_at: "2026-11-02T00:00:00+00:00",
    estimate: true,
    reserve_left: 17,
    learner_daily: 13,
  };

  it("reads the server's contract", () => {
    expect(parseQuota(body)).toEqual({
      remaining: 488,
      resetsAt: "2026-11-02T00:00:00+00:00",
      learnerDaily: 13,
    });
  });

  it("refuses a body that does not match it", () => {
    expect(parseQuota({ ...body, learner_daily: -1 })).toBeNull();
    expect(parseQuota({ ...body, resets_at: 7 })).toBeNull();
    expect(parseQuota("nope")).toBeNull();
  });
});

describe("resetsAtLabel", () => {
  it("prints the refill in the player's own clock", () => {
    // The test runner's zone is whatever the machine says; compare against the same clock.
    const at = "2026-11-02T00:00:00+00:00";
    const local = new Date(at);
    const expected = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
    expect(resetsAtLabel(at)).toBe(expected);
  });

  it("says nothing for a time it cannot read", () => {
    expect(resetsAtLabel("soon")).toBeNull();
  });
});

describe("refundClaim", () => {
  const visible = (n: number, passed: boolean): CaseView => ({
    id: `c${n}`,
    n,
    role: "visible",
    vai: "",
    state: "graded",
    steps: {},
    tokens: { in: 0, out: 0 },
    graded: { status: "ok", passed, counted: true, criteria: {}, labels: [] },
  });
  const sampleRun = (passes: boolean[]): RunView => ({
    runId: "r1",
    lastSeq: 0,
    stream: "closed",
    phase: "finished",
    scope: "mau",
    ingestion: [],
    cases: passes.map((p, i) => visible(i + 1, p)),
  });
  const sure = (ids: string[], pass = true): Slip => ({
    passed: null,
    failing: [],
    bets: Object.fromEntries(ids.map((id) => [id, { pass, confidence: "high" as const }])),
  });
  const ALL = ["c1", "c2", "c3"];

  it("claims when the first sample run passed and every sample had a sure, right bet", () => {
    expect(refundClaim(sampleRun([true, true, true]), sure(ALL), true, false)).toBe(true);
  });

  it("does not claim without a sure bet on every sample", () => {
    const run = sampleRun([true, true, true]);
    expect(refundClaim(run, sure(["c1", "c2"]), true, false)).toBe(false);
    const medium: Slip = {
      ...sure(ALL),
      bets: { ...sure(ALL).bets, c3: { pass: true, confidence: "medium" } },
    };
    expect(refundClaim(run, medium, true, false)).toBe(false);
    expect(refundClaim(run, null, true, false)).toBe(false);
  });

  it("does not claim when a sure bet was wrong or a sample failed", () => {
    expect(refundClaim(sampleRun([true, true, true]), sure(ALL, false), true, false)).toBe(false);
    expect(refundClaim(sampleRun([true, false, true]), sure(ALL), true, false)).toBe(false);
  });

  it("claims only the level's first sample run, and once a day", () => {
    const run = sampleRun([true, true, true]);
    expect(refundClaim(run, sure(ALL), false, false)).toBe(false);
    expect(refundClaim(run, sure(ALL), true, true)).toBe(false);
  });

  it("never claims a star run", () => {
    const star = { ...sampleRun([true, true, true]) };
    delete star.scope;
    expect(refundClaim(star, sure(ALL), true, false)).toBe(false);
  });
});

describe("refund marks", () => {
  it("remember which levels had their first sample run and the day of the last refund", () => {
    expect(loadRefundMarks()).toEqual({ levels: [], refundedOn: null });
    saveRefundMarks({ levels: ["thu-vien-l1"], refundedOn: utcDay(MORNING) });
    expect(loadRefundMarks()).toEqual({ levels: ["thu-vien-l1"], refundedOn: "2026-11-01" });
  });

  it("start empty when the entry is unreadable", () => {
    window.localStorage.setItem("vg.refund.v1", "[]");
    expect(loadRefundMarks()).toEqual({ levels: [], refundedOn: null });
  });
});

describe("credit", () => {
  it("adds a refund to the pool it was spent from", () => {
    const ledger = credit(spend(loadLedger(MORNING), "learner", 3, "level"), "learner", 3);
    expect(remaining(ledger, "learner", 13, null)).toBe(13);
  });
});
