/**
 * Stars earned per level, kept in this browser only (N9, 2026-10-08).
 *
 * - The workbench calls `recordStars(zoneId, levelId, stars)` when a graded run finishes. Only a
 *   better result is saved, so replaying a level never loses stars.
 * - `/play` calls `readProgress()` when the scene mounts and lights the windows of every open
 *   zone where `hasStar(progress, zoneId)` is true (campus-scene v0.3 §13); of every open zone
 *   while `STARS_SAVED` is false.
 *
 * Storage: localStorage key `vg-progress-v1`, JSON `{ [zoneId]: { [levelId]: 0 | 1 | 2 | 3 } }`,
 * ids as in `zones.json`. A new shape gets a new key (`vg-progress-v2`) rather than a migration
 * in place. Blocked storage or unreadable data reads as no progress; invalid entries are dropped
 * one by one, so one bad entry never wipes the rest. Nothing here talks to the server.
 */
export const PROGRESS_KEY = "vg-progress-v1";

/**
 * Whether anything saves stars yet. False until the workbench calls `recordStars` on a scored
 * run: until then no player can earn a star, so `siteLooks` keeps every open zone lit as in v0.3
 * instead of showing dark windows nobody can light (QA r2, 2026-10-08). Flip it in the change
 * that adds that call (open handoff: campus-scene v0.3 §13.5).
 */
export const STARS_SAVED = false as boolean; // a switch: typed for both values

export type Stars = 0 | 1 | 2 | 3;
export type Progress = Readonly<Record<string, Readonly<Record<string, Stars>>>>;

/** Same rule as the content ids (zones.json slugs). */
const ID = /^[a-z][a-z0-9-]{1,31}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStars = (value: unknown): value is Stars =>
  value === 0 || value === 1 || value === 2 || value === 3;
/** Own keys only: `constructor` is a valid slug, and `{}.constructor` is the global `Object`. */
const own = <T>(map: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
  map && Object.hasOwn(map, key) ? map[key] : undefined;

/** Keeps only well-formed entries of whatever the storage held. */
function clean(data: unknown): Record<string, Record<string, Stars>> {
  // Prototype-less maps, so a `constructor` zone writes a key instead of into `Object`.
  const progress = Object.create(null) as Record<string, Record<string, Stars>>;
  if (!isRecord(data)) return progress;
  for (const [zoneId, levels] of Object.entries(data)) {
    if (!ID.test(zoneId) || !isRecord(levels)) continue;
    for (const [levelId, stars] of Object.entries(levels)) {
      if (!ID.test(levelId) || !isStars(stars)) continue;
      (progress[zoneId] ??= Object.create(null) as Record<string, Stars>)[levelId] = stars;
    }
  }
  return progress;
}

export function readProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? clean(JSON.parse(raw)) : {};
  } catch {
    return {}; // storage blocked (private mode, policy), no window (server), or not JSON
  }
}

/**
 * Saves a level's result if it beats the stored one and returns the progress after the call.
 * Throws on ids that are not content slugs: a typo would otherwise be dropped on the next read.
 */
export function recordStars(zoneId: string, levelId: string, stars: Stars): Progress {
  if (!ID.test(zoneId) || !ID.test(levelId) || !isStars(stars)) {
    throw new Error(`Invalid progress entry: ${zoneId}/${levelId} = ${String(stars)}`);
  }
  const progress = clean(readProgress());
  const zone = own(progress, zoneId) ?? {};
  if ((own(zone, levelId) ?? -1) >= stars) return progress;
  progress[zoneId] = { ...zone, [levelId]: stars };
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Saving is best effort; the result still shows for this visit.
  }
  return progress;
}

export function levelStars(progress: Progress, zoneId: string, levelId: string): Stars {
  return own(own(progress, zoneId), levelId) ?? 0;
}

/** True once any level of the zone has at least one star. */
export function hasStar(progress: Progress, zoneId: string): boolean {
  return Object.values(own(progress, zoneId) ?? {}).some((stars) => stars >= 1);
}
