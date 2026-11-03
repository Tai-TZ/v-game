import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HINTS_VI, PRINCIPLE_VI } from "./copy";
import { HintLadder } from "./HintLadder";
import { hintFor, principleOptions, type HintBook, type Principle, type Target } from "./hints";

afterEach(cleanup);

const L1 = "grounded-citation";
const star1: Target = { key: "s1", star: 1, n: 1 };
const star3: Target = { key: "s3", star: 3, n: null };
const book = (opened: number, looked: boolean, key: Target["key"] = "s1"): HintBook => ({
  targets: opened === 0 ? {} : { [key]: { opened, looked } },
  log: [],
  fails: {},
  picks: [],
});

function ladder(
  target: Target,
  b: HintBook,
  levelId = L1,
  gate3 = false,
  variant: string | null = null,
) {
  const onOpen = vi.fn();
  const onPointer = vi.fn();
  const onVariant = vi.fn();
  const onPick = vi.fn();
  const view = render(
    <HintLadder
      levelId={levelId}
      target={target}
      book={b}
      gate3={gate3}
      variant={variant}
      busy={false}
      onOpen={onOpen}
      onPointer={onPointer}
      onVariant={onVariant}
      onPick={onPick}
    />,
  );
  return { onOpen, onPointer, onVariant, onPick, view };
}

