import type { ReactElement, ReactNode } from "react";

const TONE = {
  pass: "text-success border-success",
  fail: "text-danger border-danger",
  muted: "text-fg-muted border-line-strong",
} as const;

/**
 * One beat later per step: a stamp's `delay`, and the nth earned star's. Literal strings, so
 * Tailwind's scanner sees every class.
 */
export const LAND_DELAY = [
  "[animation-delay:0ms]",
  "[animation-delay:60ms]",
  "[animation-delay:120ms]",
] as const;

/**
 * A verdict pressed onto the page like an ink stamp (graphics upgrade 4.3): mono capitals in a
 * double border, tilted, landing once. `uppercase` is CSS, so a screen reader hears the copy as
 * typed. Motion-safe only: with reduced motion the stamp is simply there, in place.
 */
export function Stamp({
  tone,
  children,
  delay = 0,
}: {
  tone: "pass" | "fail" | "muted";
  children: ReactNode;
  delay?: 0 | 1 | 2;
}): ReactElement {
  return (
    <span
      data-stamp={tone}
      className={`inline-block -rotate-3 border-4 border-double px-2 py-0.5 font-mono text-sm font-semibold uppercase motion-safe:animate-stamp chieu:text-2xl ${TONE[tone]} ${LAND_DELAY[delay]}`}
    >
      {children}
    </span>
  );
}
