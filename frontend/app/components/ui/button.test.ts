import { describe, expect, it } from "vitest";

import { buttonClass } from "./button";

describe("buttonClass", () => {
  it("lets the control grow for a label that wraps, instead of clipping it", () => {
    // h-11 would clip a wrapped label to one line of glyphs inside a fixed box; min-h-11 grows
    // the row instead. Caught on the history strip's duplicate button at a cramped column width.
    expect(buttonClass("primary")).toContain("min-h-11");
    expect(buttonClass("primary")).not.toMatch(/(?<!min-)h-11\b/);
  });

  it("still renders one line tall for a label that fits, so nothing else moves", () => {
    // min-h-11 sets a floor, not a fixed size: a one-line label is unaffected.
    expect(buttonClass("inline")).toContain("min-h-11");
  });
});
