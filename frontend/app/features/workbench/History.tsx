import type { ReactElement } from "react";

import { buttonClass } from "~/components/ui/button";
import { CheckIcon, CircleDashIcon, CrossIcon } from "~/components/ui/icons";

import { HISTORY_VI } from "./copy";
import { historyMatrix, type Cell, type HistoryRow } from "./history";
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

  const table = (
    <table className="text-sm">
      <caption className="sr-only">{HISTORY_VI.caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="px-2 py-1 text-left font-semibold">
            {HISTORY_VI.runColumn}
          </th>
          <th scope="col" className="px-2 py-1 text-left font-semibold">
            {HISTORY_VI.starsColumn}
          </th>
          {columns.map((n) => (
            <th key={n} scope="col" className="px-2 py-1 text-left font-semibold">
              {HISTORY_VI.case(n)}
            </th>
          ))}
          {onDuplicate && (
            <th scope="col" className="px-2 py-1 text-left font-semibold">
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
                    className={buttonClass("inline")}
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
    <Viz caption={HISTORY_VI.caption} stamp="run">
      {table}
    </Viz>
  );
}