describe("HintLadder", () => {
  it("offers hint 1 on request, and shows no hint before it is asked for", () => {
    const { onOpen } = ladder(star1, book(0, false));
    expect(screen.getByText(HINTS_VI.lead(1))).toBeTruthy();
    expect(document.querySelector("[data-hint]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: HINTS_VI.open(1) }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows hint 1 with its case, and says what opens hint 2 instead of a dead button", () => {
    ladder(star1, book(1, false));
    expect(document.querySelector('[data-hint="1"]')?.textContent).toContain("câu #1");
    expect(screen.getByText(HINTS_VI.waitLook)).toBeTruthy();
    expect(screen.queryByRole("button", { name: HINTS_VI.open(2) })).toBeNull();
  });

  it("offers hint 2 once the player has looked", () => {
    ladder(star1, book(1, true));
    expect(screen.getByRole("button", { name: HINTS_VI.open(2) })).toBeTruthy();
    expect(screen.queryByText(HINTS_VI.waitLook)).toBeNull();
  });

  it("holds hint 3 behind its gate, and says what opens it with the count so far", () => {
    const b = { ...book(2, true), fails: { "1": { configs: ["a"], lastSample: false } } };
    ladder(star1, b);
    expect(document.querySelectorAll("[data-hint]")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Xem gợi ý/ })).toBeNull();
    expect(screen.getByText(HINTS_VI.waitGate(1))).toBeTruthy();
  });

  it("offers hint 3 once the gate is open", () => {
    const { onOpen } = ladder(star1, book(2, true), L1, true);
    fireEvent.click(screen.getByRole("button", { name: HINTS_VI.open(3) }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("names hint 3 a worked example, and offers no hint past it", () => {
    ladder(star1, book(3, true), L1, true);
    expect(document.querySelector('[data-hint="3"]')?.textContent).toContain(HINTS_VI.example);
    expect(screen.queryByRole("button", { name: /Xem gợi ý/ })).toBeNull();
    expect(screen.queryByText(/Gợi ý 3 là lời giải mẫu/)).toBeNull();
  });

  it("points at the toy a hint names, by its own name", () => {
    const { onPointer } = ladder(star3, book(1, false, "s3"));
    fireEvent.click(screen.getByRole("button", { name: HINTS_VI.seeSlot("Lăng kính") }));
    expect(onPointer).toHaveBeenCalledWith({
      kind: "slot",
      slot: "llm",
      param: "system_prompt",
    });
  });

  it("points at the case a hint names", () => {
    const { onPointer } = ladder(star1, book(1, false));
    fireEvent.click(screen.getByRole("button", { name: HINTS_VI.seeCase(1) }));
    expect(onPointer).toHaveBeenCalledWith({ kind: "case", n: 1 });
  });

  it("offers no empty box on a level with no ladder written", () => {
    const { view } = ladder(star1, book(0, false), "watchtower-l1");
    expect(view.container.innerHTML).toBe("");
  });
});

describe("the variant after hint 3 (N16)", () => {
  it("offers the variant once hint 3 is open, and runs it on request", () => {
    const { onVariant } = ladder(star1, book(3, true), L1, true, "lib-l1-r01");
    expect(screen.getByRole("heading", { name: HINTS_VI.variantHeading })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: HINTS_VI.variantRun }));
    expect(onVariant).toHaveBeenCalledOnce();
  });

  it("offers no variant before hint 3, nor for a star that has none", () => {
    // Hint 2 open, hint 3's gate still shut: the panel waits, and offers no variant yet.
    ladder(star1, book(2, true), L1, false, "lib-l1-r01");
    expect(screen.queryByRole("button", { name: HINTS_VI.variantRun })).toBeNull();
    cleanup();
    ladder(star1, book(3, true), L1, true, null);
    expect(screen.queryByRole("heading", { name: HINTS_VI.variantHeading })).toBeNull();
  });
});

// Plan v0.7 2.2: "nguyên lý nào?" under each rung, and hint 3's last step left to the player.
describe("the principle under a hint", () => {
  const rung = (target: Target, n: 1 | 2 | 3) => {
    const hint = hintFor(L1, target, n);
    if (!hint) throw new Error("no hint");
    return hint;
  };
  const picked = (
    b: HintBook,
    pick: Principle,
    right: boolean,
    target = star1,
    n: 1 | 2 | 3 = 1,
  ) => ({
    ...b,
    picks: [...b.picks, { at: 1, target: target.key, n, pick, right }],
  });

  it("asks it under hint 1 with four principles of the level, and reports the pick", () => {
    const { onPick } = ladder(star1, book(1, false));
    const ask = document.querySelector('[data-hint="1"] [data-principle="ask"]');
    expect(ask?.textContent).toContain(HINTS_VI.principleAsk);
    const right = rung(star1, 1).principle;
    const options = principleOptions(L1, right);
    expect(ask?.querySelectorAll("button")).toHaveLength(4);
    for (const option of options) {
      expect(screen.getByRole("button", { name: PRINCIPLE_VI[option] })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: PRINCIPLE_VI[right] }));
    expect(onPick).toHaveBeenCalledWith(1, right);
  });

  it("says a wrong pick is wrong and asks again", () => {
    const right = rung(star1, 1).principle;
    const wrong = principleOptions(L1, right).find((p) => p !== right) ?? right;
    ladder(star1, picked(book(1, false), wrong, false));
    expect(screen.getByText(HINTS_VI.principleWrong)).toBeTruthy();
    expect(document.querySelector('[data-hint="1"] [data-principle="ask"]')).not.toBeNull();
    expect(
      screen.getByRole("button", { name: PRINCIPLE_VI[wrong] }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("names the principle once picked right, on every rung that rests on it", () => {
    const right = rung(star1, 1).principle;
    expect(rung(star1, 2).principle).toBe(right);
    ladder(star1, picked(book(2, false), right, true));
    const named = document.querySelectorAll('[data-principle="named"]');
    expect(named).toHaveLength(2);
    expect(named[1]?.textContent).toContain(PRINCIPLE_VI[right]);
    expect(document.querySelector('[data-principle="ask"]')).toBeNull();
  });

  it("asks again where a rung rests on another principle", () => {
    const star3Book = (opened: number) => book(opened, false, "s3");
    const first = rung(star3, 1).principle;
    expect(rung(star3, 2).principle).not.toBe(first);
    ladder(star3, picked(star3Book(2), first, true, star3, 1));
    expect(document.querySelector('[data-hint="1"] [data-principle="named"]')).not.toBeNull();
    expect(document.querySelector('[data-hint="2"] [data-principle="ask"]')).not.toBeNull();
  });
});

describe("hint 3's last step (backward fading)", () => {
  const last = hintFor(L1, star1, 3)?.last ?? "";

  it("holds the last step back after hint 3, and says what shows it", () => {
    ladder(star1, book(3, false), L1, true);
    expect(last.length).toBeGreaterThan(0);
    expect(document.querySelector('[data-hint="3"]')?.textContent).not.toContain(last);
    expect(document.querySelector("[data-hint-last]")?.getAttribute("data-hint-last")).toBe(
      "hidden",
    );
    expect(screen.getByText(HINTS_VI.lastHidden)).toBeTruthy();
    expect(screen.queryByRole("button", { name: HINTS_VI.showLast })).toBeNull();
  });

  it("offers it after a look, and shows it once opened", () => {
    const { onOpen } = ladder(star1, book(3, true), L1, true);
    fireEvent.click(screen.getByRole("button", { name: HINTS_VI.showLast }));
    expect(onOpen).toHaveBeenCalledOnce();
    cleanup();
    ladder(star1, book(4, false), L1, true);
    const shown = document.querySelector('[data-hint-last="shown"]');
    expect(shown?.textContent).toContain(last);
    expect(screen.queryByRole("button", { name: HINTS_VI.showLast })).toBeNull();
    expect(screen.queryByText(HINTS_VI.lastHidden)).toBeNull();
  });

  it("keeps the variant on offer while the last step waits", () => {
    ladder(star1, book(3, true), L1, true, "lib-l1-r01");
    expect(screen.getByRole("button", { name: HINTS_VI.showLast })).toBeTruthy();
    expect(screen.getByRole("button", { name: HINTS_VI.variantRun })).toBeTruthy();
  });
});
