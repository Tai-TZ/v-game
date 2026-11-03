import { useCallback, useEffect, useState, type ReactElement } from "react";

import { buttonClass } from "~/components/ui/button";
import { levelStars, readProgress } from "~/features/progress/progress";

import { HINTS_VI, PRINCIPLE_VI, TOY } from "./copy";
import {
  answer,
  canOpen,
  configKey,
  hint3Gate,
  hintFor,
  hintTarget,
  loadHints,
  look,
  open,
  principleOptions,
  recordFail,
  saveHints,
  settled,
  type GateContext,
  type HintBook,
  type Pointer,
  type Principle,
  type Target,
} from "./hints";
import type { RunView } from "./run";

/**
 * The ladder's state for one level (N16, X28): the target the player's own last run leaves, that
 * run's failure on the book, and the two moves that change it -- opening the next hint, and a free
 * look. Every move builds on the book in memory and then stores it, so a blocked or cleared store
 * still walks the ladder; it only forgets it on reload.
 */
export function useHints({
  levelId,
  zoneId,
  run,
  ranBody,
  gate,
}: {
  levelId: string;
  zoneId: string;
  run: RunView | null;
  /** The graph JSON `run` was sent with: a failure counts once per configuration. */
  ranBody: string | null;
  gate: GateContext;
}) {
  const [book, setBook] = useState<HintBook>(() => loadHints(levelId));
  const target = run ? hintTarget(levelId, run, levelStars(readProgress(), zoneId, levelId)) : null;
  // The run's failure goes on the book during the render that first shows the run -- state
  // derived from a change in the run, not a system to sync -- so no frame shows a stale gate.
  const [counted, setCounted] = useState<string | null>(null);
  if (run && target && ranBody !== null && counted !== run.runId) {
    setCounted(run.runId);
    setBook(recordFail(book, target.star, configKey(ranBody), run.scope === "mau"));
  }
  // The store follows the book. A store that cannot be written still walks the ladder; it
  // only forgets it on reload.
  useEffect(() => {
    saveHints(levelId, book);
  }, [levelId, book]);

  const gate3 = target !== null && hint3Gate(book, target, gate);
  const openNext = useCallback(() => {
    if (!target) return;
    if (canOpen(book, target.key, hint3Gate(book, target, gate)) === null) return;
    setBook(open(book, target.key, target.star, Date.now()));
  }, [target, book, gate]);
  const markLook = useCallback(() => setBook(look(book)), [book]);
  const pick = useCallback(
    (n: 1 | 2 | 3, principle: Principle) => {
      if (target) setBook(answer(book, levelId, target, n, principle, Date.now()));
    },
    [target, book, levelId],
  );

  return { book, target, gate3, openNext, markLook, pick };
}

const pointerLabel = (pointer: Pointer) =>
  pointer.kind === "case"
    ? HINTS_VI.seeCase(pointer.n)
    : HINTS_VI.seeSlot(
        (pointer.param && TOY[pointer.slot].params?.[pointer.param]) ?? TOY[pointer.slot].name,
      );

/**
 * N16: hints 1 to 3, each naming a case and pointing at a thing on the screen; the third is the
 * worked solution, behind its own gate (X28) and said to be one. Optional by
 * design -- nothing is in the way of a player who does not want them (expertise reversal,
 * Kalyuga et al. 2003) -- and hidden on the projector, where they are the pairs' to open (R3).
 */
