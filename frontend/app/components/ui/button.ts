export type ButtonVariant = "primary" | "secondary" | "on-ink" | "quiet" | "inline";

const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

// Padding lives in the variant: an extra `px-3` cannot beat a base `px-5` in the generated CSS.
const variants: Record<ButtonVariant, string> = {
  primary: "px-5 bg-brand text-on-brand hover:bg-brand-strong",
  secondary: "px-5 border border-line-strong bg-surface text-fg hover:bg-subtle",
  "on-ink": "px-5 border border-on-ink/50 text-on-ink hover:bg-on-ink/10",
  quiet: "px-5 text-brand hover:bg-brand-tint",
  /** Quiet, with its text on the column edge (the hover tint bleeds into the gutter). */
  inline: "-ml-3 px-3 text-brand hover:bg-brand-tint",
};

/** Class names for buttons and button-styled links, so both share one visual language. */
export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
