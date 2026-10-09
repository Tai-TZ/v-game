import { useLayoutEffect } from "react";

import type { Place } from "~/features/theme/schema";

import { forecastUrl, parseForecast, phaseAt, readDisplay } from "./sky";
import { hubStore } from "./store";

const PHASE_EVERY_MS = 60_000;
/** After a good reply; Open-Meteo's current values move every 15 min. */
export const WEATHER_EVERY_MS = 30 * 60_000;
/** After a failure (a 429, the network, a bad reply). */
export const WEATHER_RETRY_MS = 2 * 60_000;
/**
 * A request still open after this counts as a failure, so a hung one cannot stop the schedule.
 * Generous: a slow phone network still gets its answer (and e2e holds one until the scene rests).
 */
export const FETCH_TIMEOUT_MS = 60_000;

/**
 * Keeps the hub store's sky current (campus v0.4 W3): the phase from the sun at `place` every
 * minute and on return to the tab; the weather from Open-Meteo, straight from the browser, on
 * mount, then every 30 min (2 min after a failure), only while the tab is visible. Every failure
 * is silent: weather is decoration.
 * Call once, from the /play route.
 */
export function useSkyClock(place: Pick<Place, "lat" | "lon">) {
  const { lat, lon } = place;
  // Before the first paint, so the sky never shows day for a frame at night.
  useLayoutEffect(() => {
    // The theme bootstrap's pre-hydration hint; <main data-sky> carries the exact phase now.
    delete document.documentElement.dataset.sky;
    const store = hubStore.getState();
    const tick = () => store.setPhase(phaseAt(Date.now(), { lat, lon }));
    store.setDisplay(readDisplay());
    tick();
    const clock = window.setInterval(tick, PHASE_EVERY_MS);

    let controller: AbortController | null = null;
    let timer: number | undefined;
    let stopped = false;
    /** A fetch fell due while the tab was hidden: it runs when the tab shows again. */
    let due = false;
    const visible = () => document.visibilityState === "visible";
    const later = (ms: number) => {
      timer = window.setTimeout(fetchWeather, ms);
    };
    function fetchWeather() {
      if (!visible()) {
        due = true;
        return;
      }
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), FETCH_TIMEOUT_MS);
      // No referrer: Open-Meteo sees the visitor's IP and our origin (CORS Origin header), never the page path.
      void fetch(forecastUrl({ lat, lon }), {
        signal: request.signal,
        referrerPolicy: "no-referrer",
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((json: unknown) => parseForecast(json, Date.now()))
        .catch(() => null)
        .then((weather) => {
          window.clearTimeout(timeout);
          if (stopped) return;
          store.setWeather(weather);
          later(weather ? WEATHER_EVERY_MS : WEATHER_RETRY_MS);
        });
    }
    const onVisibility = () => {
      if (!visible()) return;
      tick();
      if (due) {
        due = false;
        fetchWeather();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    fetchWeather();
    return () => {
      stopped = true;
      window.clearInterval(clock);
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lat, lon]);
}
