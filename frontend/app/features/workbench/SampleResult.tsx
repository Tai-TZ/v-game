import type { ReactElement } from "react";

import { SAMPLE_VI } from "./copy";
import { sampleVerdict, type RunView } from "./run";

/**
 * N2: what the sample step leaves behind once it ends.
 *
 * A sample run earns no stars, so `Results` -- which hangs on `run.score` -- never renders for
 * it, and the panel that named the step unmounts with the run. Without this the cheap step
 * finishes into silence: three graded cases and nothing saying what they were for, or why the
 * star run did or did not follow.
 */
export function SampleResult({
  run,
  samplesOnly = false,
}: {
  run: RunView;
  /** The pool covered the samples alone (§5.1): a pass then ends the shift, not opens it. */
  samplesOnly?: boolean;
}): ReactElement | null {
  const verdict = sampleVerdict(run);
  if (verdict === null) return null;
  const line = verdict === "passed" && samplesOnly ? SAMPLE_VI.passedAlone : SAMPLE_VI[verdict];
  const passed = run.cases.filter((c) => c.graded?.passed === true).length;

  return (
    <section aria-labelledby="wb-sample" className="mt-12 max-w-prose border-t border-line pt-8">
      {/* Focusable for the same reason the results heading is: the run panel holding focus is
          unmounting, and a star run hands focus to its own results. */}
      <h2 id="wb-sample" tabIndex={-1} className="text-2xl font-bold tracking-tight">
        {SAMPLE_VI.heading}
      </h2>
      <p className="mt-2 tabular-nums">
        {SAMPLE_VI.count(passed, run.cases.length)} {SAMPLE_VI.noStars}
      </p>
      <p className="mt-1 text-sm text-fg-muted">{line}</p>
    </section>
  );
}
