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
