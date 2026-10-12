import type { ReactElement } from "react";

import { AlertIcon } from "~/components/ui/icons";

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
        {/* The part that will not fit, drawn above the rim so a lid that shuts and one that
            does not are different pictures -- overflow-hidden made them identical. The strip
            is capped at a bin's worth: past that it says "some of this does not fit", which is
            true at any size, and the figure itself is printed below. */}
        {fill.overflow && (
          <svg
            data-overflow={fill.overPct}
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-4 w-full"
          >
            <rect
              y={Math.max(0, 100 - Math.min(fill.overPct, 100))}
              width="100"
              height={Math.min(fill.overPct, 100)}
              className="fill-danger-tint"
            />
          </svg>
        )}
        {/* The bin, seen from the side. The viewBox is 100 tall, so a band's height attribute
            is its share of the budget -- no style attribute anywhere (§8.1, CSP). */}
        <svg
          data-bin=""
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={`h-28 w-full rounded-sm border-2 border-b-4 bg-subtle ${
            fill.overflow ? "border-danger" : "border-line-strong"
          }`}
        >
          <rect
            data-band="docs"
            y={100 - fill.docsPct}
            width="100"
            height={fill.docsPct}
            className="fill-brand-tint"
          />
          <rect
            data-band="query"
            y={100 - fill.docsPct - fill.queryPct}
            width="100"
            height={fill.queryPct}
            className="fill-accent-tint"
          />
        </svg>
        {/* Each passage that made it in, counted along the bin's floor. */}
        <ul className="-mt-4 flex flex-wrap gap-0.5 px-1">
          {included.map((id) => (
            <li key={id} data-passage="" className="size-2 rounded-xs bg-brand" />
          ))}
        </ul>
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
      {fill.overflow && (
        <p data-overflow-note className="flex items-center gap-1 text-sm font-semibold text-danger">
          <AlertIcon className="size-4 shrink-0" />
          {BIN_VI.overflow}
        </p>
      )}
      <p className="mt-1 max-w-prose text-xs text-fg-muted">{BIN_VI.counted}</p>
    </Viz>
  );
}
