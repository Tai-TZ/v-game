import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderLesson } from "./test-render";
import { ToolRiskPage } from "./ToolRiskPage";
import { CARDS, LANES, type LaneId } from "./toolRisk";

const show = () => renderLesson(<ToolRiskPage />);

afterEach(cleanup);

const row = (id: string) => {
  const el = document.querySelector<HTMLElement>(`[data-card="${id}"]`);
  if (!el) throw new Error(`no card ${id}`);
  return el;
};
const pick = (id: string, lane: LaneId) => {
  const label = LANES.find((l) => l.id === lane)?.label ?? "";
  fireEvent.click(within(row(id)).getByRole("radio", { name: label }));
};
const pickAll = (override: Record<string, LaneId> = {}) => {
  for (const c of CARDS) pick(c.id, override[c.id] ?? c.lane);
};
const check = () => screen.getByRole("button", { name: "Kiểm tra" });

describe("the tool-risk micro lesson", () => {
  it("lays out eight jobs with four lanes each, and says it costs nothing", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Thang rủi ro tool" })).toBeDefined();
    expect(document.querySelectorAll("[data-card]")).toHaveLength(8);
    for (const c of CARDS) expect(within(row(c.id)).getAllByRole("radio")).toHaveLength(4);
    expect(document.body.textContent).toContain("không tốn lượt gọi AI");
  });

  it("holds the check until every job has a lane", () => {
    show();
    expect((check() as HTMLButtonElement).disabled).toBe(true);
    pickAll();
    expect((check() as HTMLButtonElement).disabled).toBe(false);
  });

  it("marks every lane right when all are, and states the rule", () => {
    show();
    pickAll();
    fireEvent.click(check());
    for (const c of CARDS) expect(row(c.id).dataset.verdict).toBe("right");
    expect(document.querySelector("[data-grade]")?.getAttribute("data-right")).toBe("8");
    expect(screen.getByRole("list", { name: "Luật của quầy" })).toBeDefined();
  });

  it("calls a strict lane on the read-only decoy asking for nothing, and a loose one a leak", () => {
    show();
    const decoy = CARDS.find((c) => c.decoy);
    if (!decoy) throw new Error("no decoy");
    pickAll({ [decoy.id]: "luon_hoi", "xoa-tai-khoan": "tu_chay" });
    fireEvent.click(check());
    expect(row(decoy.id).dataset.verdict).toBe("over");
    expect(row("xoa-tai-khoan").dataset.verdict).toBe("under");
    const grade = document.querySelector<HTMLElement>("[data-grade]");
    expect(grade?.dataset.right).toBe("6");
    expect(grade?.textContent).toContain("1 việc để lọt");
    expect(grade?.textContent).toContain("1 việc hỏi thừa");
    // The reason is there, not only the verdict.
    expect(row(decoy.id).textContent).toContain(decoy.why);
  });

  it("starts over on 'Làm lại', and leads to the level it warms up for", () => {
    show();
    pickAll();
    fireEvent.click(check());
    expect(document.activeElement).toBe(document.querySelector("[data-grade]"));
    fireEvent.click(screen.getByRole("button", { name: "Làm lại" }));
    expect(document.querySelector("[data-grade]")).toBeNull();
    expect(row(CARDS[0]?.id ?? "").dataset.verdict).toBeUndefined();
    // The keyboard starts over on the first job, not on <body>.
    expect(document.activeElement).toBe(within(row(CARDS[0]?.id ?? "")).getAllByRole("radio")[0]);
    expect(screen.getByRole("link", { name: "Vào màn Cổng thành" }).getAttribute("href")).toBe(
      "/play/watchtower/direct-injection",
    );
  });

  it("draws the four lanes as a scale, loosest to strictest, numbered", () => {
    show();
    const steps = [...row(CARDS[0]?.id ?? "").querySelectorAll<HTMLElement>("[data-step]")];
    expect(steps.map((el) => el.dataset.step)).toEqual(["1", "2", "3", "4"]);
    // The number is drawn but hidden from the radio's name, which stays the lane's label.
    expect(steps.map((el) => el.textContent)).toEqual(LANES.map((l, i) => `${i + 1}${l.label}`));
    // Each step fills as many marks as its number: order without relying on colour.
    expect(steps.map((el) => el.querySelectorAll("[data-mark-on]").length)).toEqual([1, 2, 3, 4]);
  });
});
