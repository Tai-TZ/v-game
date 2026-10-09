import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseThemeIndex, parseThemeManifest } from "~/features/theme/schema";

import { NPCS } from "./layout";
import { linesFor, NPC_ROLES } from "./npcs";

const THEMES = path.resolve(process.cwd(), "public", "themes");
const read = (file: string): unknown => JSON.parse(readFileSync(path.join(THEMES, file), "utf8"));
/** Every NPC display name of every pack: theme data only, never core code (npc-cast v0.4 §2). */
const NAMES = parseThemeIndex(read("index.json")).flatMap(({ id }) =>
  Object.values(parseThemeManifest(read(`${id}/manifest.json`)).campus.npcs).map((n) => n.name),
);

const ALL_LINES = Object.values(NPC_ROLES).flatMap((role) => [
  ...role.greeting,
  ...role.coming_soon,
  ...role.open,
]);

/** Sentences: runs ending in . ? ! (a closing quote may follow), or at the end of the line. */
const sentences = (line: string) => line.split(/(?<=[.?!])['"”]?\s+/).filter(Boolean);

describe("NPC lines (npc-cast v0.4 §3)", () => {
  it("has a role for every NPC in layout, with a greeting of two turns and three of each set", () => {
    expect(Object.keys(NPC_ROLES).sort()).toEqual(NPCS.map((n) => n.id).sort());
    for (const role of Object.values(NPC_ROLES)) {
      expect(role.greeting).toHaveLength(2);
      expect(role.coming_soon).toHaveLength(3);
      expect(role.open).toHaveLength(3);
    }
  });

  it("keeps every turn to two sentences at most, each one finished", () => {
    for (const line of ALL_LINES) {
      expect(sentences(line).length, line).toBeLessThanOrEqual(2);
      expect(line, line).toMatch(/[.?!]$/);
    }
  });

  it("never says the three banned words", () => {
    for (const line of ALL_LINES) expect(line, line).not.toMatch(/\blab\b|bài tập|lý thuyết/iu);
  });

  it("names nobody from a theme pack, in the lines or anywhere in the app's code", () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(8);
    const lower = (s: string) => s.toLocaleLowerCase("vi");
    for (const line of ALL_LINES) {
      for (const name of NAMES) expect(lower(line), line).not.toContain(lower(name));
    }
    const root = path.resolve(process.cwd(), "app");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) ? [full] : [];
      });
    for (const file of walk(root)) {
      const text = lower(readFileSync(file, "utf8"));
      for (const name of NAMES)
        expect(text.includes(lower(name)), `${name} in ${file}`).toBe(false);
    }
  });
});

describe("linesFor", () => {
  it("greets on the first visit, then turns through the set for the zone's status", () => {
    const guard = NPC_ROLES.guard;
    expect(linesFor("guard", 0, "coming_soon")).toEqual(guard.greeting);
    expect(linesFor("guard", 1, "coming_soon")).toEqual([guard.coming_soon[0]]);
    expect(linesFor("guard", 3, "coming_soon")).toEqual([guard.coming_soon[2]]);
    expect(linesFor("guard", 4, "coming_soon")).toEqual([guard.coming_soon[0]]);
    expect(linesFor("guard", 2, "open")).toEqual([guard.open[1]]);
  });

  it("keeps a role without a zone on its 'not open yet' set", () => {
    expect(NPC_ROLES.registrar.zone).toBeNull();
    expect(linesFor("registrar", 1, "open")).toEqual([NPC_ROLES.registrar.coming_soon[0]]);
    expect(NPC_ROLES.guard.zone).toBe("watchtower");
  });
});
