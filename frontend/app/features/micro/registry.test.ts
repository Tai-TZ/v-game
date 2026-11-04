import { readFileSync } from "node:fs";
import path from "node:path";

import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { ZoneContentSchema } from "~/features/zones/schema";

import { findMicro, MICRO_LESSONS, microHref, warmupsBefore } from "./registry";

/** The registry is metadata only (plan v0.7 4.5); the seed is the one source of zone content. */
const zones = v.parse(
  ZoneContentSchema,
  JSON.parse(
    readFileSync(
      path.resolve(process.cwd(), "..", "backend", "src", "vgame", "content", "data", "zones.json"),
      "utf8",
    ),
  ),
).zones;

describe("the micro lesson registry", () => {
  it("lists tool risk and the library's two warm-ups, each before its level", () => {
    expect(MICRO_LESSONS.map((l) => [l.id, l.zone, l.before])).toEqual([
      ["thang-rui-ro-tool", "watchtower", "direct-injection"],
      ["ba-loai-du-lieu", "library", "grounded-citation"],
      ["tu-tay-tron-rrf", "library", "article-number-lookup"],
    ]);
  });

  it("names each lesson's zone and level exactly as the seed does", () => {
    for (const lesson of MICRO_LESSONS) {
      const zone = zones.find((z) => z.id === lesson.zone);
      expect(zone?.name, lesson.id).toBe(lesson.zoneName);
      expect(zone?.levels.find((l) => l.id === lesson.before)?.title, lesson.id).toBe(
        lesson.levelTitle,
      );
    }
  });

  it("finds a lesson under its own zone only", () => {
    expect(findMicro("library", "tu-tay-tron-rrf")?.title).toBe("Tự tay trộn RRF");
    expect(findMicro("watchtower", "tu-tay-tron-rrf")).toBeNull();
    expect(findMicro("library", "khong-co")).toBeNull();
  });

  it("imports nothing but types, so no lesson's content rides along to the zone page", () => {
    // The zone page and the brief import this module; scripts/check-bundle.mjs checks that they
    // never reach a lesson's chunk, and this, that the registry itself carries no content.
    const source = readFileSync(
      path.resolve(process.cwd(), "app", "features", "micro", "registry.ts"),
      "utf8",
    );
    const imports = source.split("\n").filter((line) => line.startsWith("import "));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/^import type /);
  });

  it("offers each warm-up before its own level, and nothing before the others", () => {
    expect(warmupsBefore("library", "grounded-citation").map(microHref)).toEqual([
      "/play/library/vi-mo/ba-loai-du-lieu",
    ]);
    expect(warmupsBefore("library", "article-number-lookup").map(microHref)).toEqual([
      "/play/library/vi-mo/tu-tay-tron-rrf",
    ]);
    expect(warmupsBefore("library", "chunk-tuning")).toEqual([]);
  });
});
