import { RRF_LESSON } from "./registry";

/**
 * Bài vi mô "Tự tay trộn RRF" (research/lesson-visualization: Thư viện, L3; course Day 8, slide
 * 16/46 "RRF vs Alpha weighting"; roadmap-v0.4 N24). Two ranked lists of five passages, scored
 * on scales that cannot be added; the player drops a 1/(k + rank) chip per rank into each
 * passage's sum, then orders what comes out of the Phễu. The right order is computed here from
 * the two lists, never typed: `fuseRrf` is the engine's fusion block, `retrieval.fuse_rrf`.
 */

/** The fusion block's default k (blocks.py FusionParams), the Phễu's k in L3. */
export const RRF_K = 60;

export type ListId = "vom_sao" | "tu_ngan_keo";

export interface Passage {
  id: string;
  /** "Điều 47 khoản 2". */
  label: string;
  /** What the clause says, in a few words (qcdt-2024, the Library's fictional quy chế). */
  gist: string;
}

export interface Hit {
  passage: string;
  /** The list's own raw score: cosine for Vòm Sao, BM25 for Tủ ngăn kéo. */
  score: number;
}

export interface RankedList {
  id: ListId;
  name: string;
  method: string;
  /** Best first, as the search returned them; rank 1 is the first. */
  hits: readonly Hit[];
}

export interface Chip {
  list: ListId;
  rank: number;
  value: number;
}

export interface Fused {
  passage: string;
  score: number;
  /** One per list that found the passage, in list order: the sum the Phễu adds up. */
  chips: Chip[];
}

export const chipValue = (rank: number, k = RRF_K) => 1 / (k + rank);

/**
 * Reciprocal rank fusion as `retrieval.fuse_rrf` runs it: ranks count from 1, each list adds
 * 1 / (k + rank) to the passages it holds (a passage missing from a list gets nothing from it),
 * then the sum orders them, ties broken by id. Ids compare by code unit like Python's `<`.
 */
export function fuseRrf(lists: readonly RankedList[], k = RRF_K): Fused[] {
  const byId = new Map<string, Fused>();
  for (const list of lists) {
    list.hits.forEach((hit, index) => {
      const chip = { list: list.id, rank: index + 1, value: chipValue(index + 1, k) };
      const fused = byId.get(hit.passage) ?? { passage: hit.passage, score: 0, chips: [] };
      fused.score += chip.value;
      fused.chips.push(chip);
      byId.set(hit.passage, fused);
    });
  }
  return [...byId.values()].sort(
    (a, b) => b.score - a.score || (a.passage < b.passage ? -1 : a.passage > b.passage ? 1 : 0),
  );
}

/** What adding the raw scores would give (a missing side counts 0): the scale that cannot be. */
export function rawSumOrder(lists: readonly RankedList[]): { passage: string; sum: number }[] {
  const sums = new Map<string, number>();
  for (const list of lists) {
    for (const hit of list.hits) sums.set(hit.passage, (sums.get(hit.passage) ?? 0) + hit.score);
  }
  return [...sums]
    .map(([passage, sum]) => ({ passage, sum }))
    .sort((a, b) => b.sum - a.sum || (a.passage < b.passage ? -1 : 1));
}

/** Clauses of Điều 41, 47 and 74, the look-alike family of L3 (khoản 2 of each: who to file
 * with, and how many days). Ordered by article, which is how the Phễu lists them before the
 * player orders them. */
export const PASSAGES: readonly Passage[] = [
  { id: "d41-k2", label: "Điều 41 khoản 2", gist: "Nộp đơn phúc khảo cho phòng khảo thí, 07 ngày" },
  { id: "d47-k1", label: "Điều 47 khoản 1", gist: "Được đề nghị xem xét lại điểm quá trình" },
  {
    id: "d47-k2",
    label: "Điều 47 khoản 2",
    gist: "Nộp đơn xem xét lại cho trưởng bộ môn, 05 ngày",
  },
  { id: "d47-k3", label: "Điều 47 khoản 3", gist: "Một giảng viên khác cùng xem lại, 03 ngày" },
  { id: "d47-k4", label: "Điều 47 khoản 4", gist: "Không đồng ý thì đề nghị trưởng khoa" },
  {
    id: "d74-k2",
    label: "Điều 74 khoản 2",
    gist: "Nộp đơn khiếu nại kết quả khóa luận cho khoa, 10 ngày",
  },
];

/** The clause that answers the question. */
export const ANSWER = "d47-k2";

/**
 * Scores are illustrative, written for the lesson, not measured. Vòm Sao reads the meaning of
 * "nộp đơn cho ai" and puts the look-alike Điều 41 first; Tủ ngăn kéo sees "47" and "điểm
 * giữa kỳ" and puts khoản 1 first. Neither tops the list with the answer.
 */
export const LISTS: readonly RankedList[] = [
  {
    id: "vom_sao",
    name: "Vòm Sao",
    method: "tìm theo nghĩa, điểm cosine",
    hits: [
      { passage: "d41-k2", score: 0.82 },
      { passage: "d47-k2", score: 0.81 },
      { passage: "d74-k2", score: 0.8 },
      { passage: "d47-k3", score: 0.79 },
      { passage: "d47-k1", score: 0.78 },
    ],
  },
  {
    id: "tu_ngan_keo",
    name: "Tủ ngăn kéo",
    method: "tìm theo từ khóa, điểm BM25",
    hits: [
      { passage: "d47-k1", score: 14.3 },
      { passage: "d47-k2", score: 12.1 },
      { passage: "d47-k3", score: 9.8 },
      { passage: "d41-k2", score: 9.1 },
      { passage: "d47-k4", score: 6.2 },
    ],
  },
];

/** The right order out of the Phễu. */
export const FUSED: readonly Fused[] = fuseRrf(LISTS);

export interface OrderGrade {
  right: number;
  total: number;
  /** The player's order, place by place, with where each passage belongs (1-based). */
  places: { passage: string; verdict: "right" | "wrong"; belongs: number }[];
}

/** Null until every passage out of the Phễu has exactly one place. */
export function gradeOrder(order: readonly string[]): OrderGrade | null {
  const right = FUSED.map((f) => f.passage);
  if (order.length !== right.length || new Set(order).size !== order.length) return null;
  if (!order.every((passage) => right.includes(passage))) return null;
  const places = order.map((passage, index) => ({
    passage,
    verdict: right[index] === passage ? ("right" as const) : ("wrong" as const),
    belongs: right.indexOf(passage) + 1,
  }));
  return {
    right: places.filter((p) => p.verdict === "right").length,
    total: places.length,
    places,
  };
}

/** The lesson's place, and its question. */
export const RRF = {
  ...RRF_LESSON,
  question: "Theo Điều 47, muốn xem lại điểm giữa kỳ thì em nộp đơn cho ai?",
} as const;
