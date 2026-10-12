import type { BenchRun } from "./run";

/**
 * Whether the dome should show a preview of the bench as it stands, rather than the facts of
 * the run on screen (vom-sao-v0.1 §4 phase 2).
 *
 * The rule is about honesty, not freshness. A finished run measured what it pulled, so a
 * preview of the same graph would only be a weaker copy of it. But the moment the player edits
 * the bench, the run's facts describe a configuration that is no longer on screen — and that
 * picture is the one that misleads.
 */
export const shouldPreview = (bench: BenchRun): boolean => bench === "none" || bench === "stale";

/**
 * The case the dome should preview: the sample the player follows, or the level's first sample.
 *
 * The route previews samples only -- a hidden or trap case is the measurement the level withholds
 * -- so a followed secret case falls back here rather than being sent and 404ing. It also drops
 * an id that the current run no longer has.
 */
export function previewableCase(
  followed: string | null,
  cases: readonly { id: string; role: string }[],
  level: { visible_cases: readonly { id: string }[] },
): string | null {
  const sample = cases.find((c) => c.id === followed && c.role === "visible");
  return sample?.id ?? level.visible_cases[0]?.id ?? null;
}
