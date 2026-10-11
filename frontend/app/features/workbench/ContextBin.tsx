import type { ReactElement } from "react";

import { binFill } from "./bin";
import { BIN_VI, fmt } from "./copy";

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
}: {
  tokens: { docs: number; query: number; total: number; budget: number };
  included: readonly string[];
  dropped: readonly string[];
}): ReactElement {
  const fill = binFill(tokens);
  const cut = dropped.length > 0 ? `, ${dropped.length} đoạn bị cắt` : "";
  const label =
    `Thùng chứa ${fmt(tokens.total)} trên ${fmt(tokens.budget)} token, ` +
    `${included.length} đoạn vào thùng${cut}`;

  return (
    <div className="mt-2">
      <div role="img" aria-label={label} className="max-w-80">
        {/* The bin, seen from the side. Height is the budget; the bands are what the run
            measured taking it up. An overflowing band is clipped by the bin, which is what
            the lid not closing looks like. */}
        <div
          className={`relative h-28 overflow-hidden rounded-sm border-2 border-b-4 bg-subtle ${
            fill.overflow ? "border-danger" : "border-line-strong"
          }`}
        >
          <div
            style={{ height: `${Math.min(fill.docsPct + fill.queryPct, 100)}%` }}
            className="absolute inset-x-0 bottom-0 flex flex-col-reverse"
          >
            <div
              style={{ flexBasis: `${fill.docsPct}%` }}
              className="min-h-0 shrink bg-brand-tint"
            />
            <div
              style={{ flexBasis: `${fill.queryPct}%` }}
              className="min-h-0 shrink bg-accent-tint"
            />
          </div>
          {/* Each passage that made it in, counted along the bin's floor. */}
          <ul className="absolute inset-x-1 bottom-1 flex flex-wrap gap-0.5">
            {included.map((id) => (
              <li key={id} className="size-2 rounded-xs bg-brand" />
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-1 text-sm tabular-nums">
        {fmt(tokens.total)}/{fmt(tokens.budget)} token · tài liệu {fmt(tokens.docs)} · câu hỏi{" "}
        {fmt(tokens.query)}
      </p>
      {fill.overflow && <p className="text-sm font-semibold text-danger">{BIN_VI.overflow}</p>}
      <p className="mt-1 max-w-prose text-xs text-fg-muted">{BIN_VI.counted}</p>
    </div>
  );
}
