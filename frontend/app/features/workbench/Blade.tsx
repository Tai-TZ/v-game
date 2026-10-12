import type { ReactElement } from "react";

import { bladeCuts } from "./blade";
import { BLADE_VI, fmt, variantVi } from "./copy";

/**
 * Lược dao: the corpus as one strip with the blade's cuts across it, instead of a sentence
 * about how many pieces came out (gameplay-direction §3). Cut spacing is the measured average
 * against the widest size a level offers; the real count is printed, not drawn.
 */
export function Blade({
  variant,
  chunks,
  avgTokens,
  split,
}: {
  variant: string;
  chunks: number;
  avgTokens: number;
  /** ret.boundary_split: this run's answer sentence fell across two pieces. */
  split: boolean;
}): ReactElement {
  const cuts = bladeCuts(avgTokens);
  const label =
    `Lược dao cắt kho thành ${fmt(chunks)} đoạn, trung bình ${fmt(avgTokens)} token mỗi đoạn` +
    (split ? `, ${BLADE_VI.split}` : "");

  return (
    <div className="mt-3">
      <div role="img" aria-label={label} className="max-w-80">
        <div
          className={`relative h-8 overflow-hidden rounded-sm border bg-subtle ${
            split ? "border-danger" : "border-line-strong"
          }`}
        >
          {cuts.map((at) => (
            <span
              key={at}
              data-cut=""
              style={{ left: `${at}%` }}
              aria-hidden="true"
              className={`absolute inset-y-0 w-px ${split ? "bg-danger" : "bg-line-strong"}`}
            />
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm tabular-nums">
        <code className="font-mono text-xs">{variant}</code> ({variantVi(variant)}): {fmt(chunks)}{" "}
        đoạn, trung bình {fmt(avgTokens)} token mỗi đoạn.
      </p>
      {split && <p className="text-sm font-semibold text-danger">{BLADE_VI.splitLine}</p>}
    </div>
  );
}
