import { readFile } from "node:fs/promises";
import path from "node:path";

import * as v from "valibot";

import { ZoneContentSchema, type Zone } from "./schema";

// Single source of truth for zone content is the backend seed file; the pre-rendered
// landing page reads it at build time instead of keeping a second copy.
const CONTENT_FILE = path.resolve(
  process.cwd(),
  "..",
  "backend",
  "src",
  "vgame",
  "content",
  "data",
  "zones.json",
);

export async function loadZoneContent(): Promise<Zone[]> {
  const raw = JSON.parse(await readFile(CONTENT_FILE, "utf8")) as unknown;
  return v.parse(ZoneContentSchema, raw).zones;
}
