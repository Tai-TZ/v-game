import type { ReactElement } from "react";

import { JOURNEY_VI } from "./copy";
import { Viz } from "./Viz";
import { rankJourney, type Move, type Scale } from "./journey";

/**
 * Up is out of the deep end, down is back into it. The first stop, an unmoved rank and a hop
 * between two different populations are all neutral: colouring a rescaled hop would claim a
 * comparison the two numbers do not support (§8.6, and the prose list beside this says which
 * scale each rank was taken on).
 */
const TONE: Readonly<Record<Move, string>> = {
  start: "border-line-strong",
  up: "border-success bg-success-tint",
  down: "border-danger bg-danger-tint",
  same: "border-line-strong",
  rescaled: "border-line-strong",
};

/** A typographic arrow, not an icon font: colour alone would leave the direction unreadable to
 *  a player who cannot separate the green from the red. */
const ARROW: Readonly<Record<Move, string>> = {
  start: "",
  up: "↑",
  down: "↓",
  same: "",
  rescaled: "",
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
  scales,
}: {
  ranks: Readonly<Record<string, number | null>>;
  order: readonly string[];
  /** Node id -> the toy's name, so the picture speaks the bench's language. */
  toys: Readonly<Record<string, string>>;
  /** Node id -> the population that block ranked over. Without it no hop is called a move. */
  scales?: Readonly<Record<string, Scale>>;
}): ReactElement | null {
  const steps = rankJourney(ranks, order, scales);
  if (steps.length === 0) return null;

  const scaleOf = (node: string) => {
    const scale = scales?.[node];
    if (scale === undefined) return JOURNEY_VI.unknownScale;
    return scale.kind === "corpus"
      ? JOURNEY_VI.corpus
      : scale.size === null
        ? JOURNEY_VI.unknownScale
        : JOURNEY_VI.kept(scale.size);
  };

  // No sr-only copy of the journey: the table form below carries the same ranks with the scale
  // each was taken on, so a second scale-free reading would be duplicate and worse. The chips
  // are the picture of it, and stay out of the a11y tree.
  return (
    <Viz
      caption={JOURNEY_VI.caption}
      stamp="run"
      table={
        <table className="text-sm">
          <tbody>
            {steps.map((step) => (
              <tr key={step.node} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 text-left font-semibold whitespace-nowrap">
                  {toys[step.node] ?? step.node}
                </th>
                <td className="py-1 pr-3 tabular-nums">
                  {step.rank === null ? JOURNEY_VI.absent : `#${step.rank}`}
                </td>
                <td className="py-1 text-fg-muted">{scaleOf(step.node)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ol aria-hidden="true" className="flex flex-wrap items-center gap-1 text-sm">
        {steps.map((step) => (
          <li
            key={step.node}
            data-hop={step.move}
            className={`rounded-sm border px-2 py-1 tabular-nums ${TONE[step.move]}`}
          >
            <span className="text-fg-muted">{toys[step.node] ?? step.node}</span>{" "}
            {step.rank === null ? JOURNEY_VI.absent : `#${step.rank}`}
            {ARROW[step.move] !== "" && <span className="ml-0.5">{ARROW[step.move]}</span>}
          </li>
        ))}
      </ol>
    </Viz>
  );
}
