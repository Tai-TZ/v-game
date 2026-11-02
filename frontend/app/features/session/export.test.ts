import { afterEach, describe, expect, it } from "vitest";

import { sessionCode, sessionRows, toCsv, CSV_COLUMNS } from "./export";

/** Plan v0.7 1.3: the session's data as a CSV the learner downloads; nothing is sent. */

afterEach(() => window.localStorage.clear());

const mark = (at: number, stars: 0 | 1 | 2 | 3, passed: boolean[], extra: object = {}) => ({
  body: '{"secret":"the graph never leaves"}',
  at,
  stars,
  tokens: 1200,
  budget: 5800,
  cases: passed.map((p, i) => ({ n: i + 1, role: "visible", passed: p })),
  ...extra,
});

describe("sessionCode", () => {
  it("is six characters from an unambiguous alphabet, and stays the same", () => {
    const code = sessionCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(sessionCode()).toBe(code);
  });
});

describe("sessionRows", () => {
  it("has one row per scored run and per opened hint, every level, oldest first", () => {
    window.localStorage.setItem(
      "vg.history.v1.direct-injection",
      JSON.stringify({
        runs: [
          mark(2000, 3, [true, true], {
            why: 1,
            next: { type: "pattern_guard", direction: "add" },
          }),
          mark(1000, 0, [true, false]),
        ],
      }),
    );
    window.localStorage.setItem(
      "vg.hints.v1.grounded-citation",
      JSON.stringify({ targets: {}, log: [{ at: 1500, target: "s1", star: 1, n: 1 }], fails: {} }),
    );
    window.localStorage.setItem("vg.bench.v1.direct-injection", "not ours");
    const rows = sessionRows("ABCDEF");
    expect(rows.map((r) => [r.kind, r.level, r.at])).toEqual([
      ["run", "direct-injection", 1000],
      ["hint", "grounded-citation", 1500],
      ["run", "direct-injection", 2000],
    ]);
    expect(rows[2]).toMatchObject({
      code: "ABCDEF",
      stars: 3,
      passed: 2,
      cases: 2,
      why: 1,
      next: "pattern_guard:add",
    });
    expect(rows[1]).toMatchObject({ hint_target: "s1", hint_n: 1, star: 1 });
  });

  it("never carries the graph, a question or any free text", () => {
    window.localStorage.setItem(
      "vg.history.v1.direct-injection",
      JSON.stringify({ runs: [mark(1, 1, [true])] }),
    );
    expect(toCsv(sessionRows("ABCDEF"))).not.toContain("secret");
  });

  it("skips what it cannot read rather than failing the download", () => {
    window.localStorage.setItem("vg.history.v1.broken", "{not json");
    expect(sessionRows("ABCDEF")).toEqual([]);
  });
});

describe("toCsv", () => {
  it("writes the header and quotes a cell that needs it", () => {
    const csv = toCsv([{ code: "ABCDEF", level: 'a,"b"', kind: "run", at: 1 } as never]);
    const [header, line] = csv.trim().split("\n");
    expect(header).toBe(CSV_COLUMNS.join(","));
    expect(line?.startsWith('ABCDEF,"a,""b""",run,1')).toBe(true);
  });
});
