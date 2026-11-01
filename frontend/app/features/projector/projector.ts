import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";

/**
 * Projector mode (roadmap-v0.4 B7, lesson-plan appendix R1-R10): `?chieu=1` on a zone page or a
 * level. Read from the URL every time and never stored, so the next visit opens normally (R1).
 */
export const PROJECTOR_PARAM = "chieu";

/** On `<html>`: app.css scales the root font size and stops looping animations from it (R2, R7). */
export const PROJECTOR_CLASS = "chieu";

/** The projector's own pool of fresh AI calls a day; no pair's pool pays for it (R5). */
export const PROJECTOR_SHARE = 40;

export function useProjector(): { on: boolean; exit: () => void } {
  const [params, setParams] = useSearchParams();
  const on = params.get(PROJECTOR_PARAM) === "1";
  const exit = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(PROJECTOR_PARAM);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setParams]);
  return { on, exit };
}

/** Puts the class on `<html>` while the mode is on; leaving the page or the mode takes it off. */
export function useProjectorClass(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.classList.add(PROJECTOR_CLASS);
    return () => root.classList.remove(PROJECTOR_CLASS);
  }, [on]);
}
