import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FUSED, LISTS, PASSAGES, rawSumOrder, RRF_K, type ListId } from "./rrf";
import { RrfPage } from "./RrfPage";
import { renderLesson } from "./test-render";

const show = () => renderLesson(<RrfPage />);

afterEach(cleanup);

const chip = (list: ListId, rank: number) => {
  const el = document.querySelector<HTMLButtonElement>(
    `[data-list="${list}"] [data-rank="${rank}"] [data-chip]`,
  );
  if (!el) throw new Error(`no chip ${list} #${rank}`);
  return el;
};
const chips = () => [...document.querySelectorAll<HTMLButtonElement>("[data-chip]")];
const dropAll = () => {
  for (const list of LISTS) list.hits.forEach((_, i) => fireEvent.click(chip(list.id, i + 1)));
};
const funnel = (passage: string) => {
  const el = document.querySelector<HTMLElement>(`[data-fused="${passage}"]`);
  if (!el) throw new Error(`no funnel row ${passage}`);
  return el;
};
const placeButton = (passage: string) => within(funnel(passage)).getByRole("button");
const placeAll = (order: readonly string[]) => {
  for (const passage of order) fireEvent.click(placeButton(passage));
};
const check = () => screen.getByRole("button", { name: "Kiểm tra" });
const label = (passage: string) => PASSAGES.find((p) => p.id === passage)?.label ?? passage;
/** 0,0323: four decimals, a decimal comma. Written apart from the page's own formatter. */
const sum4 = (value: number) => value.toFixed(4).replace(".", ",");
const right = FUSED.map((f) => f.passage);

