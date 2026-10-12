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

// --- Run history (N3): a summary of the last five runs of a level ---------------------------

const historyKey = (levelId: string) => `vg.history.v1.${levelId}`;
/** Five is what the level's history shows; a sixth costs storage and teaches nothing more. */
const KEEP = 5;

const MarkSchema = v.object({
  /** The graph that ran, byte-exact, so a configuration can be put back or duplicated. */
  body: v.string(),
  /** Minted on write: the reducer's runId dies with the page, and the strip needs an order. */
  at: v.pipe(v.number(), v.integer(), v.minValue(0)),
  stars: v.picklist([0, 1, 2, 3]),
  tokens: Count,
  budget: Count,
  /** Per case, for the regression strip: which case broke when, and under which role. */
  cases: v.array(
    v.object({
      n: Count,
      role: v.picklist(["visible", "hidden", "trap"]),
      passed: v.boolean(),
    }),
  ),
});
const HistorySchema = v.object({ runs: v.array(MarkSchema) });

export type RunMark = v.InferOutput<typeof MarkSchema>;

/**
 * The level's last runs, newest first, or none when there is nothing readable.
 *
 * A summary only: the event log of one L3 run is megabytes of facts, and keeping it would fill
 * the quota a player's bench needs. Everything here is already on the client when a run
 * finishes -- the posted graph, the per-case verdicts, the stars and the tokens.
 */
export function loadHistory(levelId: string): RunMark[] {
  try {
    const raw = window.localStorage.getItem(historyKey(levelId));
    const parsed = raw === null ? null : v.safeParse(HistorySchema, JSON.parse(raw));
    return parsed?.success ? parsed.output.runs : [];
  } catch {
    return [];
  }
}

/** Best effort: a browser with storage blocked keeps playing, it just has no history. */
export function recordRun(levelId: string, mark: RunMark): void {
  try {
    const runs = [mark, ...loadHistory(levelId)].slice(0, KEEP);
    window.localStorage.setItem(historyKey(levelId), JSON.stringify({ runs }));
  } catch {
    // Blocked or full storage: this run simply is not remembered.
  }
}
