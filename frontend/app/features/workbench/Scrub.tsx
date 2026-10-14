import type { ReactElement } from "react";

import { buttonClass } from "~/components/ui/button";
import { ChevronDownIcon } from "~/components/ui/icons";

import { SCRUB_VI } from "./copy";
import type { CaseView } from "./run";

/**
 * N4: walk a finished run case by case. The case table jumps to one; this walks the run in the
 * order it happened, which is what re-reading a run you already watched actually is.
 *
 * It moves the followed case and nothing else, so the bench, the dome and the cards all redraw
 * from the one piece of state they already read.
 */
export function Scrub({
  cases,
  followedId,
  onFollow,
}: {
  cases: readonly CaseView[];
  followedId: string | null;
  onFollow: (caseId: string) => void;
}): ReactElement | null {
  if (cases.length < 2) return null;
  const at = Math.max(
    0,
    cases.findIndex((c) => c.id === followedId),
  );
  const step = (to: number) => {
    const next = cases[to];
    if (next) onFollow(next.id);
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        disabled={at === 0}
        onClick={() => step(at - 1)}
        aria-label={SCRUB_VI.prev}
        className={buttonClass("inline", "px-2")}
      >
        <ChevronDownIcon className="size-4 shrink-0 rotate-90" />
      </button>
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="sr-only">{SCRUB_VI.label}</span>
        <input
          type="range"
          min={1}
          max={cases.length}
          step={1}
          value={at + 1}
          onChange={(event) => step(Number(event.target.value) - 1)}
          className="min-w-0 flex-1 accent-brand"
        />
      </label>
      <button
        type="button"
        disabled={at === cases.length - 1}
        onClick={() => step(at + 1)}
        aria-label={SCRUB_VI.next}
        className={buttonClass("inline", "px-2")}
      >
        <ChevronDownIcon className="size-4 shrink-0 -rotate-90" />
      </button>
      <p className="shrink-0 text-sm tabular-nums">{SCRUB_VI.at(at + 1, cases.length)}</p>
    </div>
  );
}
