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
  /** Per variant key: `[doc_id, dieu, khoan, start, end, tokens, hieu_luc]`. */
  strips: Readonly<
    Record<string, readonly [string, number, number[], number, number, number, boolean][]>
  >;
  ranks: Readonly<
    Record<string, Readonly<Record<string, readonly [string, number, number, number][]>>>
  >;
}

export interface StripChunk {
  start: number;
  end: number;
  tokens: number;
}

export interface ArticleStrip {
  /** Offsets are into the document, so a chunk's own offsets can be used unchanged. */
  start: number;
  end: number;
  text: string;
  chunks: readonly StripChunk[];
}

/**
 * Every chunk of `variant` that overlaps article `dieu`.
 *
 * Overlap, not the chunk's own `dieu`: that field records the article holding the chunk's
 * FIRST token, so a fixed-size cut running from Điều 11 into Điều 12 is filed under 11 and
 * would vanish from Điều 12's strip -- hiding the exact thing L2 teaches.
 */
export function articleStrip(data: VizData, variant: string, dieu: number): ArticleStrip | null {
  const cuts = data.strips[variant];
  if (cuts === undefined) return null;
  for (const [docId, articles] of Object.entries(data.articles)) {
    const found = articles.find((a) => a[0] === dieu);
    const text = data.corpus[docId];
    if (found === undefined || text === undefined) continue;
    const [, start, end] = found;
    return {
      start,
      end,
      text: text.slice(start, end),
      chunks: cuts
        .filter((c) => c[0] === docId && c[3] < end && start < c[4])
        .map((c) => ({ start: c[3], end: c[4], tokens: c[5] })),
    };
  }
  return null;
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
