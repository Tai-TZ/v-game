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

/**
 * `to` with the mode carried along, for a link from a page in projector mode to another page that
 * honours it: a zone page, a level, a warm-up lesson (all under `/play/<zone>`). The hub at
 * `/play` draws the campus, not a page frame, so it gets no parameter: nothing there could show
 * the mode or leave it. Off, `to` comes back as it was -- a fresh visit never inherits it (R1).
 */
export function withProjector(to: string, on: boolean): string {
  if (!on || !to.startsWith("/play/")) return to;
  const url = new URL(to, "http://v-game.invalid");
  url.searchParams.set(PROJECTOR_PARAM, "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `withProjector` for the page on screen: read from its URL, like the mode itself. */
export function useProjectorHref(): (to: string) => string {
  const { on } = useProjector();
  return useCallback((to: string) => withProjector(to, on), [on]);
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
