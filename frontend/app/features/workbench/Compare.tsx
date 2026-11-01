import type { ReactElement } from "react";

import { changeName, COMPARE_VI } from "./copy";
import { compare } from "./runHistory";
import type { Env } from "./bench";
import type { RunMark } from "./storage";

/**
 * The comparison card (N20): what changed between two remembered runs and which cases flipped.
 *
 * Text only, so no `Viz` and no source stamp -- a picture would need one, a sentence does not.
 * The label is the whole point of the card and rests entirely on `changes.length` (see
 * `compare`): naming a cause is honest for exactly one changed variable, never for more.
 */
export function Compare({
  env,
  prev,
  now,
}: {
  env: Env;
  prev: RunMark;
  now: RunMark;
}): ReactElement | null {
  const result = compare(env, prev, now);
  if (result === null) return null;
  const { changes, flipped } = result;

  return (
    <div data-compare="" className="mt-3 max-w-prose rounded-md border border-line p-3 text-sm">
      <p className="font-semibold">{COMPARE_VI.heading}</p>
      {changes.length === 0 ? (
        <p className="mt-1">{COMPARE_VI.sameConfig}</p>
      ) : changes.length === 1 && changes[0] !== undefined ? (
        <p className="mt-1">{COMPARE_VI.single(changeName(changes[0]))}</p>
      ) : (
        <>
          <p className="mt-1">{COMPARE_VI.multiple}</p>
          <p className="mt-1 text-fg-muted">
            {COMPARE_VI.changed} {changes.map(changeName).join(", ")}.
          </p>
        </>
      )}
      {flipped.length > 0 && (
        <ul className="mt-1 list-inside list-disc">
          {flipped.map((f) => (
            <li key={f.n}>{COMPARE_VI.flip(f.n, f.from, f.to)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
