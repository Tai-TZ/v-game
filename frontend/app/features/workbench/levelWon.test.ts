import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PROGRESS_KEY } from "~/features/progress/progress";

import type { RunView } from "./run";
import { testEnv } from "./test-fixtures";
import { useLevelWon } from "./WorkbenchPage";

const level = testEnv("chunk-tuning").level;

/** A finished run as the bench holds it; only the fields the world flag reads. */
function finished(stars: number, scope?: RunView["scope"]): RunView {
  return {
    runId: "r1",
    phase: "finished",
    cases: [],
    ingestion: [],
    score: { stars },
    ...(scope ? { scope } : {}),
  } as unknown as RunView;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("the world flag of a level", () => {
  it("is down with no star saved and no run", () => {
    expect(renderHook(() => useLevelWon(level, null)).result.current).toBe(false);
  });

  it("is up once this browser holds a star for the level", () => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ library: { [level.id]: 1 } }));
    expect(renderHook(() => useLevelWon(level, null)).result.current).toBe(true);
  });

  it("does not take another level's star", () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ library: { "grounded-citation": 3 } }),
    );
    expect(renderHook(() => useLevelWon(level, null)).result.current).toBe(false);
  });

  it("goes up the moment a scored run earns a star", () => {
    expect(renderHook(() => useLevelWon(level, finished(1))).result.current).toBe(true);
    expect(renderHook(() => useLevelWon(level, finished(0))).result.current).toBe(false);
  });

  // A recorded run carries the stars of whoever recorded it, and a sample run earns none:
  // neither is the player's result, so neither may take the poster down.
  it("ignores the stars of a recorded run or a sample run", () => {
    expect(renderHook(() => useLevelWon(level, finished(3, "da_ghi"))).result.current).toBe(false);
    expect(renderHook(() => useLevelWon(level, finished(3, "mau"))).result.current).toBe(false);
  });
});
