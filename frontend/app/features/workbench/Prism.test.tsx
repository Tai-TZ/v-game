import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { setCard, starterBench, type Bench } from "./bench";
import { Prism } from "./Prism";
import { testEnv } from "./test-fixtures";

afterEach(cleanup);

const l1 = testEnv("grounded-citation");

function starter(): Bench {
  const bench = starterBench(l1);
  if (!bench) throw new Error("L1 starter is not drawable");
  return bench;
}

function draw(bench: Bench) {
  const changes: Bench[] = [];
  render(<Prism env={l1} bench={bench} onChange={(next) => changes.push(next)} />);
  return changes;
}

const card = (key: string) => {
  const found = document.querySelector<HTMLButtonElement>(`[data-deck-card="${key}"]`);
  if (!found) throw new Error(`no card ${key} in the deck`);
  return found;
};
const slot = (n: number) => {
  const found = document.querySelector<HTMLElement>(`[data-lens-slot="${n}"]`);
  if (!found) throw new Error(`no lens slot ${n}`);
  return found;
};

/** A drop with the card's key on it, as a real drag carries it. */
function dropOn(target: HTMLElement, key: string) {
  const data = new Map([["text/plain", key]]);
  const dataTransfer = { getData: (type: string) => data.get(type) ?? "", dropEffect: "move" };
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe("the Lăng kính as cards in three slots", () => {
  it("lays the level's whole deck out as cards, each with its own words", () => {
    draw(starter());
    const keys = Object.keys(l1.level.prompt_cards);
    expect(
      [...document.querySelectorAll("[data-deck-card]")].map((c) =>
        c.getAttribute("data-deck-card"),
      ),
    ).toEqual(keys);
    for (const key of keys) {
      expect(card(key).textContent).toContain(l1.level.prompt_cards[key]);
    }
  });

  it("draws three slots, each showing the card it holds or that it is empty", () => {
    draw({ ...starter(), cards: ["G1", null, "G3"] });
    expect([0, 1, 2].map((n) => slot(n).getAttribute("data-card"))).toEqual(["G1", "", "G3"]);
  });

  it("puts a pressed card into the first empty slot", () => {
    const bench = { ...starter(), cards: ["G1", null, null] as const };
    const changes = draw(bench);
    fireEvent.click(card("G3"));
    expect(changes.at(-1)).toEqual(setCard(bench, 1, "G3"));
  });

  it("takes a card back out when it is pressed again", () => {
    const bench = { ...starter(), cards: [null, "G2", null] as const };
    const changes = draw(bench);
    expect(card("G2").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(card("G2"));
    expect(changes.at(-1)).toEqual(setCard(bench, 1, null));
  });

  it("empties a slot when the card in it is pressed", () => {
    const bench = { ...starter(), cards: ["G1", null, "G3"] as const };
    const changes = draw(bench);
    fireEvent.click(slot(2));
    expect(changes.at(-1)).toEqual(setCard(bench, 2, null));
  });

  it("holds the rest of the deck back once all three slots are full", () => {
    draw({ ...starter(), cards: ["G1", "G2", "G3"] });
    expect(card("G4").disabled).toBe(true);
    expect(card("G1").disabled).toBe(false);
    expect(screen.getByText(/Ba khe đã đầy/)).toBeDefined();
  });

  it("drops a dragged card into the slot it lands on, moving it if it sat elsewhere", () => {
    const bench = { ...starter(), cards: ["G1", null, null] as const };
    const changes = draw(bench);
    dropOn(slot(2), "G4");
    expect(changes.at(-1)).toEqual(setCard(bench, 2, "G4"));
    dropOn(slot(2), "G1");
    expect(changes.at(-1)).toEqual(setCard(setCard(bench, 0, null), 2, "G1"));
  });

  it("ignores a drop that carries no card of this level", () => {
    const changes = draw(starter());
    dropOn(slot(0), "G99");
    dropOn(slot(0), "");
    expect(changes).toEqual([]);
  });

  it("says how long the prompt the slots build is", () => {
    draw({ ...starter(), cards: ["G1", null, null] });
    expect(screen.getByText(/Dặn dò: \d+ ký tự/)).toBeDefined();
  });
});
