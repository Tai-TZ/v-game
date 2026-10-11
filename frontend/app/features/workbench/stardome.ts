import type { Fact } from "./schema";

/**
 * Projection behind the Vòm Sao (vom-sao-v0.1 §5). Pure: no DOM, no clock.
 *
 * Position carries RANK, evenly spaced across the fan, and nothing else.
 *
 * It used to carry `1 − score` normalised across this call's own range, which the review
 * showed to be a lie on the only data that exists: the committed L3 run's cosines differ by
 * 0,005 and that became a 70-degree spread, while all three printed as "0,8". A projection
 * that exaggerates a near-tie into a chasm teaches the opposite of the lesson. Rank is a
 * quantity the fan can hold exactly, so it holds that; the cosine is a number, and
 * `StarDome` prints it. Even spacing also means two passages never share a dot — the canvas
 * and the sr-only list always show the same count (§9).
 */

type RetrievedItem = Extract<Fact, { kind: "retrieved" }>["items"][number];

export interface Star {
  chunkId: string;
  rank: number;
  score: number;
  dieu: number;
  khoan: readonly number[];
  /** The passage comes from a document no longer in force (L2's "tờ giấy vàng 2019"). */
  stale: boolean;
  gold: boolean;
  /** Unit-square projection: x 0..1 across the dome, y 0..1 bottom to top. */
  x: number;
  y: number;
}

export interface Dome {
  stars: readonly Star[];
  /** The answer passage's rank in this block's full ranking, when it is outside `stars`. */
  missingGold: { rank: number } | null;
}

/** Half-angle of the fan, in radians: wide enough to separate ranks, inside the dome's arc. */
const SPREAD = (62 * Math.PI) / 180;
const RADIUS = 0.42;
const ORIGIN_X = 0.5;
const ORIGIN_Y = 0.05;

export function starField(
  items: readonly RetrievedItem[],
  goldChunks: readonly string[],
  goldRank: number | null,
): Dome {
  if (items.length === 0) return { stars: [], missingGold: null };

  const stars = items.map((item, index) => {
    // Best rank on the axis, then alternating out to either side: -1, +1, -2, +2 ... so the
    // fan stays balanced and no two passages land on the same dot.
    const step = Math.ceil(index / 2);
    const side = index % 2 === 1 ? 1 : -1;
    const reach = items.length <= 1 ? 0 : step / Math.ceil((items.length - 1) / 2);
    const angle = reach * SPREAD * side;
    return {
      chunkId: item.chunk_id,
      rank: item.rank,
      score: item.score,
      dieu: item.dieu,
      khoan: item.khoan,
      stale: !item.hieu_luc,
      gold: goldChunks.includes(item.chunk_id),
      x: ORIGIN_X + RADIUS * Math.sin(angle),
      y: ORIGIN_Y + RADIUS * Math.cos(angle),
    };
  });

  const pulled = stars.some((s) => s.gold);
  return { stars, missingGold: goldRank !== null && !pulled ? { rank: goldRank } : null };
}
