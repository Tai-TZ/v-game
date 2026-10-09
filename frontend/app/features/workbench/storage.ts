import * as v from "valibot";

import { benchFromGraph, type Bench, type Env } from "./bench";
import { CONFIDENCE, EMPTY_SLIP, isEmptySlip, type Slip } from "./guess";
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

// --- Guess slip draft (B1): per level, dropped once a run takes it ---------------------------

const slipKey = (levelId: string) => `vg.guess.v1.${levelId}`;
const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
const SlipSchema = v.object({
  passed: v.nullable(Count),
  failing: v.array(Count),
  bets: v.record(v.string(), v.object({ pass: v.boolean(), confidence: v.picklist(CONFIDENCE) })),
});

/** The draft slip of a level, or an empty one when there is none or it cannot be read. */
export function loadSlip(levelId: string): Slip {
  try {
    const raw = window.localStorage.getItem(slipKey(levelId));
    const parsed = raw === null ? null : v.safeParse(SlipSchema, JSON.parse(raw));
    return parsed?.success ? parsed.output : EMPTY_SLIP;
  } catch {
    return EMPTY_SLIP;
  }
}

/** Best effort: an empty slip removes the draft. */
export function saveSlip(levelId: string, slip: Slip): void {
  try {
    if (isEmptySlip(slip)) window.localStorage.removeItem(slipKey(levelId));
    else window.localStorage.setItem(slipKey(levelId), JSON.stringify(slip));
  } catch {
    // Blocked or full storage: the slip still works for this visit.
  }
}
