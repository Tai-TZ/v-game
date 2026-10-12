import { describe, expect, it } from "vitest";

import { previewableCase, shouldPreview } from "./preview";

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

describe("previewableCase", () => {
  const level = { visible_cases: [{ id: "lib-l1-v01" }, { id: "lib-l1-v02" }] };
  const cases = [
    { id: "lib-l1-v01", role: "visible" as const },
    { id: "lib-l1-v02", role: "visible" as const },
    { id: "lib-l1-t01", role: "trap" as const },
    { id: "lib-l1-h01", role: "hidden" as const },
  ];

  it("previews the sample the player is following", () => {
    expect(previewableCase("lib-l1-v02", cases, level)).toBe("lib-l1-v02");
  });

  it("falls back to the level's first sample when there is nothing to follow", () => {
    expect(previewableCase(null, [], level)).toBe("lib-l1-v01");
  });

  it.each(["lib-l1-t01", "lib-l1-h01"])("does not ask the server for %s", (id) => {
    // The route only previews samples, and rightly 404s for the rest. Sending the followed id
    // raw meant that after opening one hidden row, every knob the player turned fired a
    // guaranteed 404 and wiped the dome -- for the rest of the session, in silence.
    expect(previewableCase(id, cases, level)).toBe("lib-l1-v01");
  });

  it("falls back when the followed id is not in this run any more", () => {
    expect(previewableCase("lib-l1-v09", cases, level)).toBe("lib-l1-v01");
  });

  it("has nothing to preview on a level with no samples", () => {
    expect(previewableCase(null, [], { visible_cases: [] })).toBeNull();
  });
});
