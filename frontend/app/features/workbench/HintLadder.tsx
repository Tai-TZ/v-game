import { useCallback, useState, type ReactElement } from "react";

import { buttonClass } from "~/components/ui/button";

import { HINTS_VI, TOY } from "./copy";
import {
  canOpen,
  hintFor,
  hintTarget,
  loadHints,
  look,
  open,
  saveHints,
  type HintBook,
  type Pointer,
  type Target,
} from "./hints";
import type { RunView } from "./run";

/**
 * The ladder's state for one level (N16): the target the last run of the player's own leaves,
 * and the two moves that change the book -- opening the next hint, and a free look. The store is
 * re-read before every write, so a second tab is never undone.
 */
export function useHints(levelId: string, run: RunView | null) {
  const [book, setBook] = useState<HintBook>(() => loadHints(levelId));
  const target = run ? hintTarget(levelId, run) : null;

  const write = useCallback(
    (next: HintBook) => {
      saveHints(levelId, next);
      setBook(next);
    },
    [levelId],
  );
  const openNext = useCallback(() => {
    if (!target) return;
    const fresh = loadHints(levelId);
    if (canOpen(fresh, target.key) === null) return;
    write(open(fresh, target.key, target.star, Date.now()));
  }, [levelId, target, write]);
  const markLook = useCallback(() => write(look(loadHints(levelId))), [levelId, write]);

  return { book, target, openNext, markLook };
}

const pointerLabel = (pointer: Pointer) =>
  pointer.kind === "case"
    ? HINTS_VI.seeCase(pointer.n)
    : HINTS_VI.seeSlot(
        (pointer.param && TOY[pointer.slot].params?.[pointer.param]) ?? TOY[pointer.slot].name,
      );

/**
 * N16: hints 1 and 2, each naming a case and pointing at a thing on the screen. Optional by
 * design -- nothing is in the way of a player who does not want them (expertise reversal,
 * Kalyuga et al. 2003) -- and hidden on the projector, where they are the pairs' to open (R3).
 */
export function HintLadder({
  levelId,
  target,
  book,
  onOpen,
  onPointer,
}: {
  levelId: string;
  target: Target;
  book: HintBook;
  onOpen: () => void;
  onPointer: (pointer: Pointer) => void;
}): ReactElement | null {
  const opened = book.targets[target.key]?.opened ?? 0;
  const next = canOpen(book, target.key);
  const shown = ([1, 2] as const)
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
                  <span className="font-semibold">{HINTS_VI.label(n)}: </span>
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
        opened === 1 && <p className="mt-3 text-sm text-fg-muted">{HINTS_VI.waitLook}</p>
      )}
    </section>
  );
}
