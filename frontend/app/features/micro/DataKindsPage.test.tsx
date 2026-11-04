import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CARDS, PLACES, type PlaceId } from "./dataKinds";
import { DataKindsPage } from "./DataKindsPage";
import { renderLesson } from "./test-render";

const show = () => renderLesson(<DataKindsPage />);

afterEach(cleanup);

const row = (id: string) => {
  const el = document.querySelector<HTMLElement>(`[data-card="${id}"]`);
  if (!el) throw new Error(`no card ${id}`);
  return el;
};
const placeName = (place: PlaceId) => PLACES.find((p) => p.id === place)?.name ?? "";
const placeFull = (place: PlaceId) => PLACES.find((p) => p.id === place)?.full ?? "";
const pick = (id: string, place: PlaceId) =>
  fireEvent.click(within(row(id)).getByRole("radio", { name: placeName(place) }));
const pickAll = (override: Record<string, PlaceId> = {}) => {
  for (const c of CARDS) pick(c.id, override[c.id] ?? c.place);
};
const check = () => screen.getByRole("button", { name: "Kiểm tra" });
const firstOf = (place: PlaceId) => {
  const card = CARDS.find((c) => c.place === place && c.lure === undefined);
  if (!card) throw new Error(`no card for ${place}`);
  return card;
};

describe("the three-kinds micro lesson", () => {
  it("lays out nine cards with three places each, and says it costs nothing", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Ba loại dữ liệu" })).toBeDefined();
    expect(document.querySelectorAll("[data-card]")).toHaveLength(9);
    for (const c of CARDS) {
      const radios = within(row(c.id)).getAllByRole("radio");
      expect(radios.map((r) => r.closest("label")?.dataset.place)).toEqual(PLACES.map((p) => p.id));
    }
    expect(document.body.textContent).toContain("không tốn lượt gọi AI");
    // The key names every place in full before the cards.
    const key = screen.getByRole("list", { name: "Ba nơi để dữ liệu" });
    for (const p of PLACES) expect(key.textContent).toContain(p.full);
  });

  it("holds the check until every card has a place, and says how many are left", () => {
    show();
    expect((check() as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain(`Còn ${CARDS.length} thẻ chưa xếp.`);
    pick(CARDS[0]?.id ?? "", "kho_vector");
    expect(document.body.textContent).toContain(`Còn ${CARDS.length - 1} thẻ chưa xếp.`);
    pickAll();
    expect((check() as HTMLButtonElement).disabled).toBe(false);
  });

  it("marks every card right when all are, and states the rule", () => {
    show();
    pickAll();
    fireEvent.click(check());
    for (const c of CARDS) expect(row(c.id).dataset.verdict).toBe("right");
    const grade = document.querySelector<HTMLElement>("[data-grade]");
    expect(grade?.dataset.right).toBe("9");
    expect(screen.getByRole("list", { name: "Luật của quầy" })).toBeDefined();
    // No mistake, so no lesson about a kind of mistake.
    expect(grade?.querySelectorAll("[data-miss-lesson]")).toHaveLength(0);
  });

  it("names a wrong pick by where it went, says where it belongs and why", () => {
    show();
    const lookup = firstOf("tra_cuu");
    const store = firstOf("kho_vector");
    pickAll({ [lookup.id]: "kho_vector", [store.id]: "loi_dan" });
    fireEvent.click(check());
    expect(row(lookup.id).dataset.verdict).toBe("vao_kho");
    expect(row(store.id).dataset.verdict).toBe("nhoi_loi_dan");
    const line = row(lookup.id).querySelector("[data-why]")?.textContent ?? "";
    expect(line).toContain(`nên là: ${placeFull("tra_cuu")}`);
    expect(line).toContain(lookup.why);
    // A right card explains itself too, in one line.
    const right = CARDS.find((c) => ![lookup.id, store.id].includes(c.id));
    expect(row(right?.id ?? "").querySelector("[data-why]")?.textContent).toContain(right?.why);

    const grade = document.querySelector<HTMLElement>("[data-grade]");
    expect(grade?.dataset.right).toBe("7");
    expect(grade?.textContent).toContain("1 thẻ nhầm vào kho vector");
    expect(grade?.textContent).toContain("1 thẻ nhồi vào lời dặn");
    expect(grade?.textContent).toContain("0 thẻ ép thành tra cứu");
    // Each kind that happened says what it teaches; the one that did not stays quiet.
    const lessons = [...(grade?.querySelectorAll<HTMLElement>("[data-miss-lesson]") ?? [])];
    expect(lessons.map((el) => el.dataset.missLesson)).toEqual(["vao_kho", "nhoi_loi_dan"]);
  });

  it("calls out a decoy that was followed by its wording", () => {
    show();
    const decoy = CARDS.find((c) => c.lure === "kho_vector");
    if (!decoy?.lure) throw new Error("no decoy");
    pickAll({ [decoy.id]: decoy.lure });
    fireEvent.click(check());
    expect(row(decoy.id).dataset.verdict).toBe("vao_kho");
    expect(row(decoy.id).querySelector("[data-why]")?.textContent).toContain("Mồi nhử");
  });

  it("keeps the keyboard: the grade takes focus, and Làm lại starts on the first card", () => {
    show();
    pickAll();
    fireEvent.click(check());
    expect(document.activeElement).toBe(document.querySelector("[data-grade]"));
    // Locked once graded: nothing changes under the verdicts.
    for (const radio of within(row(CARDS[0]?.id ?? "")).getAllByRole("radio")) {
      expect(radio.matches(":disabled")).toBe(true);
    }
    fireEvent.click(screen.getByRole("button", { name: "Làm lại" }));
    expect(document.querySelector("[data-grade]")).toBeNull();
    expect(row(CARDS[0]?.id ?? "").dataset.verdict).toBeUndefined();
    expect(document.activeElement).toBe(within(row(CARDS[0]?.id ?? "")).getAllByRole("radio")[0]);
  });

  it("leads to the level it warms up for", () => {
    show();
    for (const link of screen.getAllByRole("link", { name: /Thôi bịa điều luật$/ })) {
      expect(link.getAttribute("href")).toBe("/play/library/grounded-citation");
    }
    expect(screen.getByRole("link", { name: "Vào màn Thôi bịa điều luật" })).toBeDefined();
  });
});
