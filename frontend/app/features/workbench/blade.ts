/**
 * Lược dao: where the blade comes down on the corpus (gameplay-direction §3, L2).
 *
 * The run measures the index as a whole — how many pieces, how many tokens each on average —
 * and never the length of any one piece. So the cuts are spaced by the measured average
 * against the widest size a level offers, and the real count is printed beside the strip
 * rather than drawn as that many ticks: 115 ticks across 300 px is a solid block, not a
 * picture of anything.
 */

/** The largest chunk_size the Library levels offer, so it is the uncut strip. */
const WIDEST = 1024;
/** Beyond this the strip reads as filled, and one more tick says nothing. */
const MAX_CUTS = 24;

/** Positions of the blade's cuts across the strip, as percentages from its left edge. */
export function bladeCuts(avgTokens: number): number[] {
  if (avgTokens <= 0) return [];
  const spacing = (Math.min(avgTokens, WIDEST) / WIDEST) * 100;
  const count = Math.min(Math.floor(100 / spacing) - 1, MAX_CUTS);
  return Array.from({ length: Math.max(count, 0) }, (_, i) => (i + 1) * spacing);
}
