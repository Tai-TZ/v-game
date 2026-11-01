import type { DragEvent, ReactElement } from "react";

import { setCard, systemPrompt, type Bench, type Env } from "./bench";
import { fmt } from "./copy";

type Slot = 0 | 1 | 2;
const SLOTS: readonly Slot[] = [0, 1, 2];

/**
 * Lăng kính: the level's prompt cards as a deck, and the lens's three slots they go in. A card
 * pressed goes into the first empty slot and comes back out when pressed again; a card can also
 * be dragged onto a slot, which moves it if it sat in another. The words on a card are the words
 * the brain is told, so they are on the card, not behind a menu.
 *
 * Pressing is the way in for every hand (touch, keyboard, reader); the drag is a shortcut on top.
 */
export function Prism({
  env,
  bench,
  onChange,
}: {
  env: Env;
  bench: Bench;
  onChange: (next: Bench) => void;
}): ReactElement {
  const deck = Object.entries(env.level.prompt_cards);
  const length = systemPrompt(env.level, bench.cards).length;
  const full = bench.cards.every((key) => key !== null);
  const slotOf = (key: string) => bench.cards.findIndex((held) => held === key) as Slot | -1;

  const press = (key: string) => {
    const at = slotOf(key);
    const empty = bench.cards.findIndex((held) => held === null);
    if (at !== -1) onChange(setCard(bench, at, null));
    else if (empty !== -1) onChange(setCard(bench, empty as Slot, key));
  };
  const drop = (target: Slot) => (event: DragEvent) => {
    event.preventDefault();
    const key = event.dataTransfer.getData("text/plain");
    if (!(key in env.level.prompt_cards)) return;
    const from = slotOf(key);
    if (from === target) return;
    onChange(setCard(from === -1 ? bench : setCard(bench, from, null), target, key));
  };
  const allowDrop = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  return (
    <fieldset data-param="system_prompt">
      <legend className="text-sm font-medium">
        Lăng kính · Dặn dò · <code className="font-mono text-xs">system_prompt</code>
      </legend>

      <ol aria-label="Ba khe của Lăng kính" className="mt-2 grid grid-cols-3 gap-2">
        {SLOTS.map((at) => {
          const key = bench.cards[at];
          return (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a drop target for the mouse; every hand can press a card in instead
            <li key={at} onDragOver={allowDrop} onDrop={drop(at)} className="min-w-0">
              {key ? (
                <button
                  type="button"
                  data-lens-slot={at}
                  data-card={key}
                  aria-label={`Khe ${at + 1}: thẻ ${key}. Bấm để gỡ ra`}
                  onClick={() => onChange(setCard(bench, at, null))}
                  className="flex h-24 w-full min-w-0 flex-col items-start gap-1 rounded-md border-2 border-brand bg-brand-tint p-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="font-mono text-sm font-bold">{key}</span>
                  <span className="line-clamp-3 text-xs">{env.level.prompt_cards[key]}</span>
                </button>
              ) : (
                <div
                  data-lens-slot={at}
                  data-card=""
                  className="flex h-24 w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-line-strong p-2 text-center text-xs text-fg-muted"
                >
                  <span className="font-semibold">Khe {at + 1}</span>
                  <span>trống</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Said when it bites: a deck that went grey with no word of why reads as broken. */}
      <p data-lens-help={full ? "full" : "open"} className="mt-3 text-xs text-fg-muted">
        {full
          ? "Ba khe đã đầy: bấm một khe để rút thẻ ra, rồi cắm thẻ khác."
          : "Bấm một thẻ để cắm vào khe trống, bấm lại để rút ra. Trên máy tính có thể kéo thẻ vào khe."}
      </p>
      <ul aria-label="Thẻ dặn dò" className="mt-2 grid gap-2 sm:grid-cols-2">
        {deck.map(([key, text]) => {
          const inUse = slotOf(key) !== -1;
          return (
            <li key={key} className="min-w-0">
              <button
                type="button"
                draggable
                data-deck-card={key}
                aria-pressed={inUse}
                disabled={full && !inUse}
                onClick={() => press(key)}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", key);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className="flex min-h-11 w-full min-w-0 items-start gap-2 rounded-md border border-line-strong bg-surface p-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-brand aria-pressed:bg-brand-tint"
              >
                <span className="font-mono font-bold">{key}</span>
                <span>{text}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-sm text-fg-muted">
        Dặn dò: {fmt(length)} ký tự, đi riêng ngoài thùng.
      </p>
    </fieldset>
  );
}
