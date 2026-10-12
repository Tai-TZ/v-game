import { useState, type ReactElement } from "react";

import type { Env } from "./bench";
import { DEBRIEF_VI } from "./copy";
import { nextPickOptions, type NextPick } from "./diff";
import { gradeSlip, type Slip } from "./guess";
import type { CaseView, RunView } from "./run";
import type { Graph } from "./schema";

/**
 * "Rút kinh nghiệm" (N20): a four-line card closing the run.
 *
 * Lines 1-2 are auto-filled from the slip's own grade (gradeSlip) -- no new typing, which is
 * the point of making them automatic. Line 3 reads back which reason the player picked from
 * the diagnosis menu, by the option's own text. Line 4 offers one enum pick for the next
 * attempt, never free text, so a later count of what players try (T18, not built here) has a
 * closed set to count over.
 *
 * Text only: no `Viz`, no source stamp, no second `aria-live` region.
 */
export function Debrief({
  env,
  run,
  slip,
  graph,
  ask,
  whyIndex,
  onPick,
}: {
  env: Env;
  run: RunView;
  slip: Slip | null;
  /** The bench as it stands, for line 4's enumeration of what can still be turned. */
  graph: Graph;
  ask: { c: CaseView | null; menu: { options: readonly [string, ...string[]] } } | null;
  /** The stable index the player chose in the reason menu; null before they answer. */
  whyIndex: number | null;
  onPick: (extras: { why?: number; next?: NextPick }) => void;
}): ReactElement | null {
  const grade = slip ? gradeSlip(slip, run) : null;
  const [chosen, setChosen] = useState<NextPick | null>(null);
  const options = nextPickOptions(env, graph);
  const reason = whyIndex !== null ? ask?.menu.options[whyIndex] : undefined;

  if (grade === null && reason === undefined && options.length === 0) return null;

  return (
    <div className="mt-8 max-w-prose rounded-md border border-line p-4 text-sm">
      <p className="text-lg font-bold">{DEBRIEF_VI.heading}</p>
      {grade?.count && (
        <p className="mt-2 tabular-nums">
          Bạn đoán {grade.count.guess} câu đạt; thực tế {grade.count.actual}/{grade.count.total} câu
          đạt.
        </p>
      )}
      {grade && grade.predictions.length > 0 && (
        <p className="mt-1 tabular-nums">
          Đoán đúng {grade.predictions.filter((p) => p.right).length}/{grade.predictions.length} câu
          đã đoán.
        </p>
      )}
      {reason !== undefined && <p className="mt-1">{DEBRIEF_VI.why(reason)}</p>}
      {options.length > 0 && (
        <fieldset className="mt-2">
          <legend className="font-semibold">{DEBRIEF_VI.nextLegend}</legend>
          <div className="mt-1 space-y-1">
            {options.map((option) => (
              <label key={option.label} className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="debrief-next"
                  className="size-5 shrink-0 accent-brand"
                  onChange={() => {
                    setChosen(option.pick);
                    onPick({ next: option.pick });
                  }}
                />
                {option.label}
              </label>
            ))}
          </div>
          {chosen && (
            <p className="mt-1 text-fg-muted">
              {DEBRIEF_VI.nextChosen(options.find((o) => o.pick === chosen)?.label ?? "")}
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
