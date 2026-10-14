import type { ReactElement } from "react";

import { fmt, STRIP_VI, variantVi } from "./copy";
import { cutSentence, type ArticleStrip } from "./strip";
import { Viz } from "./Viz";

/**
 * N22: one article as the current index variant really cut it, with the sentence a cut severed
 * in red (L2 §5 "Xem trước tất định").
 *
 * `Blade` draws the whole corpus at its average and needs a run to exist; this draws one
 * article at its truth and needs nothing but the static data N21 shipped -- so it answers "what
 * does Lược dao actually do to Điều 12" before the player has spent a single AI call.
 */
export function Strip({
  dieu,
  variant,
  strip,
}: {
  dieu: number;
  variant: string;
  strip: ArticleStrip;
}): ReactElement {
  const span = strip.end - strip.start;
  const pieces = strip.chunks.map((chunk) => {
    // A chunk can begin before the article and end after it: clamp to what is on show, or a
    // 1024-token cut would draw a piece wider than the strip it sits in.
    const from = Math.max(0, ((chunk.start - strip.start) / span) * 100);
    const to = Math.min(100, ((chunk.end - strip.start) / span) * 100);
    return {
      chunk,
      from,
      to,
      // `cutSentence` already answers null past the end of what it was handed, so a cut that
      // runs out of the article needs no guard of its own here.
      severed: cutSentence(strip.text, strip.start, chunk.end),
    };
  });
  const severed = pieces.flatMap((p) => (p.severed ? [p.severed] : []));

  const label =
    STRIP_VI.pieces(dieu, pieces.length) +
    (severed.length > 0 ? ` ${STRIP_VI.severedCount(severed.length)}` : "");

  return (
    <Viz
      caption={STRIP_VI.caption(dieu)}
      stamp="index"
      note={variantVi(variant)}
      table={
        <table className="text-sm">
          <caption className="sr-only">{STRIP_VI.caption(dieu)}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-3 text-left font-medium">
                {STRIP_VI.columns.piece}
              </th>
              <th scope="col" className="py-1 pr-3 text-left font-medium">
                {STRIP_VI.columns.tokens}
              </th>
              <th scope="col" className="py-1 text-left font-medium">
                {STRIP_VI.columns.severed}
              </th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((p, index) => (
              <tr key={p.chunk.start} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 text-left font-semibold whitespace-nowrap">
                  {STRIP_VI.piece(index + 1)}
                </th>
                <td className="py-1 pr-3 tabular-nums">{fmt(p.chunk.tokens)}</td>
                <td className="py-1">{p.severed ? `«${p.severed.text}»` : STRIP_VI.clean}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div role="img" aria-label={label} className="max-w-prose">
        <div className="relative h-10 overflow-hidden rounded-sm border border-line-strong bg-subtle">
          {pieces.map((p) => (
            <span
              key={`piece-${p.chunk.start}`}
              data-strip-piece=""
              aria-hidden="true"
              style={{ left: `${p.from}%`, width: `${p.to - p.from}%` }}
              className="absolute inset-y-0 border-r border-line-strong last:border-r-0"
            />
          ))}
          {pieces
            .filter((p) => p.to < 100)
            .map((p) => (
              <span
                key={`cut-${p.chunk.end}`}
                data-strip-cut={p.severed ? "severed" : "clean"}
                aria-hidden="true"
                style={{ left: `${p.to}%` }}
                className={`absolute inset-y-0 w-0.5 ${p.severed ? "bg-danger" : "bg-line-strong"}`}
              />
            ))}
        </div>
      </div>
      <p className="mt-1 max-w-prose text-sm tabular-nums">
        {STRIP_VI.pieces(dieu, pieces.length)}
      </p>
      {severed.length > 0 && (
        <p className="mt-1 max-w-prose text-sm font-semibold text-danger">
          {STRIP_VI.severedLegend} «{severed[0]?.text}»
        </p>
      )}
    </Viz>
  );
}
