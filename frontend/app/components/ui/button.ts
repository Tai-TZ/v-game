export type ButtonVariant = "primary" | "secondary" | "on-ink" | "quiet";

const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-sm px-5 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-subtle",
  "on-ink": "border border-on-ink/50 text-on-ink hover:bg-on-ink/10",
  quiet: "text-brand hover:bg-brand-tint",
};

/** Class names for buttons and button-styled links, so both share one visual language. */
export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
