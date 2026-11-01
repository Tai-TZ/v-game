import type { ReactElement } from "react";

import { STRIP_VI, variantVi } from "./copy";
import { cutSentence, type ArticleStrip } from "./vizData";
import { Viz } from "./Viz";

/**
 * N22: one article as the current index variant really cut it, with the sentence a cut severed
 * in red (L2 §5 "Xem trước tất định").
 *
 * `Blade` draws the whole corpus at its average and needs a run to exist; this draws one
 * article at its truth and needs nothing but the static data N21 shipped -- so it answers "what
 * does Lược dao actually do to Điều 12" before the player has spent a single AI call.
 *
 * A piece is what lies between two cuts, never "a chunk that overlaps the article": with
 * overlap on, a chunk can lap an article's tail without cutting it, and counting those claimed
 * "2 đoạn" for an article the blade left whole.
 */
export function Strip({ strip, variant }: { strip: ArticleStrip; variant: string }): ReactElement {
  const { dieu, start, end, cuts, inForce } = strip;
  const span = end - start;
  // The article's own edges plus every cut inside it: n cuts make n+1 pieces, always. Each
  // piece lies wholly within the article, so nothing needs clamping to the bar it is drawn in.
  const edges = [start, ...cuts, end];
  const pieces = edges.slice(0, -1).map((from, index) => {
    const to = edges[index + 1] ?? end;
    return {
      from,
      to,
      left: ((from - start) / span) * 100,
      width: ((to - from) / span) * 100,
      // The cut at this piece's end -- unless the piece ends where the article does.
      severed: to === end ? null : cutSentence(strip.text, start, to),
    };
  });
  const severed = pieces.flatMap((p) => (p.severed ? [p.severed] : []));

  const label =
    STRIP_VI.pieces(dieu, pieces.length) +
    (severed.length > 0 ? ` ${STRIP_VI.severedCount(severed.length)}` : "");

  return (
    <Viz
      caption={STRIP_VI.caption(dieu, inForce)}
      stamp="index"
      note={variantVi(variant)}
      table={
        <table className="text-sm">
          <caption className="sr-only">{STRIP_VI.caption(dieu, inForce)}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-3 text-left font-medium">
                {STRIP_VI.columns.piece}
              </th>
              <th scope="col" className="py-1 pr-3 text-left font-medium">
                {STRIP_VI.columns.chars}
              </th>
              <th scope="col" className="py-1 text-left font-medium">
                {STRIP_VI.columns.severed}
              </th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((p, index) => (
              <tr key={p.from} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 text-left font-semibold whitespace-nowrap">
                  {STRIP_VI.piece(index + 1)}
                </th>
                <td className="py-1 pr-3 tabular-nums">{p.to - p.from}</td>
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
              key={`piece-${p.from}`}
              data-strip-piece=""
              aria-hidden="true"
              style={{ left: `${p.left}%`, width: `${p.width}%` }}
              className="absolute inset-y-0 border-r border-line-strong last:border-r-0"
            />
          ))}
          {pieces
            .filter((p) => p.to !== end)
            .map((p) => (
              <span
                key={`cut-${p.to}`}
                data-strip-cut={p.severed ? "severed" : "clean"}
                aria-hidden="true"
                style={{ left: `${p.left + p.width}%` }}
                className={`absolute inset-y-0 w-0.5 ${p.severed ? "bg-danger" : "bg-line-strong"}`}
              />
            ))}
        </div>
      </div>
      <p className="mt-1 max-w-prose text-sm tabular-nums">
        {STRIP_VI.pieces(dieu, pieces.length)}
      </p>
      {/* L2's corpus holds a superseded document beside the one in force, and their Điều
          numbers repeat. A strip of the stale document that does not say so is the stale_doc
          trap drawn as if it were the answer. */}
      {!inForce && (
        <p className="mt-1 max-w-prose text-sm font-semibold text-warning">{STRIP_VI.stale}</p>
      )}
      {severed.length > 0 && (
        <p className="mt-1 max-w-prose text-sm font-semibold text-danger">
          {STRIP_VI.severedLegend} «{severed[0]?.text}»
        </p>
      )}
    </Viz>
  );
}
