import { describe, expect, it } from "vitest";

import { CARDS, gradeLadder, LANES, laneFor, TOOL_RISK } from "./toolRisk";

/** "Thang rủi ro tool" (lesson-visualization: vi mô, Tháp, trước W1): 0 AI calls, graded here. */

describe("the tool-risk ladder", () => {
  it("has eight jobs and four lanes, strictest last", () => {
    expect(CARDS).toHaveLength(8);
    expect(LANES.map((l) => l.id)).toEqual(["tu_chay", "hoi_vuot", "luon_hoi", "khong_giao"]);
  });

  it("derives each job's lane from its facts, so the answer is a rule, not a list", () => {
    for (const card of CARDS) expect(laneFor(card.facts), card.id).toBe(card.lane);
  });

  it("uses every lane, and keeps a read-only decoy that names a refund", () => {
    expect(new Set(CARDS.map((c) => c.lane))).toEqual(new Set(LANES.map((l) => l.id)));
    const decoy = CARDS.find((c) => c.decoy);
    expect(decoy?.text).toMatch(/hoàn tiền/);
    expect(decoy?.facts.writes).toBe(false);
  });

  it("reads a write that leaves the shop before money or undo", () => {
    expect(laneFor({ writes: true, money: true, undoable: false, outside: true })).toBe(
      "khong_giao",
    );
    expect(laneFor({ writes: true, money: true, undoable: false, outside: false })).toBe(
      "hoi_vuot",
    );
    expect(laneFor({ writes: true, money: false, undoable: false, outside: false })).toBe(
      "luon_hoi",
    );
    expect(laneFor({ writes: true, money: false, undoable: true, outside: false })).toBe("tu_chay");
    expect(laneFor({ writes: false, money: false, undoable: true, outside: false })).toBe(
      "tu_chay",
    );
  });
});

describe("gradeLadder", () => {
  const answers = Object.fromEntries(CARDS.map((c) => [c.id, c.lane]));

  it("counts every right lane", () => {
    expect(gradeLadder(answers)).toMatchObject({ right: 8, under: 0, over: 0, total: 8 });
  });

  it("tells a lane too loose (a leak) from one too strict (asking for nothing)", () => {
    const loose = CARDS.find((c) => c.lane === "luon_hoi");
    const decoy = CARDS.find((c) => c.decoy);
    if (!loose || !decoy) throw new Error("fixture");
    const grade = gradeLadder({ ...answers, [loose.id]: "tu_chay", [decoy.id]: "luon_hoi" });
    expect(grade).toMatchObject({ right: 6, under: 1, over: 1 });
    expect(grade?.cards.find((c) => c.id === loose.id)?.verdict).toBe("under");
    expect(grade?.cards.find((c) => c.id === decoy.id)?.verdict).toBe("over");
  });

  it("is not ready to grade until every job has a lane", () => {
    const partial = Object.fromEntries(CARDS.slice(1).map((c) => [c.id, c.lane]));
    expect(gradeLadder(partial)).toBeNull();
  });

  it("names itself for the route and the brief", () => {
    expect(TOOL_RISK).toMatchObject({ id: "thang-rui-ro-tool", zone: "watchtower" });
  });
});
