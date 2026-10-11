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
  if (budget <= 0) return { docsPct: total > 0 ? 100 : 0, queryPct: 0, overflow: total > 0 };
  return {
    docsPct: (docs / budget) * 100,
    queryPct: (query / budget) * 100,
    overflow: total > budget,
  };
}
