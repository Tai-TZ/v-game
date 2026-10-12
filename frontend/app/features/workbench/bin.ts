/**
 * Thùng Context as a filled bin rather than a progress bar (gameplay-direction §3: "thể tích
 * bằng count_tokens; nhồi lấn chỗ output thì nắp không đóng").
 *
 * The pack fact measures the whole: how many tokens the documents took, how many the question
 * took, and the budget. It does not measure any single passage, so this sizes the two bands it
 * can size and leaves the passages to be counted, not weighed.
 */

export interface BinFill {
  /** Share of the budget the documents take, as a percentage. May exceed 100. */
  docsPct: number;
  /** Share of the budget the question takes, stacked above the documents. */
  queryPct: number;
  /** The lid does not close: the pack asked for more than the budget allows. */
  overflow: boolean;
  /**
   * How far past the rim the pack goes, as a percentage of the budget: 0 when it fits. Not
   * clamped, so a pack of twice the budget reads as 100 rather than flattening every size of
   * mistake into one picture.
   */
  overPct: number;
}

export function binFill({
  docs,
  query,
  total,
  budget,
}: {
  docs: number;
  query: number;
  total: number;
  budget: number;
}): BinFill {
  // A budget of zero has no room for anything, so anything at all is an overflow — and there
  // is no ratio to take.
  // A budget of zero is full to the rim, and there is no ratio with which to measure what
  // stands past it.
  if (budget <= 0) {
    return { docsPct: total > 0 ? 100 : 0, queryPct: 0, overflow: total > 0, overPct: 0 };
  }
  return {
    docsPct: (docs / budget) * 100,
    queryPct: (query / budget) * 100,
    overflow: total > budget,
    overPct: Math.max(0, ((total - budget) / budget) * 100),
  };
}

/** A passage the packer cut, with where it stood in the list it was cut from. */
export interface DroppedPiece {
  id: string;
  /** Null when the list the packer was handed never named it: no rank is better than a guess. */
  rank: number | null;
}

/**
 * The cut passages with their ranks, in cut order (`pack.dropped` is "ids cut by on_overflow,
 * in cut order" and carries no rank), plus the span of the ranks that are known.
 *
 * The join is against the same ranked list the bin's own contents come from. A passage missing
 * from it keeps a null rank rather than borrowing its array index, which would read as a
 * measurement.
 */
export function droppedRanks(
  dropped: readonly string[],
  retrieved: readonly { chunk_id: string; rank: number }[],
): { pieces: DroppedPiece[]; range: [number, number] | null } {
  const rank = new Map(retrieved.map((item) => [item.chunk_id, item.rank]));
  const pieces = dropped.map((id) => ({ id, rank: rank.get(id) ?? null }));
  const known = pieces.flatMap((p) => (p.rank === null ? [] : [p.rank]));
  return {
    pieces,
    range: known.length === 0 ? null : [Math.min(...known), Math.max(...known)],
  };
}
