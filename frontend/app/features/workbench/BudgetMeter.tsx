import { fmt } from "./copy";
import type { RunView } from "./run";

/** Every case's tokens in and out: the figure star 2 is judged on, as it streams in. */
export const runTokens = (run: Pick<RunView, "cases">) =>
  run.cases.reduce((sum, c) => sum + c.tokens.in + c.tokens.out, 0);

/** Room past the budget on the scale, so the star-2 mark sits inside the bar. */
const HEADROOM = 1.25;

/**
 * G4 (interactive-levels-v0.6 §4): the run's tokens against the star-2 budget. The scale runs a
 * quarter past the budget so the mark is visible and going over shows as the fill crossing it;
 * a run far over stretches the scale instead of drawing past the end.
 */
export function BudgetMeter({ used, budget }: { used: number; budget: number }) {
  const scale = Math.max(budget * HEADROOM, used, 1);
  const fill = (used / scale) * 100;
  const mark = (budget / scale) * 100;
  const over = used > budget;
  return (
    <div className="space-y-1">
      <p className="text-sm tabular-nums">
        {fmt(used)}/{fmt(budget)} token{" "}
        <span className="text-fg-muted">· vạch là ngân sách sao 2</span>
      </p>
      <svg
        aria-hidden="true"
        data-budget-meter=""
        data-over={over}
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        className="h-2 w-full"
      >
        <rect width="100" height="6" className="fill-subtle" />
        <rect
          data-budget-fill=""
          width={fill}
          height="6"
          className={over ? "fill-danger" : "fill-brand"}
        />
        <rect data-budget-mark="" x={mark} width="0.8" height="6" className="fill-fg" />
      </svg>
    </div>
  );
}
