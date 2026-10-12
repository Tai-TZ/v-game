/**
 * Sổ đối chiếu trích dẫn (N13): the same chunk ids seen three times over — pulled back, put in
 * the bin, cited in the answer — lined up on one axis so a code that drops out between two rows
 * reads as a gap. The gap is the evidence (lesson-visualization §4), which only works if the
 * rows align by id rather than each being its own dense list.
 *
 * Pure logic, no rendering, like bin.ts and stamp.ts beside it.
 */

import type { Fact } from "./schema";
import type { StepView } from "./run";

type Retrieved = Extract<Fact, { kind: "retrieved" }>;

export interface LedgerRow {
  id: string;
  /** Place in the list the packer was handed; null for a code that list never named. */
  rank: number | null;
  inBin: boolean;
  cited: boolean;
  /** Cited but never in the bin: the fabrication L1 exists to teach. */
  ghost: boolean;
}

export interface Ledger {
  rows: LedgerRow[];
  /** Codes, not sentences: how many the answer cited, how many of those the bin held. */
  counts: { cited: number; inBin: number; ghost: number };
}

/**
 * The ranked list the packer actually saw: the last one in step order. A case can rank several
 * times (Vòm Sao and Tủ ngăn kéo in parallel, then Phễu, then Kính lúp), and only the last of
 * those is what the bin was filled from.
 */
export function packerSaw(
  steps: Readonly<Record<string, StepView>>,
): readonly Retrieved["items"][number][] {
  let last: readonly Retrieved["items"][number][] = [];
  for (const step of Object.values(steps)) {
    for (const fact of step.facts ?? []) {
      if (fact.kind === "retrieved") last = fact.items;
    }
  }
  return last;
}

export function citationLedger(
  retrieved: readonly Retrieved["items"][number][],
  included: readonly string[],
  cited: readonly string[],
): Ledger {
  const bin = new Set(included);
  const said = new Set(cited);
  const ranked = [...retrieved].sort((a, b) => a.rank - b.rank);

  const order: string[] = [];
  const add = (id: string) => {
    if (!order.includes(id)) order.push(id);
  };
  for (const item of ranked) add(item.chunk_id);
  // A code the ranked row never named can still be in the bin (the packer may be fed by a block
  // whose own list is not row 1) or only in the answer (the fabrication).
  for (const id of included) add(id);
  for (const id of cited) add(id);

  const rank = new Map(ranked.map((item) => [item.chunk_id, item.rank]));
  const rows = order.map((id) => {
    const inBin = bin.has(id);
    const wasCited = said.has(id);
    return { id, rank: rank.get(id) ?? null, inBin, cited: wasCited, ghost: wasCited && !inBin };
  });
  const citedRows = rows.filter((r) => r.cited);
  return {
    rows,
    counts: {
      cited: citedRows.length,
      inBin: citedRows.filter((r) => r.inBin).length,
      ghost: citedRows.filter((r) => r.ghost).length,
    },
  };
}
