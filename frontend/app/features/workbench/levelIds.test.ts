import { readFileSync } from "node:fs";
import path from "node:path";

import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { ZoneContentSchema } from "~/features/zones/schema";

import { LEVEL_IDS, WATCHTOWER_IDS } from "./test-fixtures";

/**
 * The fixtures' level lists keep literal types for `testEnv(id)`, so they are written out; this
 * keeps them in step with zones.json, the one source of zone content (backend levels.py reads
 * the same list for its exporters).
 */
const seed = v.parse(
  ZoneContentSchema,
  JSON.parse(
    readFileSync(
      path.resolve(process.cwd(), "..", "backend", "src", "vgame", "content", "data", "zones.json"),
      "utf8",
    ),
  ),
);
const openLevels = (zoneId: string) =>
  [...(seed.zones.find((z) => z.id === zoneId)?.levels ?? [])]
    .sort((a, b) => a.order - b.order)
    .filter((level) => level.status === "open")
    .map((level) => level.id);

describe("the fixtures' level lists", () => {
  it("are the open levels of each zone, in play order", () => {
    expect([...LEVEL_IDS]).toEqual(openLevels("library"));
    expect([...WATCHTOWER_IDS]).toEqual(openLevels("watchtower"));
  });
});
