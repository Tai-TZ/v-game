import { describe, expect, it } from "vitest";

import { shouldPreview } from "./preview";

describe("shouldPreview", () => {
  it("previews before the first run, so the bench answers from the first knob", () => {
    expect(shouldPreview("none")).toBe(true);
  });

  it("previews once the bench no longer matches the run on show", () => {
    // "stale" is exactly the state where the picture would otherwise be a lie: it shows what
    // the last run pulled while the player is looking at a bench that would pull something else.
    expect(shouldPreview("stale")).toBe(true);
  });

  it("leaves the run's own facts alone while it runs and after it finishes", () => {
    // A finished run measured the real thing; a preview of the same graph would only be a
    // second, weaker copy of it.
    expect(shouldPreview("active")).toBe(false);
    expect(shouldPreview("done")).toBe(false);
  });
});
