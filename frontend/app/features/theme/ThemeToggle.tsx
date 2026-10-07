import { useTheme } from "./context";

interface ThemeToggleProps {
  /** `surface`: solid panel for use over the 3D scene (art §8.1). */
  tone?: "light" | "dark" | "surface";
  /** Icon only below the `sm` breakpoint; the theme name stays available to screen readers. */
  compact?: boolean;
}

const TONES = {
  light: "border-line text-fg hover:border-line-strong hover:bg-subtle",
  dark: "border-on-ink/40 text-on-ink hover:bg-on-ink/10",
  surface: "border-line-strong bg-surface text-fg hover:bg-subtle",
} as const;

/** Cycles through the installed theme packs. Hidden when only one pack is installed. */
export function ThemeToggle({ tone = "light", compact = false }: ThemeToggleProps) {
  const themes = useTheme((state) => state.themes);
  const activeId = useTheme((state) => state.activeId);
  const cycleTheme = useTheme((state) => state.cycleTheme);

  if (themes.length < 2) return null;
  const active = themes.find((theme) => theme.id === activeId);

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-sm border px-3 text-sm font-medium ${TONES[tone]}`}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" />
      </svg>
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        <span className="sr-only">Đổi giao diện. Đang dùng: </span>
        {active?.name}
      </span>
    </button>
  );
}
