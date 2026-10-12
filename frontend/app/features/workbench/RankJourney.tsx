import type { ReactElement } from "react";

import { JOURNEY_VI } from "./copy";
import { rankJourney, type Move } from "./journey";

/** Up is out of the deep end, down is back into it; "same" and the first stop are neutral. */
const TONE: Readonly<Record<Move, string>> = {
  start: "border-line-strong",
  up: "border-success bg-success-tint",
  down: "border-danger bg-danger-tint",
  same: "border-line-strong",
};

/**
 * "Đường đời hạng": the answer passage's place in each block that ranked it, in the order the
 * graph ran them (gameplay-direction §3, L3). The numbers are the engine's own; the colour only
 * says which way the last hop went.
 */
export function RankJourney({
  ranks,
  order,
  toys,
}: {
  ranks: Readonly<Record<string, number | null>>;
  order: readonly string[];
  /** Node id -> the toy's name, so the picture speaks the bench's language. */
  toys: Readonly<Record<string, string>>;
}): ReactElement | null {
  const steps = rankJourney(ranks, order);
  if (steps.length === 0) return null;
  const say = (node: string, rank: number | null) =>
    rank === null ? `${toys[node] ?? node} không tìm thấy` : `${toys[node] ?? node} hạng ${rank}`;

  return (
    <div className="mt-2">
      <p className="sr-only">{steps.map((s) => say(s.node, s.rank)).join(", ")}</p>
      <ol aria-hidden="true" className="flex flex-wrap items-center gap-1 text-sm">
        {steps.map((step) => (
          <li
            key={step.node}
            data-hop={step.move}
            className={`rounded-sm border px-2 py-1 tabular-nums ${TONE[step.move]}`}
          >
            <span className="text-fg-muted">{toys[step.node] ?? step.node}</span>{" "}
            {step.rank === null ? JOURNEY_VI.absent : `#${step.rank}`}
          </li>
        ))}
      </ol>
    </div>
  );
}
