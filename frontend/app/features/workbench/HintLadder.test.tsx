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
});

function ladder(target: Target, b: HintBook, levelId = L1) {
  const onOpen = vi.fn();
  const onPointer = vi.fn();
  const view = render(
    <HintLadder levelId={levelId} target={target} book={b} onOpen={onOpen} onPointer={onPointer} />,
  );
  return { onOpen, onPointer, view };
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

  it("offers nothing past hint 2, which is all this ladder has", () => {
    ladder(star1, book(2, true));
    expect(document.querySelectorAll("[data-hint]")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Xem gợi ý/ })).toBeNull();
    expect(screen.queryByText(HINTS_VI.waitLook)).toBeNull();
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