export function HintLadder({
  levelId,
  target,
  book,
  gate3,
  variant,
  busy,
  onOpen,
  onPointer,
  onVariant,
  onPick,
}: {
  levelId: string;
  target: Target;
  book: HintBook;
  /** The rest of hint 3's gate (`hint3Gate`): failures at this star, or the pool. */
  gate3: boolean;
  /** The review case to fix for after hint 3, or null where the star has none (daily-shift §2). */
  variant: string | null;
  /** A request or a run is out: the variant waits for it. */
  busy: boolean;
  onOpen: () => void;
  onPointer: (pointer: Pointer) => void;
  onVariant: () => void;
  /** The player named the principle under hint n (plan v0.7 2.2). */
  onPick: (n: 1 | 2 | 3, principle: Principle) => void;
}): ReactElement | null {
  const opened = book.targets[target.key]?.opened ?? 0;
  const next = canOpen(book, target.key, gate3);
  const failures = book.fails[String(target.star) as "1" | "2" | "3"]?.configs.length ?? 0;
  const shown = ([1, 2, 3] as const)
    .filter((n) => n <= opened)
    .map((n) => ({ n, hint: hintFor(levelId, target, n) }));
  // A level with no ladder written for it offers none rather than an empty box.
  if (hintFor(levelId, target, 1) === null) return null;

  return (
    <section
      aria-labelledby="wb-hints"
      className="mt-8 max-w-prose rounded-md border border-line p-4 chieu:hidden"
    >
      <h2 id="wb-hints" className="text-lg font-bold">
        {HINTS_VI.heading}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">{HINTS_VI.lead(target.star)}</p>
      {shown.length > 0 && (
        <ol className="mt-3 space-y-3">
          {shown.map(({ n, hint }) =>
            hint ? (
              <li key={n} data-hint={n}>
                <p>
                  <span className="font-semibold">
                    {n === 3 ? HINTS_VI.example : HINTS_VI.label(n)}:{" "}
                  </span>
                  {hint.text}
                </p>
                {hint.last !== undefined &&
                  (opened >= 4 ? (
                    <p data-hint-last="shown" className="mt-1">
                      <span className="font-semibold">{HINTS_VI.lastLabel}: </span>
                      {hint.last}
                    </p>
                  ) : (
                    <p data-hint-last="hidden" className="mt-1 text-sm text-fg-muted">
                      {HINTS_VI.lastHidden}
                    </p>
                  ))}
                <button
                  type="button"
                  onClick={() => onPointer(hint.pointer)}
                  className={buttonClass("inline")}
                >
                  {pointerLabel(hint.pointer)}
                </button>
                <PrincipleCheck
                  levelId={levelId}
                  target={target}
                  n={n}
                  principle={hint.principle}
                  book={book}
                  onPick={onPick}
                />
              </li>
            ) : null,
          )}
        </ol>
      )}
      {next !== null && (
        <button type="button" onClick={onOpen} className={buttonClass("secondary", "mt-3")}>
          {next === 4 ? HINTS_VI.showLast : HINTS_VI.open(next)}
        </button>
      )}
      {next === null && opened === 1 && (
        <p className="mt-3 text-sm text-fg-muted">{HINTS_VI.waitLook}</p>
      )}
      {/* Said in full, numbers included: a gate the player cannot see reads as arbitrary. */}
      {next === null && opened === 2 && (
        <p className="mt-3 text-sm text-fg-muted">{HINTS_VI.waitGate(failures)}</p>
      )}
      {/* The variant does not wait for the last step: fixing for it is the player's own try. */}
      {opened >= 3 && variant !== null && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="font-bold">{HINTS_VI.variantHeading}</h3>
          <p className="mt-1 text-sm text-fg-muted">{HINTS_VI.variantLead}</p>
          <button
            type="button"
            onClick={onVariant}
            disabled={busy}
            className={buttonClass("secondary", "mt-3")}
          >
            {HINTS_VI.variantRun}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Plan v0.7 2.2: "nguyên lý nào?" under a rung, from four of the level's principles. Once the
 * ladder has the principle right, a rung resting on it names it instead of asking again. It
 * opens nothing and holds nothing back: naming the principle is the point, not a gate.
 */
function PrincipleCheck({
  levelId,
  target,
  n,
  principle,
  book,
  onPick,
}: {
  levelId: string;
  target: Target;
  n: 1 | 2 | 3;
  principle: Principle;
  book: HintBook;
  onPick: (n: 1 | 2 | 3, principle: Principle) => void;
}): ReactElement {
  if (settled(book, target.key, principle)) {
    return (
      <p data-principle="named" className="mt-2 text-sm">
        <span className="font-semibold">{HINTS_VI.principleNamed}: </span>
        {PRINCIPLE_VI[principle]}
      </p>
    );
  }
  const latest = book.picks.filter((p) => p.target === target.key && p.n === n).at(-1);
  return (
    <fieldset data-principle="ask" className="mt-2">
      <legend className="text-sm font-semibold">{HINTS_VI.principleAsk}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {principleOptions(levelId, principle).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={latest?.pick === option}
            onClick={() => onPick(n, option)}
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 py-1 text-left text-sm aria-pressed:border-brand aria-pressed:bg-brand-tint"
          >
            {PRINCIPLE_VI[option]}
          </button>
        ))}
      </div>
      {latest && !latest.right && <p className="mt-1 text-sm">{HINTS_VI.principleWrong}</p>}
    </fieldset>
  );
}
