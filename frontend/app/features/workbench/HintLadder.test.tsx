import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HINTS_VI } from "./copy";
import { HintLadder } from "./HintLadder";
import type { HintBook, Target } from "./hints";

afterEach(cleanup);

const L1 = "grounded-citation";
const star1: Target = { key: "s1", star: 1, n: 1 };
const star3: Target = { key: "s3", star: 3, n: null };
const book = (opened: number, looked: boolean, key: Target["key"] = "s1"): HintBook => ({
  targets: opened === 0 ? {} : { [key]: { opened, looked } },
  log: [],
  fails: {},
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
    />,
  );
  return { onOpen, onPointer, onVariant, view };
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

  it("names hint 3 a worked example, and offers nothing past it", () => {
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
