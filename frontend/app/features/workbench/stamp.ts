/**
 * Máy đóng tem: which sentences of the answer carry a source and which do not
 * (gameplay-direction §3, L1 — "câu có nguồn là gạch, không nguồn là bong bóng").
 *
 * A sentence citing a chunk the packer actually put in the bin is a brick. One citing an id
 * the bin never held is the fabrication L1 exists to teach. One citing nothing is a bubble:
 * plausible text with no source behind it.
 */

export type StampKind = "brick" | "fake" | "bubble";

export interface StampedPart {
  text: string;
  kind: StampKind;
  /** Chunk ids this sentence cited, in the order it cited them. */
  ids: string[];
}

/** `[ab12cd34]` — the citation form the prompt frame asks the model for. */
const CITE = /\[([A-Za-z0-9_]+)\]/g;
/** A sentence ends at . ! ? or a blank line; the terminator stays with its sentence. */
const SENTENCE = /[^.!?\n]+(?:[.!?]+|\n+|$)/g;

export function stampAnswer(answer: string, included: readonly string[]): StampedPart[] {
  const inBin = new Set(included);
  const parts: StampedPart[] = [];
  for (const match of answer.match(SENTENCE) ?? []) {
    const text = match.trim();
    if (text === "") continue;
    const ids = [...text.matchAll(CITE)].map((m) => m[1] ?? "");
    const kind: StampKind =
      ids.length === 0 ? "bubble" : ids.every((id) => inBin.has(id)) ? "brick" : "fake";
    parts.push({ text, kind, ids });
  }
  return parts;
}
