/**
 * "Đường đời hạng": where the answer passage sat in each block that ranked it
 * (gameplay-direction §3, L3 — "#23 → #1 → #2 → #1").
 *
 * `GoldReveal.ranks` already carries this, keyed by node, and `GoldTrace` already says it in
 * words. This turns it into the order the graph ran, with the direction of each hop, so a
 * picture can show the answer climbing out of the deep end or falling back into it.
 */

/** "rescaled": the two blocks counted over different populations, so neither way is a move. */
export type Move = "start" | "up" | "down" | "same" | "rescaled";

/** How a block's ranking was taken: over the whole store, or inside the passages kept before it. */
export type Scale = { kind: "corpus" } | { kind: "kept"; size: number | null };

export interface JourneyStep {
  node: string;
  /** Rank in that block's full ranking; null when the block never found the passage. */
  rank: number | null;
  move: Move;
}

/** A missing rank sits below every real one: nowhere is worse than last. */
const place = (rank: number | null) => rank ?? Number.POSITIVE_INFINITY;

/**
 * Two ranks compare only when they were counted over the same population. §8.6 is explicit that
 * a rank means a different thing per block: 23rd of the whole store and 2nd of the 3 passages
 * Kính lúp kept are not two points on one ruler, so no hop between them may be drawn as a rise.
 * An unknown kept size is its own scale rather than a guess, and a block with no scale given
 * compares with nothing -- the picture claims less rather than more.
 */
const comparable = (a: Scale | undefined, b: Scale | undefined): boolean => {
  if (a === undefined || b === undefined) return false;
  if (a.kind === "corpus" || b.kind === "corpus") return a.kind === b.kind;
  return a.size !== null && a.size === b.size;
};

export function rankJourney(
  ranks: Readonly<Record<string, number | null>>,
  order: readonly string[],
  scales: Readonly<Record<string, Scale>> = {},
): JourneyStep[] {
  const steps: JourneyStep[] = [];
  for (const node of order) {
    if (!(node in ranks)) continue;
    const rank = ranks[node] ?? null;
    const previous = steps.at(-1);
    const move: Move =
      previous === undefined
        ? "start"
        : !comparable(scales[previous.node], scales[node])
          ? "rescaled"
          : place(rank) < place(previous.rank)
            ? "up" // a smaller rank is a better place
            : place(rank) > place(previous.rank)
              ? "down"
              : "same";
    steps.push({ node, rank, move });
  }
  return steps;
}
