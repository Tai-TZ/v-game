import type { ReactElement } from "react";

import { buttonClass } from "~/components/ui/button";
import { CheckIcon, CircleDashIcon, CrossIcon } from "~/components/ui/icons";

import { HISTORY_VI } from "./copy";
import { historyMatrix, type Cell, type HistoryRow } from "./runHistory";
import type { RunMark } from "./storage";
import { Viz } from "./Viz";

/** Colour, icon and words for each outcome: none of the three carries it alone (roadmap §5). */
const LOOK: Readonly<Record<Cell, { className: string; Icon: typeof CheckIcon }>> = {
  pass: { className: "text-success", Icon: CheckIcon },
  fail: { className: "text-danger", Icon: CrossIcon },
  skip: { className: "text-fg-muted", Icon: CircleDashIcon },
};

function Cells({ row }: { row: HistoryRow }) {
  return row.cells.map((cell) => {
    const { className, Icon } = LOOK[cell.state];
    return (
      <td key={cell.n} data-cell={cell.state} className={`px-2 py-1 ${className}`}>
        <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
          <Icon className="size-3.5 shrink-0" />
          {HISTORY_VI.cell[cell.state]}
        </span>
      </td>
    );
  });
}

/**
 * The level's last runs as rows and its cases as columns, so a learner reads across a row to
 * see what one configuration did and down a column to see which case a change broke.
 *
 * It offers no "Xem dạng bảng": a rank strip IS a table, and §8.2 asks the toggle for a picture
 * that needs a readable alternative. Giving one here would swap a table for the same table --
 * a control that does nothing, which is worse than no control.
 */
export function History({
  runs,
  onDuplicate,
}: {
  runs: readonly RunMark[];
  /** Puts that row's configuration back on the bench. Absent when nothing can receive one. */
  onDuplicate?: (mark: RunMark) => void;
}): ReactElement | null {
  const { columns, rows } = historyMatrix(runs);
  if (rows.length === 0) return null;

  // w-max: without it the table shrinks to the scroller's available width and table-layout
  // auto compresses every column to its min-content -- which breaks a button's label onto
  // four lines inside a fixed-height row (caught by an adversarial audit of this PR).
  const table = (
    <table className="w-max text-sm">
      <caption className="sr-only">{HISTORY_VI.caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="px-2 py-1 text-left font-semibold whitespace-nowrap">
            {HISTORY_VI.runColumn}
          </th>
          <th scope="col" className="px-2 py-1 text-left font-semibold whitespace-nowrap">
            {HISTORY_VI.starsColumn}
          </th>
          {columns.map((n) => (
            <th key={n} scope="col" className="px-2 py-1 text-left font-semibold whitespace-nowrap">
              {HISTORY_VI.case(n)}
            </th>
          ))}
          {onDuplicate && (
            <th scope="col" className="px-2 py-1 text-left font-semibold whitespace-nowrap">
              {HISTORY_VI.actionColumn}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          // The matrix keeps the store's order, so the row and its mark share an index.
          const mark = runs[index];
          return (
            <tr key={row.at} data-run-row className="border-t border-line">
              <th scope="row" className="px-2 py-1 text-left font-semibold whitespace-nowrap">
                {HISTORY_VI.run(index + 1)}
              </th>
              <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                {HISTORY_VI.stars(row.stars)}
              </td>
              <Cells row={row} />
              {onDuplicate && mark && (
                <td className="px-2 py-1">
                  <button
                    type="button"
                    data-duplicate=""
                    // Three rows would otherwise be three buttons with one name; the number
                    // counts from the newest, the order the table reads.
                    aria-label={HISTORY_VI.duplicateRow(index + 1)}
                    onClick={() => {
                      onDuplicate(mark);
                    }}
                    className={buttonClass("inline", "whitespace-nowrap")}
                  >
                    {HISTORY_VI.duplicate}
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <Viz caption={HISTORY_VI.caption} stamp="run" form="table">
      {/* Thirteen columns at L1 (ten cases plus three), far wider than a 375 px screen. Without
          its own scroller the table pushes the page sideways and lies over what is above it.
          Focusable for the same reason as the figure frame's: scrolling it IS the function. */}
      <div
        tabIndex={0}
        role="region"
        aria-label={HISTORY_VI.caption}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand"
      >
        {table}
      </div>
    </Viz>
  );
}
