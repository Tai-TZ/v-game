import { describe, expect, it } from "vitest";

import { CARDS, DATA_KINDS, gradeSort, PLACES, placeFor, type PlaceId } from "./dataKinds";

/** "Ba loại dữ liệu" (lesson-visualization: vi mô, Thư viện, trước L1): 0 AI calls, graded here. */

const NONE = { live: false, keyed: false, short: false, always: false };

describe("the three places for data", () => {
  it("has nine cards over three places, three in each", () => {
    expect(CARDS).toHaveLength(9);
    expect(PLACES.map((p) => p.id)).toEqual(["kho_vector", "tra_cuu", "loi_dan"]);
    for (const place of PLACES) {
      expect(
        CARDS.filter((c) => c.place === place.id),
        place.id,
      ).toHaveLength(3);
    }
  });

  it("derives each card's place from its facts, so the answer is a rule, not a list", () => {
    for (const card of CARDS) expect(placeFor(card.facts), card.id).toBe(card.place);
  });

  it("reads a change in the day, then an exact key, before length and use", () => {
    const always = { ...NONE, short: true, always: true };
    expect(placeFor({ ...always, live: true })).toBe("tra_cuu");
    expect(placeFor({ ...always, keyed: true })).toBe("tra_cuu");
    expect(placeFor(always)).toBe("loi_dan");
    // Short but rarely needed, or needed everywhere but long: kept in the store, found on demand.
    expect(placeFor({ ...NONE, short: true })).toBe("kho_vector");
    expect(placeFor({ ...NONE, always: true })).toBe("kho_vector");
    expect(placeFor(NONE)).toBe("kho_vector");
  });

  it("keeps two decoys whose words point to a place their facts rule out", () => {
    const decoys = CARDS.filter((c) => c.lure !== undefined);
    expect(decoys).toHaveLength(2);
    for (const decoy of decoys) expect(decoy.lure, decoy.id).not.toBe(decoy.place);
    // "Câu nào cũng cần" sounds like the instructions, but the text is long.
    const long = decoys.find((c) => c.lure === "loi_dan");
    expect(long?.text).toMatch(/nào cũng cần/);
    expect(long?.facts).toMatchObject({ always: true, short: false });
    // Asked in plain words sounds like search by meaning, but the answer is one keyed record.
    const keyed = decoys.find((c) => c.lure === "kho_vector");
    expect(keyed?.text).toMatch(/lời thường/);
    expect(keyed?.facts.keyed).toBe(true);
  });
});

describe("gradeSort", () => {
  const answers = Object.fromEntries(CARDS.map((c) => [c.id, c.place]));
  const first = (place: PlaceId) => {
    const card = CARDS.find((c) => c.place === place);
    if (!card) throw new Error(`no card for ${place}`);
    return card.id;
  };

  it("counts every right place", () => {
    expect(gradeSort(answers)).toMatchObject({
      right: 9,
      total: 9,
      misses: { vao_kho: 0, nhoi_loi_dan: 0, ep_tra_cuu: 0 },
    });
  });

  it("names a wrong pick by where it went: each kind teaches its own lesson", () => {
    const lookup = first("tra_cuu");
    const store = first("kho_vector");
    const prompt = first("loi_dan");
    const grade = gradeSort({
      ...answers,
      [lookup]: "kho_vector",
      [store]: "loi_dan",
      [prompt]: "tra_cuu",
    });
    expect(grade).toMatchObject({
      right: 6,
      misses: { vao_kho: 1, nhoi_loi_dan: 1, ep_tra_cuu: 1 },
    });
    const verdict = (id: string) => grade?.cards.find((c) => c.id === id)?.verdict;
    expect(verdict(lookup)).toBe("vao_kho");
    expect(verdict(store)).toBe("nhoi_loi_dan");
    expect(verdict(prompt)).toBe("ep_tra_cuu");
    expect(verdict(CARDS.find((c) => ![lookup, store, prompt].includes(c.id))?.id ?? "")).toBe(
      "right",
    );
  });

  it("is not ready to grade until every card has a place", () => {
    const partial = Object.fromEntries(CARDS.slice(1).map((c) => [c.id, c.place]));
    expect(gradeSort(partial)).toBeNull();
  });

  it("names itself for the route and the brief", () => {
    expect(DATA_KINDS).toMatchObject({
      id: "ba-loai-du-lieu",
      zone: "library",
      before: "grounded-citation",
    });
  });
});
