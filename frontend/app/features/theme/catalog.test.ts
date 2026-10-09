import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { selectPacks } from "./catalog.server";
import { parseThemeIndex, parseThemeManifest } from "./schema";

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

describe("theme manifests", () => {
  const dir = path.resolve(process.cwd(), "public", "themes");
  const read = (file: string): unknown => JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  const manifests = parseThemeIndex(read("index.json")).map(({ id }) =>
    parseThemeManifest(read(`${id}/manifest.json`)),
  );

  it("name the four hub NPCs, each once, honorific first in lower case (npc-cast v0.4 §8)", () => {
    expect(manifests.length).toBeGreaterThan(1);
    for (const { campus } of manifests) {
      const names = Object.values(campus.npcs).map((look) => look.name);
      expect(Object.keys(campus.npcs)).toEqual(["guard", "registrar", "operator", "examiner"]);
      expect(new Set(names).size).toBe(4);
      for (const name of names) expect(name).toMatch(/^\p{Ll}+ /u);
    }
  });
});

describe("theme sky data (campus v0.4 W2)", () => {
  const dir = path.resolve(process.cwd(), "public", "themes");
  const ids = parseThemeIndex(JSON.parse(readFileSync(path.join(dir, "index.json"), "utf8"))).map(
    (theme) => theme.id,
  );
  const SKY_TOKENS = [
    "--vg-scene-sky",
    "--vg-scene-dawn",
    "--vg-scene-dusk",
    "--vg-scene-night",
    "--vg-scene-cloud",
    "--vg-scene-cloud-night",
  ];

  it.each(ids)("declares every sky token in %s/theme.css", (id) => {
    const css = readFileSync(path.join(dir, id, "theme.css"), "utf8");
    for (const token of SKY_TOKENS) expect(css, token).toMatch(new RegExp(`${token}:\\s*#`));
  });

  it("refuses a place with an unknown time zone", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(dir, ids[0] ?? "town", "manifest.json"), "utf8"),
    ) as { place: Record<string, unknown> };
    manifest.place.timeZone = "Asia/Atlantis";
    expect(() => parseThemeManifest(manifest)).toThrow(/time zone/);
  });
});
