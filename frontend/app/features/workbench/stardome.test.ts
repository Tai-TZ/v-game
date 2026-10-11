import { describe, expect, it } from "vitest";

import type { Fact } from "./schema";
import { starField } from "./stardome";
import { readText } from "./test-fixtures";

type RetrievedItem = Extract<Fact, { kind: "retrieved" }>["items"][number];

/** The committed recorded run: real cosines and ranks, no fixture of our own. */
function retrievedOf(level: string, caseId: string, node: string): RetrievedItem[] {
  const run = JSON.parse(readText("public", "runs", `${level}.json`)) as {
    events: { type: string; case?: string; node?: string; facts?: Fact[] }[];
  };
  const step = run.events.find(
    (e) => e.type === "step.finished" && e.case === caseId && e.node === node,
  );
  const fact = step?.facts?.find(
    (f): f is Extract<Fact, { kind: "retrieved" }> => f.kind === "retrieved",
  );
  if (!fact) throw new Error(`no retrieved fact for ${caseId}/${node}`);
  return fact.items;
}

const L3 = () => retrievedOf("article-number-lookup", "lib-l3-v01", "vs");

const item = (rank: number, score: number, dieu: number): RetrievedItem => ({
  chunk_id: `c${rank}`,
  rank,
  score,
  doc_id: "qcdt-2024",
  dieu,
  khoan: [1],
  hieu_luc: true,
});

describe("starField", () => {
  it("places the three retrieved passages and keeps their real numbers", () => {
    const dome = starField(L3(), ["f22a1df7"], 72);
    expect(dome.stars.map((s) => [s.rank, s.dieu])).toEqual([
      [1, 53],
      [2, 13],
      [3, 68],
    ]);
    expect(dome.stars[0]?.score).toBeCloseTo(0.8032, 4);
    expect(dome.stars.every((s) => !s.gold)).toBe(true);
  });

  it("reports the answer passage's real rank when it is outside the pull", () => {
    expect(starField(L3(), ["f22a1df7"], 72).missingGold).toEqual({ rank: 72 });
  });

  it("marks the answer passage when it was pulled", () => {
    const items = L3();
    const second = items[1];
    if (!second) throw new Error("the recorded L3 run pulls three passages");
    const dome = starField(items, [second.chunk_id], 2);
    expect(dome.stars.filter((s) => s.gold).map((s) => s.rank)).toEqual([2]);
    expect(dome.missingGold).toBeNull();
  });

  it("shows the rank alone when the chunker split every answer sentence", () => {
    // ret.boundary_split: gold_chunks is empty, the pieces still carry a rank (GoldTrace).
    const dome = starField(L3(), [], 72);
    expect(dome.stars.every((s) => !s.gold)).toBe(true);
    expect(dome.missingGold).toEqual({ rank: 72 });
  });

  it("says nothing about a gold rank it does not have", () => {
    expect(starField(L3(), [], null).missingGold).toBeNull();
  });

  it("puts tied scores on the beam axis instead of dividing by zero", () => {
    const tied = [item(1, 0.5, 10), item(2, 0.5, 11)];
    expect(starField(tied, [], null).stars.every((s) => Number.isFinite(s.x))).toBe(true);
  });

  it("keeps every star inside the unit square", () => {
    const dome = starField(L3(), [], null);
    expect(dome.stars.every((s) => s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1)).toBe(true);
  });

  it("marks a passage from a document out of force", () => {
    const stale = [{ ...item(1, 0.7, 10), hieu_luc: false }];
    expect(starField(stale, [], null).stars[0]?.stale).toBe(true);
  });
});
