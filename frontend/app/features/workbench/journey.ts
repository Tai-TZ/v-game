/**
 * "Đường đời hạng": where the answer passage sat in each block that ranked it
 * (gameplay-direction §3, L3 — "#23 → #1 → #2 → #1").
 *
 * `GoldReveal.ranks` already carries this, keyed by node, and `GoldTrace` already says it in
 * words. This turns it into the order the graph ran, with the direction of each hop, so a
 * picture can show the answer climbing out of the deep end or falling back into it.
 */

export type Move = "start" | "up" | "down" | "same";

export interface JourneyStep {
  node: string;
  /** Rank in that block's full ranking; null when the block never found the passage. */
  rank: number | null;
  move: Move;
}

/** A missing rank sits below every real one: nowhere is worse than last. */
const place = (rank: number | null) => rank ?? Number.POSITIVE_INFINITY;

export function rankJourney(
  ranks: Readonly<Record<string, number | null>>,
  order: readonly string[],
): JourneyStep[] {
  const steps: JourneyStep[] = [];
  for (const node of order) {
    if (!(node in ranks)) continue;
    const rank = ranks[node] ?? null;
    const previous = steps.at(-1);
    const move: Move =
      previous === undefined
        ? "start"
        : place(rank) < place(previous.rank)
          ? "up" // a smaller rank is a better place
          : place(rank) > place(previous.rank)
            ? "down"
            : "same";
    steps.push({ node, rank, move });
  }
  return steps;
}
