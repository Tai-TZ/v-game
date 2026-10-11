import type { Fact } from "./schema";

/**
 * Projection behind the Vòm Sao (vom-sao-v0.1 §5). Pure: no DOM, no clock.
 *
 * Position is a drawing, not a coordinate: the dome shows angular distance from the beam as
 * `1 − score` normalised across the passages this call was given, because that is the only
 * distance the run actually measured. The real rank and cosine travel on every star so the
 * component can print them, which §7 requires it to do.
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
const SPREAD = (70 * Math.PI) / 180;
const RADIUS = 0.42;
const ORIGIN_X = 0.5;
const ORIGIN_Y = 0.05;

export function starField(
  items: readonly RetrievedItem[],
  goldChunks: readonly string[],
  goldRank: number | null,
): Dome {
  const scores = items.map((i) => i.score);
  const best = Math.max(...scores);
  const worst = Math.min(...scores);
  const span = best - worst;

  const stars = items.map((item, index) => {
    // A tie carries no information about distance, so every star sits on the axis rather than
    // being spread by a division by zero.
    const away = span === 0 ? 0 : (best - item.score) / span;
    const angle = away * SPREAD * (index % 2 === 0 ? -1 : 1);
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
