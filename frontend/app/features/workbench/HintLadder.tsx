import { useCallback, useEffect, useState, type ReactElement } from "react";

import { buttonClass } from "~/components/ui/button";
import { levelStars, readProgress } from "~/features/progress/progress";

import { HINTS_VI, TOY } from "./copy";
import {
  canOpen,
  configKey,
  hint3Gate,
  hintFor,
  hintTarget,
  loadHints,
  look,
  open,
  recordFail,
  saveHints,
  type GateContext,
  type HintBook,
  type Pointer,
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

  return { book, target, gate3, openNext, markLook };
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
  onOpen,
  onPointer,
}: {
  levelId: string;
  target: Target;
  book: HintBook;
  /** The rest of hint 3's gate (`hint3Gate`): failures at this star, or the pool. */
  gate3: boolean;
  onOpen: () => void;
  onPointer: (pointer: Pointer) => void;
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
                <button
                  type="button"
                  onClick={() => onPointer(hint.pointer)}
                  className={buttonClass("inline")}
                >
                  {pointerLabel(hint.pointer)}
                </button>
              </li>
            ) : null,
          )}
        </ol>
      )}
      {next !== null ? (
        <button type="button" onClick={onOpen} className={buttonClass("secondary", "mt-3")}>
          {HINTS_VI.open(next)}
        </button>
      ) : (
        <>
          {opened === 1 && <p className="mt-3 text-sm text-fg-muted">{HINTS_VI.waitLook}</p>}
          {/* Said in full, numbers included: a gate the player cannot see reads as arbitrary. */}
          {opened === 2 && (
            <p className="mt-3 text-sm text-fg-muted">{HINTS_VI.waitGate(failures)}</p>
          )}
        </>
      )}
    </section>
  );
}
