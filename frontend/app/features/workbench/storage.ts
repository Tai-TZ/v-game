import * as v from "valibot";

import { benchFromGraph, type Bench, type Env } from "./bench";
import { GraphSchema, type Graph } from "./schema";

/**
 * The player's last graph per level, in this browser only (W8). Every access is wrapped: storage
 * can be blocked, full or cleared, and the page must work without it.
 */
const key = (levelId: string) => `vg.bench.v1.${levelId}`;
const SavedSchema = v.object({ version: v.number(), graph: GraphSchema });

export interface Saved {
  bench: Bench | null;
  /** A saved graph existed but no longer fits the level (version, values, shape). */
  discarded: boolean;
}

export function loadSaved(env: Env): Saved {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key(env.level.id));
  } catch {
    return { bench: null, discarded: false };
  }
  if (raw === null) return { bench: null, discarded: false };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { bench: null, discarded: true };
  }
  const parsed = v.safeParse(SavedSchema, json);
  if (!parsed.success || parsed.output.version !== env.level.version) {
    return { bench: null, discarded: true };
  }
  const bench = benchFromGraph(env, parsed.output.graph);
  return { bench, discarded: bench === null };
}

/** True when the graph was written. */
export function save(levelId: string, version: number, graph: Graph): boolean {
  try {
    window.localStorage.setItem(key(levelId), JSON.stringify({ version, graph }));
    return true;
  } catch {
    return false;
  }
}
