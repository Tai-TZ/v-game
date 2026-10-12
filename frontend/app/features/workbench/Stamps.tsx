import type { ReactElement } from "react";

import { STAMP_VI } from "./copy";
import { stampAnswer, type StampKind } from "./stamp";
import { Viz } from "./Viz";

const LOOK: Readonly<Record<StampKind, string>> = {
  brick: "border-success bg-success-tint",
  fake: "border-danger bg-danger-tint",
  // Dashed and unfilled: a sentence standing on nothing.
  bubble: "border-dashed border-line-strong",
};

/**
 * Máy đóng tem: the answer as bricks and bubbles (gameplay-direction §3, L1). A sentence with
 * a source the bin actually held is a brick; one citing an id the bin never had is the
 * fabrication the level is about; one citing nothing is a bubble.
 */
export function Stamps({
  answer,
  included,
}: {
  answer: string;
  included: readonly string[];
}): ReactElement | null {
  const parts = stampAnswer(answer, included);
  if (parts.length === 0) return null;
  const count = (kind: StampKind) => parts.filter((p) => p.kind === kind).length;
  const label = [
    count("brick") > 0 ? `${count("brick")} câu có nguồn` : "",
    count("fake") > 0 ? `${count("fake")} câu trích nguồn bịa` : "",
    count("bubble") > 0 ? `${count("bubble")} câu không nguồn` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Viz
      caption={STAMP_VI.caption}
      stamp="run"
      table={
        <table className="text-sm">
          <tbody>
            {parts.map((part, index) => (
              <tr key={index} className="border-t border-line">
                <td className="max-w-prose py-1 pr-3">{part.text}</td>
                <td className="py-1 whitespace-nowrap">{STAMP_VI.kind[part.kind]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {/* Not role="img": these are the assistant's own sentences, read as text. Giving the
          list that role also orphaned every <li>, which axe caught on the workbench page. */}
      <p className="sr-only">{label}</p>
      <ul className="max-w-prose space-y-1">
        {parts.map((part, index) => (
          <li
            key={index}
            data-stamp={part.kind}
            className={`rounded-sm border px-2 py-1 text-sm ${LOOK[part.kind]}`}
          >
            {part.text}
            {part.kind === "fake" && (
              <span className="ml-1 font-semibold text-danger">{STAMP_VI.fake}</span>
            )}
            {/* The bubble says it too: a dashed border on its own is style, not words. */}
            {part.kind === "bubble" && (
              <span className="ml-1 text-fg-muted">{STAMP_VI.bubble}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 max-w-prose text-xs text-fg-muted">{STAMP_VI.note}</p>
    </Viz>
  );
}
