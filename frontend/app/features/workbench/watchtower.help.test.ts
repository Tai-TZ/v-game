import { afterEach, describe, expect, it } from "vitest";

import { slotTargets } from "./BenchView";
import { blockedPhrase, diagnosisTarget } from "./copy";
import { askGrade, ASKS, EMPTY_SLIP, isEmptySlip, type Slip } from "./guess";
import { hintFor, hintTarget, loadHints, type TargetKey } from "./hints";
import type { CaseView, RunView } from "./run";
import { loadSlip, saveSlip } from "./storage";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";

/**
 * Help on Watchtower W1 (watchtower.md §3.6): the hint ladder, the diagnosis pointers and the
 * guess slip's two questions. The runs are the engine's own streams for the starter and the
 * reference graph (e2e/data/README.md).
 */

afterEach(() => window.localStorage.clear());

const W1 = "direct-injection";
const w1 = testEnv(W1);

const recorded = (name: "starter" | "reference"): RunView => {
  const run = replay(parseSse(readText("e2e", "data", `run-w1-${name}.sse`)));
  if (!run) throw new Error(`the W1 ${name} run does not replay`);
  return run;
};

/** The run with these cases' labels changed (graded cases keep everything else). */
function withLabels(run: RunView, labels: Record<string, string[]>): RunView {
  return {
    ...run,
    cases: run.cases.map((c) =>
      c.graded && labels[c.id]
        ? { ...c, graded: { ...c.graded, labels: labels[c.id] ?? [], passed: false } }
        : c,
    ),
  };
}

const starThree = (run: RunView): RunView => {
  if (!run.score) throw new Error("the recorded run has no score");
  return { ...run, score: { ...run.score, s1: true, s2: true, s3: false } };
};

describe("W1 hint target", () => {
  it("aims star 1 at the first failing case, a trap included: the attacks are the traps", () => {
    const target = hintTarget(W1, recorded("starter"));
    expect(target).toMatchObject({ key: "s1", star: 1 });
    const first = recorded("starter").cases.find((c) => c.id === "wt-w1-t01");
    expect(target?.n).toBe(first?.n);
  });

  it("tells a blocked customer from a needless approval from a refusal on star 3", () => {
    const base = starThree(recorded("reference"));
    const key = (label: string) =>
      hintTarget(W1, withLabels(base, { "wt-w1-t04": [label] }), 2)?.key;
    expect(key("guard.blocked_benign")).toBe("s3_blocked");
    expect(key("hitl.over_asked")).toBe("s3_asked");
    expect(key("refusal")).toBe("s3");
  });

  it("names the case that carries the star 3 label", () => {
    const base = starThree(recorded("reference"));
    const run = withLabels(base, { "wt-w1-t04": ["guard.blocked_benign"] });
    const t04 = run.cases.find((c) => c.id === "wt-w1-t04");
    expect(hintTarget(W1, run, 2)?.n).toBe(t04?.n);
  });
});

describe("W1 hint ladders", () => {
  const KEYS: TargetKey[] = ["s1", "s2", "s3", "s3_blocked", "s3_asked"];

  it.each(KEYS)("has three rungs for %s", (key) => {
    for (const n of [1, 2, 3] as const) {
      const hint = hintFor(W1, { key, star: 1, n: 9 }, n);
      expect(hint?.text.length).toBeGreaterThan(10);
    }
  });

  it("sends star 1 hint 1 to the receipt of the named case, and hint 3 to the bell", () => {
    const first = hintFor(W1, { key: "s1", star: 1, n: 9 }, 1);
    expect(first?.text).toContain("#9");
    expect(first?.pointer).toEqual({ kind: "case", n: 9 });
    expect(hintFor(W1, { key: "s1", star: 1, n: 9 }, 3)?.pointer).toEqual({
      kind: "slot",
      slot: "human_approval",
    });
  });

  it("opens the net on the blocked-customer worked solution, at the phrases", () => {
    expect(hintFor(W1, { key: "s3_blocked", star: 3, n: 12 }, 3)?.pointer).toEqual({
      kind: "slot",
      slot: "pattern_guard",
      param: "phrases",
    });
  });

  it("keeps a ladder written before the new keys readable", () => {
    window.localStorage.setItem(
      `vg.hints.v1.${W1}`,
      JSON.stringify({ targets: { s3_blocked: { opened: 1, looked: true } }, log: [], fails: {} }),
    );
    expect(loadHints(W1).targets.s3_blocked).toEqual({ opened: 1, looked: true });
  });
});

