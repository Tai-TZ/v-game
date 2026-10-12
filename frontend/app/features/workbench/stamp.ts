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
/**
 * A sentence ends at . ! ? *followed by a space*, or at a line break; the terminator stays with
 * its sentence. Requiring the space is what keeps "IELTS 5.5" and "TOEFL...)" whole -- splitting
 * on every period tore one cited sentence into an unsourced half and a sourced half, which
 * inverts the lesson L1 exists to teach.
 */
const END = /(?<=[.!?])(?=\s)|\n+/;
/** "1." or "-" alone is a list marker; it belongs to the item it marks, not to a card. */
const MARKER = /^(?:\d{1,3}[.)]|[-*•])$/;

function sentences(answer: string): string[] {
  const out: string[] = [];
  let marker = "";
  for (const raw of answer.split(END)) {
    const part = raw.trim();
    if (part === "") continue;
    if (MARKER.test(part)) {
      marker = part;
      continue;
    }
    out.push(marker === "" ? part : `${marker} ${part}`);
    marker = "";
  }
  // A marker with nothing after it is all that is left of its line; keep it rather than drop it.
  if (marker !== "") out.push(marker);
  return out;
}

export function stampAnswer(answer: string, included: readonly string[]): StampedPart[] {
  const inBin = new Set(included);
  const parts: StampedPart[] = [];
  for (const text of sentences(answer)) {
    const ids = [...text.matchAll(CITE)].map((m) => m[1] ?? "");
    const kind: StampKind =
      ids.length === 0 ? "bubble" : ids.every((id) => inBin.has(id)) ? "brick" : "fake";
    parts.push({ text, kind, ids });
  }
  return parts;
}
