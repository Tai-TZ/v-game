import { afterEach, describe, expect, it, vi } from "vitest";

import { hasStar, levelStars, PROGRESS_KEY, readProgress, recordStars } from "./progress";

afterEach(() => window.localStorage.clear());

describe("progress", () => {
  it("starts empty and keeps the best result of each level", () => {
    expect(readProgress()).toEqual({});
    recordStars("library", "grounded-citation", 2);
    recordStars("library", "grounded-citation", 1);
    recordStars("library", "chunk-tuning", 0);
    const progress = readProgress();
    expect(levelStars(progress, "library", "grounded-citation")).toBe(2);
    expect(levelStars(progress, "library", "chunk-tuning")).toBe(0);
    expect(levelStars(progress, "market", "model-routing")).toBe(0);
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "")).toEqual({
      library: { "grounded-citation": 2, "chunk-tuning": 0 },
    });
  });

  it("lights a zone only from one star up", () => {
    recordStars("library", "chunk-tuning", 0);
    expect(hasStar(readProgress(), "library")).toBe(false);
    recordStars("library", "chunk-tuning", 1);
    expect(hasStar(readProgress(), "library")).toBe(true);
    expect(hasStar(readProgress(), "watchtower")).toBe(false);
  });

  it("drops bad entries one by one and reads junk as no progress", () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        library: { "grounded-citation": 3, "chunk-tuning": 7, Bad: 1 },
        "../x": { a1: 1 },
        market: [1, 2],
      }),
    );
    expect(readProgress()).toEqual({ library: { "grounded-citation": 3 } });
    window.localStorage.setItem(PROGRESS_KEY, "{not json");
    expect(readProgress()).toEqual({});
  });

  it("never writes through inherited keys such as constructor", () => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ constructor: { keys: 1 } }));
    expect(readProgress()).toEqual({ constructor: { keys: 1 } });
    expect(typeof Object.keys).toBe("function");
    window.localStorage.clear();
    const progress = readProgress();
    expect(levelStars(progress, "library", "constructor")).toBe(0);
    expect(levelStars(progress, "constructor", "keys")).toBe(0);
    expect(hasStar(progress, "constructor")).toBe(false);
    recordStars("constructor", "assign", 2);
    expect(typeof Object.assign).toBe("function");
    expect(levelStars(readProgress(), "constructor", "assign")).toBe(2);
  });

  it("works without storage and refuses ids that are not content slugs", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readProgress()).toEqual({});
    expect(recordStars("library", "grounded-citation", 1)).toEqual({
      library: { "grounded-citation": 1 },
    });
    expect(() => recordStars("Library", "grounded-citation", 1)).toThrow();
  });
});