describe("the RRF-by-hand micro lesson", () => {
  it("shows both lists with their raw scores and a 1/(60 + rank) chip per row", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Tự tay trộn RRF" })).toBeDefined();
    expect(document.body.textContent).toContain("không tốn lượt gọi AI");
    for (const list of LISTS) {
      const box = document.querySelector<HTMLElement>(`[data-list="${list.id}"]`);
      expect(box?.querySelectorAll("[data-chip]")).toHaveLength(list.hits.length);
      list.hits.forEach((hit, i) => {
        expect(chip(list.id, i + 1).textContent).toBe(`1/${RRF_K + i + 1}`);
        expect(box?.querySelector(`[data-rank="${i + 1}"]`)?.getAttribute("data-hit")).toBe(
          hit.passage,
        );
      });
    }
    // Raw scores on their own scales, with a decimal comma.
    expect(document.querySelector('[data-list="vom_sao"]')?.textContent).toContain("0,82");
    expect(document.querySelector('[data-list="tu_ngan_keo"]')?.textContent).toContain("14,3");
  });

  it("drops a chip into its passage's sum, keeps focus on it, and takes it back", () => {
    show();
    const [list, rank] = ["vom_sao", 2] as const;
    const passage = LISTS[0]?.hits[rank - 1]?.passage ?? "";
    const button = chip(list, rank);
    button.focus();
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(funnel(passage).dataset.chips).toBe("1");
    expect(funnel(passage).textContent).toContain(`1/${RRF_K + rank}`);
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(funnel(passage).dataset.chips).toBe("0");
  });

  it("holds the order until every chip is in, and the check until every passage has a place", () => {
    show();
    const total = LISTS.reduce((n, l) => n + l.hits.length, 0);
    expect(document.body.textContent).toContain(`Còn ${total} chip chưa thả.`);
    expect((placeButton(right[0] ?? "") as HTMLButtonElement).disabled).toBe(true);
    dropAll();
    expect(document.body.textContent).toContain(`Còn ${PASSAGES.length} đoạn chưa xếp.`);
    expect((placeButton(right[0] ?? "") as HTMLButtonElement).disabled).toBe(false);
    expect((check() as HTMLButtonElement).disabled).toBe(true);
    placeAll(right);
    expect((check() as HTMLButtonElement).disabled).toBe(false);
  });

  it("numbers passages in the order they are pressed, and takes one out on a second press", () => {
    show();
    dropAll();
    placeAll([right[2] ?? "", right[0] ?? ""]);
    expect(funnel(right[2] ?? "").dataset.place).toBe("1");
    expect(funnel(right[0] ?? "").dataset.place).toBe("2");
    expect(placeButton(right[1] ?? "").textContent).toBe("Xếp hạng 3");
    fireEvent.click(placeButton(right[2] ?? ""));
    expect(funnel(right[2] ?? "").dataset.place).toBeUndefined();
    expect(funnel(right[0] ?? "").dataset.place).toBe("1");
  });

  it("grades the fused order right, with each sum and the raw-score contrast", () => {
    show();
    dropAll();
    placeAll(right);
    fireEvent.click(check());
    const grade = document.querySelector<HTMLElement>("[data-grade]");
    expect(grade?.dataset.right).toBe(String(right.length));
    expect(document.activeElement).toBe(grade);
    for (const f of FUSED) {
      const row = funnel(f.passage);
      expect(row.dataset.verdict, f.passage).toBe("right");
      // The order buttons go; the badge keeps the pick.
      expect(row.querySelector("button")).toBeNull();
      expect(row.dataset.place).toBe(String(right.indexOf(f.passage) + 1));
      const why = row.querySelector("[data-why]")?.textContent ?? "";
      expect(why).toContain(`= ${sum4(f.score)}`);
      expect(why).toContain(f.chips.map((c) => `1/${RRF_K + c.rank}`).join(" + "));
    }
    // The right order, then what adding the raw scores would have given instead.
    const fused = [...(grade?.querySelectorAll("[data-fused-order] li") ?? [])];
    expect(fused.map((li) => li.getAttribute("data-passage"))).toEqual(right);
    const raw = [...(grade?.querySelectorAll("[data-raw-order] li") ?? [])];
    expect(raw.map((li) => li.getAttribute("data-passage"))).toEqual(
      rawSumOrder(LISTS).map((r) => r.passage),
    );
    expect(grade?.textContent).toContain(label(rawSumOrder(LISTS)[0]?.passage ?? ""));
  });

  it("says where a misplaced passage belongs, and why, in one line", () => {
    show();
    dropAll();
    placeAll([right[1] ?? "", right[0] ?? "", ...right.slice(2)]);
    fireEvent.click(check());
    expect(document.querySelector("[data-grade]")?.getAttribute("data-right")).toBe(
      String(right.length - 2),
    );
    const row = funnel(right[0] ?? "");
    expect(row.dataset.verdict).toBe("wrong");
    expect(row.querySelector("[data-why]")?.textContent).toContain("nên ở hạng 1");
    expect(funnel(right[2] ?? "").dataset.verdict).toBe("right");
  });

  it("says which list missed a passage found by only one", () => {
    show();
    dropAll();
    placeAll(right);
    fireEvent.click(check());
    for (const f of FUSED.filter((x) => x.chips.length === 1)) {
      const missing = LISTS.find((l) => l.id !== f.chips[0]?.list);
      expect(funnel(f.passage).querySelector("[data-why]")?.textContent).toContain(
        `${missing?.name ?? ""} không thấy`,
      );
    }
  });

  it("starts over on Làm lại: chips back, order cleared, the keyboard on the first chip", () => {
    show();
    dropAll();
    placeAll(right);
    fireEvent.click(check());
    fireEvent.click(screen.getByRole("button", { name: "Làm lại" }));
    expect(document.querySelector("[data-grade]")).toBeNull();
    expect(chips().every((c) => c.getAttribute("aria-pressed") === "false")).toBe(true);
    for (const p of PASSAGES) {
      expect(funnel(p.id).dataset.chips).toBe("0");
      expect(funnel(p.id).dataset.place).toBeUndefined();
      expect(placeButton(p.id).textContent).toBe("Xếp hạng 1");
    }
    expect(document.activeElement).toBe(chips()[0]);
  });

  it("leads to the level it warms up for", () => {
    show();
    expect(
      screen.getByRole("link", { name: "Vào màn Hỏi bằng số điều" }).getAttribute("href"),
    ).toBe("/play/library/article-number-lookup");
  });
});
