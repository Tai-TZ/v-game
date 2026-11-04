// A module of its own, not the workbench's: the micro lessons draw their radios as these chips
// too, and importing it from the bench pulled the whole workbench into every lesson's chunk.

/** A radio drawn as a chip: the span after a `peer sr-only` input. */
export const CHIP =
  "flex h-11 min-w-11 items-center justify-center rounded-sm border border-fg-muted bg-surface px-3 text-sm peer-checked:border-brand peer-checked:bg-brand peer-checked:text-on-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-60";
