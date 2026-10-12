import type { ReactElement } from "react";

import { binFill } from "./bin";
import { BIN_VI, fmt, TOKENS_VI } from "./copy";
import { Viz } from "./Viz";

/**
 * Thùng Context: the pack as a bin filling toward its budget line, with the lid refusing to
 * close when the pack asked for more than the budget allows (gameplay-direction §3).
 *
 * Plain DOM, not canvas: a bin is a handful of rectangles, and divs are already reachable,
 * already readable by a screen reader, and already testable without a 2D context.
 */
export function ContextBin({
  tokens,
  included,
  dropped,
  promptTokens,
}: {
  tokens: { docs: number; query: number; total: number; budget: number };
  included: readonly string[];
  dropped: readonly string[];
  /** What the provider charged for this case's whole prompt; null until its step finishes. */
  promptTokens: number | null;
}): ReactElement {
  const fill = binFill(tokens);
  const cut = dropped.length > 0 ? `, ${dropped.length} đoạn bị cắt` : "";
  const label =
    `Thùng chứa ${fmt(tokens.total)} trên ${fmt(tokens.budget)} token, ` +
    `${included.length} đoạn vào thùng${cut}`;

  return (
    <Viz
      caption={label}
      stamp="run"
      table={
        <table className="text-sm tabular-nums">
          <tbody>
            {(
              [
                ["Tổng", tokens.total],
                ["Ngân sách", tokens.budget],
                ["Tài liệu", tokens.docs],
                ["Câu hỏi", tokens.query],
                ["Đoạn vào thùng", included.length],
                ["Đoạn bị cắt", dropped.length],
              ] as const
            ).map(([name, value]) => (
              <tr key={name} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 text-left font-semibold whitespace-nowrap">
                  {name}
                </th>
                <td className="py-1">{fmt(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div role="img" aria-label={label} className="max-w-80">
        {/* The bin, seen from the side. Height is the budget; the bands are what the run
            measured taking it up. An overflowing band is clipped by the bin, which is what
            the lid not closing looks like. */}
        <div
          data-bin=""
          className={`relative h-28 overflow-hidden rounded-sm border-2 border-b-4 bg-subtle ${
            fill.overflow ? "border-danger" : "border-line-strong"
          }`}
        >
          {/* The bin's height is the budget, so each band is its own share of it: 40 % of the
              budget is 40 % of the bin. Both bands measure against the bin directly -- put them
              inside a wrapper that is itself a percentage of the bin and the paint becomes the
              square of the real fill. A band past 100 % is clipped by the bin, which is what
              the lid not closing looks like. */}
          <div
            data-band="docs"
            style={{ height: `${fill.docsPct}%` }}
            className="absolute inset-x-0 bottom-0 bg-brand-tint"
          />
          <div
            data-band="query"
            style={{ height: `${fill.queryPct}%`, bottom: `${fill.docsPct}%` }}
            className="absolute inset-x-0 bg-accent-tint"
          />
          {/* Each passage that made it in, counted along the bin's floor. */}
          <ul className="absolute inset-x-1 bottom-1 flex flex-wrap gap-0.5">
            {included.map((id) => (
              <li key={id} data-passage="" className="size-2 rounded-xs bg-brand" />
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-1 text-sm tabular-nums">
        {fmt(tokens.total)}/{fmt(tokens.budget)} token · tài liệu {fmt(tokens.docs)} · câu hỏi{" "}
        {fmt(tokens.query)} <span className="text-fg-muted">({TOKENS_VI.bin})</span>
      </p>
      {/* The second of §8.4's two counts. Its own line, not a second band: the provider counts
          the whole prompt and the bin only what it packed, so side by side they would read as
          one quantity measured twice. */}
      <p className="mt-1 max-w-prose text-sm text-fg-muted tabular-nums">
        {promptTokens === null ? TOKENS_VI.noneYet : TOKENS_VI.prompt(fmt(promptTokens))}
      </p>
      {fill.overflow && <p className="text-sm font-semibold text-danger">{BIN_VI.overflow}</p>}
      <p className="mt-1 max-w-prose text-xs text-fg-muted">{BIN_VI.counted}</p>
    </Viz>
  );
}
