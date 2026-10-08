import { describe, expect, it } from "vitest";

import { selectPacks } from "./catalog.server";

const THEMES = [{ id: "campus" }, { id: "town" }];

describe("selectPacks", () => {
  it("keeps every pack when nothing is listed", () => {
    expect(selectPacks(THEMES, undefined)).toEqual(THEMES);
    expect(selectPacks(THEMES, " , ")).toEqual(THEMES);
  });

  it("keeps only the listed packs, in index order", () => {
    expect(selectPacks(THEMES, " town ")).toEqual([{ id: "town" }]);
    expect(selectPacks(THEMES, "town,campus")).toEqual(THEMES);
  });

  it("fails the build on a pack that does not exist", () => {
    expect(() => selectPacks(THEMES, "town,tonw")).toThrow(/tonw/);
  });
});
