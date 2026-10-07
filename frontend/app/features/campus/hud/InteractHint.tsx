import { hintFor, type InteractTarget, type SiteInfoMap } from "../sites";
import { useHub } from "../store";

export const HINT_BUTTON_ID = "hub-interact-hint";

/**
 * What the player can do here. A real button (clicking = pressing E) for the librarian and
 * open buildings; plain text for buildings that are not open yet. The wrapper is a polite
 * live region, so screen readers hear each new target once, not every frame.
 */
export function InteractHint({
  sites,
  onInteract,
}: {
  sites: SiteInfoMap;
  onInteract: (target: InteractTarget) => void;
}) {
  const nearby = useHub((state) => (state.dialog ? null : state.nearby));
  const hint = nearby ? hintFor(nearby, sites) : null;
  const box =
    "border-line-strong bg-surface animate-enter pointer-events-auto inline-flex min-h-12 w-full max-w-xl items-center gap-3 rounded-md border px-4 py-2 text-left text-sm sm:w-auto";

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-30 flex justify-center lg:bottom-6"
    >
      {nearby && hint?.actionable && (
        <button
          id={HINT_BUTTON_ID}
          type="button"
          onClick={() => onInteract(nearby)}
          className={`${box} font-semibold text-fg hover:bg-subtle`}
        >
          <kbd
            aria-hidden="true"
            className="inline-grid size-7 shrink-0 place-items-center rounded-sm border border-line-strong bg-subtle text-xs font-bold pointer-coarse:hidden"
          >
            E
          </kbd>
          {hint.text}
        </button>
      )}
      {hint && !hint.actionable && (
        <p className={`${box} font-medium text-fg-muted`}>{hint.text}</p>
      )}
    </div>
  );
}