describe("W1 diagnosis targets", () => {
  const target = (flag: string) =>
    diagnosisTarget(w1, { flag, cases: ["wt-w1-t01"] }, undefined, null);

  it("sends a refund nobody approved to the bell", () => {
    expect(target("ledger.refund_wrong")).toEqual({ slot: "human_approval", param: "policy" });
    expect(target("hitl.bypassed")).toEqual({ slot: "human_approval", param: "policy" });
    expect(target("hitl.over_asked")).toEqual({ slot: "human_approval", param: "policy" });
  });

  it("sends a blocked customer to the net and an encoded order to the dog", () => {
    expect(target("guard.blocked_benign")).toEqual({ slot: "pattern_guard", param: "phrases" });
    expect(target("guard.passed_encoded")).toEqual({
      slot: "injection_classifier",
      param: "threshold",
    });
  });

  it("sends a refused customer to the Lăng kính", () => {
    expect(target("refusal")).toEqual({ slot: "action_llm", param: "system_prompt" });
  });
});

describe("the phrase that blocked a customer", () => {
  const caseWith = (facts: object[]): CaseView =>
    ({
      id: "c",
      n: 1,
      role: "trap",
      vai: "",
      state: "graded",
      tokens: { in: 0, out: 0 },
      steps: {
        net: { facts, status: "ok" },
      },
    }) as unknown as CaseView;

  it("is the one the net matched", () => {
    const c = caseWith([{ kind: "guard", by: "pattern", decision: "block", matched: "bỏ qua" }]);
    expect(blockedPhrase(c)).toBe("bỏ qua");
  });

  it("is nothing when the net let the case through or the dog stopped it", () => {
    expect(
      blockedPhrase(caseWith([{ kind: "guard", by: "pattern", decision: "pass" }])),
    ).toBeNull();
    expect(
      blockedPhrase(caseWith([{ kind: "guard", by: "classifier", decision: "block", score: 0.9 }])),
    ).toBeNull();
  });

  it("puts the chip first among the controls to focus, escaped as an attribute value", () => {
    const [chip, ...rest] = slotTargets(w1, "pattern_guard", "phrases", 'bỏ "qua"');
    expect(chip).toBe('#slot-net [data-phrase="bỏ \\"qua\\""]');
    expect(rest[0]).toContain('[data-param="phrases"]');
  });
});

describe("W1 guess slip questions", () => {
  it("asks two things, each with a closed set of answers", () => {
    const asks = ASKS[W1];
    expect(asks?.map((a) => a.id)).toEqual(["net_catches", "blocks_customer"]);
    expect(asks?.[0]?.options).toEqual(["0", "1", "2", "3"]);
    expect(asks?.[1]?.options).toEqual(["Không", "Có"]);
  });

  it("grades the net's catch against the guard facts of the three attacks", () => {
    const run = recorded("reference");
    const grade = askGrade(W1, "net_catches", run);
    const net = run.cases
      .filter((c) => ["wt-w1-t01", "wt-w1-t02", "wt-w1-t03"].includes(c.id))
      .filter((c) =>
        Object.values(c.steps).some((s) =>
          s.facts?.some((f) => f.kind === "guard" && f.by === "pattern" && f.decision === "block"),
        ),
      ).length;
    expect(grade).toBe(net);
  });

  it("answers yes to blocking a customer exactly when a case carries the label", () => {
    const run = recorded("reference");
    expect(askGrade(W1, "blocks_customer", run)).toBe(0);
    const marked = withLabels(run, { "wt-w1-t04": ["guard.blocked_benign"] });
    expect(askGrade(W1, "blocks_customer", marked)).toBe(1);
  });

  it("does not grade a run that has not finished", () => {
    const run = { ...recorded("reference"), phase: "running" as const };
    expect(askGrade(W1, "net_catches", run)).toBeNull();
  });

  it("counts an answered question as a filled slip, and stores it", () => {
    const slip: Slip = { ...EMPTY_SLIP, asks: { net_catches: 2 } };
    expect(isEmptySlip(slip)).toBe(false);
    expect(isEmptySlip(EMPTY_SLIP)).toBe(true);
    saveSlip(W1, slip);
    expect(loadSlip(W1).asks).toEqual({ net_catches: 2 });
  });

  it("reads a slip saved before the questions existed", () => {
    window.localStorage.setItem(
      `vg.guess.v1.${W1}`,
      JSON.stringify({ passed: 3, failing: [], bets: {} }),
    );
    expect(loadSlip(W1).passed).toBe(3);
    expect(loadSlip(W1).asks ?? {}).toEqual({});
  });
});
