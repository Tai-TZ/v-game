import * as v from "valibot";

import type { TargetKey } from "./hints";

/**
 * The variant after hint 3 (N16; L1 §11): one review case of the same lesson, which the player
 * fixes the bench for without a hint. Which review cases teach which star is daily-shift §2's
 * table. Stars with none -- L1 and L2 star 2, the run's whole budget, and L3 star 3 unless its
 * paraphrase trap t01 failed -- have the next star run as their self-fix instead.
 */
const VARIANTS: Readonly<Record<string, Partial<Record<TargetKey, readonly string[]>>>> = {
  "grounded-citation": {
    s1: ["lib-l1-r01", "lib-l1-r04"],
    s1_source: ["lib-l1-r01", "lib-l1-r04"],
    s3: ["lib-l1-r02", "lib-l1-r03"],
  },
  "chunk-tuning": {
    s1: ["lib-l2-r01", "lib-l2-r03"],
    s3: ["lib-l2-r02", "lib-l2-r04"],
  },
  "article-number-lookup": {
    s1: ["lib-l3-r01", "lib-l3-r02", "lib-l3-r04"],
    s3_t01: ["lib-l3-r02"],
    // Checks the "Kính lúp giữ đúng đoạn" half of the hint, not the budget.
    s2: ["lib-l3-r03"],
  },
};

/** The review case met least often for this target, the list's own order breaking ties. */
export function pickVariant(
  levelId: string,
  target: TargetKey,
  seen: Readonly<Record<string, number>>,
): string | null {
  const cases = VARIANTS[levelId]?.[target];
  if (!cases || cases.length === 0) return null;
  return cases.reduce((best, id) => ((seen[id] ?? 0) < (seen[best] ?? 0) ? id : best));
}

const key = (levelId: string) => `vg.variants.v1.${levelId}`;
const SeenSchema = v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0)));

/** How often each review case of the level was run as a variant in this browser. */
export function loadSeen(levelId: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(key(levelId));
    const json: unknown = raw === null ? null : JSON.parse(raw);
    // valibot's record takes an array as {"0": …}: an array is no store of ours.
    if (Array.isArray(json)) return {};
    const parsed = v.safeParse(SeenSchema, json);
    return parsed.success ? parsed.output : {};
  } catch {
    return {};
  }
}

/** Marks a case met, so the next variant of the same lesson is another one. */
export function markSeen(levelId: string, caseId: string): void {
  const seen = loadSeen(levelId);
  try {
    window.localStorage.setItem(
      key(levelId),
      JSON.stringify({ ...seen, [caseId]: (seen[caseId] ?? 0) + 1 }),
    );
  } catch {
    /* the next pick may repeat this case; nothing else depends on it */
  }
}
