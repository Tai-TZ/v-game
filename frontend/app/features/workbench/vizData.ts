/**
 * N22: one article as the current index variant actually cut it.
 *
 * Reads the static data N21 exports, so it draws before any run and while the API sleeps. The
 * blade strip (`Blade`) is the whole corpus at its average; this is one article at its truth.
 */

export interface VizData {
  corpus: Readonly<Record<string, string>>;
  /** Per document: `[dieu, start, end]`, in order. */
  articles: Readonly<Record<string, readonly [number, number, number][]>>;
  /** Per document: whether it is still in force. L2 ships one of each. */
  in_force: Readonly<Record<string, boolean>>;
  /** Per variant key: `[doc_id, dieu, khoan, start, end, tokens, hieu_luc]`. */
  strips: Readonly<
    Record<string, readonly [string, number, number[], number, number, number, boolean][]>
  >;
  ranks: Readonly<
    Record<string, Readonly<Record<string, readonly [string, number, number, number][]>>>
  >;
}

/** Which article, in which document. Article numbers repeat across documents. */
export interface ArticleRef {
  docId: string;
  dieu: number;
}

export interface ArticleStrip extends ArticleRef {
  /** Offsets are into the document, so a chunk's own offsets can be used unchanged. */
  start: number;
  end: number;
  text: string;
  /** False when this is the superseded document -- L2's own trap, so the strip must say it. */
  inForce: boolean;
  /**
   * Document offsets where a chunk ends strictly inside the article: the cuts the blade made
   * THROUGH it, in reading order, deduplicated.
   *
   * Not "every chunk that overlaps the article": with overlap on, a second chunk can lap an
   * article's tail without cutting it, and counting those claimed "2 đoạn" for an article the
   * blade left whole. Pieces = cuts.length + 1.
   */
  cuts: readonly number[];
}

export function articleStrip(
  data: VizData,
  variant: string,
  docId: string,
  dieu: number,
): ArticleStrip | null {
  const cutList = data.strips[variant];
  const articles = data.articles[docId];
  const text = data.corpus[docId];
  if (cutList === undefined || articles === undefined || text === undefined) return null;
  const found = articles.find((a) => a[0] === dieu);
  if (found === undefined) return null;
  const [, start, end] = found;
  // Strictly inside: a chunk ending exactly at the article's edge is where the article stops,
  // not a cut through it.
  const inside = cutList
    .filter((c) => c[0] === docId && start < c[4] && c[4] < end)
    .map((c) => c[4]);
  return {
    docId,
    dieu,
    start,
    end,
    text: text.slice(start, end),
    inForce: data.in_force[docId] ?? true,
    cuts: [...new Set(inside)].sort((a, b) => a - b),
  };
}

/** Sentence enders, plus the newline: a clause break is a boundary, not a severed sentence. */
const BOUNDARY = /[.!?;:\n]/;

export interface CutSentence {
  text: string;
  /** Document offset of the cut inside it. */
  at: number;
}

/**
 * The sentence a cut falls inside, or null when it fell on a boundary -- which is the good
 * case, and the one the strip draws in the ordinary colour.
 *
 * `text` is any slice of the document and `offset` says where that slice begins, so callers
 * can hand over an article rather than the whole corpus and still get document offsets back.
 */
export function cutSentence(text: string, offset: number, at: number): CutSentence | null {
  const index = at - offset;
  if (index <= 0 || index >= text.length) return null;
  const before = text.slice(0, index);
  const after = text.slice(index);
  // Across the whitespace, not past it: a cut right after ". " or at a line break sits between
  // two sentences. Skipping whitespace first would swallow the "\n" that IS the boundary.
  if (/[.!?;:\n]\s*$/.test(before) || /^\s*[.!?;:\n]/.test(after)) return null;
  let from = index;
  while (from > 0 && !BOUNDARY.test(text[from - 1] ?? "")) from -= 1;
  let to = index;
  while (to < text.length && !BOUNDARY.test(text[to] ?? "")) to += 1;
  // Keep the ender: "Câu hai dài hơn." reads as a sentence, "Câu hai dài hơn" as a fragment.
  if (to < text.length) to += 1;
  return { text: text.slice(from, to).trim(), at };
}

/**
 * The key N21's data is filed under, built from the chunker's own three knobs. Null when the
 * bench does not hold all three, or holds one of the wrong kind: a half-built key would read
 * as "variant nobody built" anyway, and silently.
 */
export function variantKey(params: Readonly<Record<string, unknown>>): string | null {
  const { strategy, chunk_size: size, overlap_pct: overlap } = params;
  if (typeof strategy !== "string" || typeof size !== "number" || typeof overlap !== "number") {
    return null;
  }
  return `${strategy}-${size}-${overlap}`;
}

/**
 * The article a sample question's search brings back first, under this variant.
 *
 * This is what "điều đang xem" means before a run (L2 §5): no gold is involved, and the answer
 * moves when the blade moves -- at `theo_dieu-512-10` Hà's question lands in Điều 12, at
 * `co_dinh-512-0` in Điều 11, the cut that swallowed Điều 12 whole.
 */
export function focusArticle(data: VizData, variant: string, caseId: string): ArticleRef | null {
  const top = data.ranks[variant]?.[caseId]?.[0];
  if (top === undefined) return null;
  const [docId, start] = top;
  const found = data.articles[docId]?.find((a) => a[1] <= start && start < a[2]);
  // The document travels with the number: on L2 "Điều 10" is both qcdt-2019's "Bảo lưu kết quả
  // học tập" and qcdt-2024's "Khối lượng học tập trong học kỳ", and dropping the document drew
  // the wrong one -- the in-force text standing in for the superseded one the search favoured.
  return found === undefined ? null : { docId, dieu: found[0] };
}

export const vizUrl = (levelId: string) => `/viz/${encodeURIComponent(levelId)}.json`;

/**
 * Validates a shipped data file against the level asking for it. Null on anything unexpected:
 * drawing another level's cuts, or last month's, is worse than drawing nothing.
 */
export function parseViz(levelId: string, levelVersion: number, raw: unknown): VizData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const file = raw as Record<string, unknown>;
  if (file.format !== 1 || file.level !== levelId || file.level_version !== levelVersion) {
    return null;
  }
  const { corpus, articles, in_force: inForce, strips, ranks } = file;
  const parts = [corpus, articles, inForce, strips, ranks];
  // A file missing one part would be handed on and then throw on first access, because
  // `data.strips[variant]` reads a property of undefined.
  if (parts.some((part) => typeof part !== "object" || part === null)) return null;
  return { corpus, articles, in_force: inForce, strips, ranks } as VizData;
}
