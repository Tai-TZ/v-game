import { useLayoutEffect } from "react";

import type { Place } from "~/features/theme/schema";
import { getJson } from "~/lib/api";

import { phaseAt, readDisplay, WeatherSchema } from "./sky";
import { hubStore } from "./store";

const PHASE_EVERY_MS = 60_000;
/** After a good reply; Open-Meteo's current values move every 15 min, the API caches 15 min. */
export const WEATHER_EVERY_MS = 30 * 60_000;
/** After a failure: the API's Retry-After (a Render wake takes about a minute). */
export const WEATHER_RETRY_MS = 2 * 60_000;

/**
 * Keeps the hub store's sky current (campus v0.4 W3): the phase from the sun at `place` every
 * minute and on return to the tab; the weather on mount, then every 30 min (2 min after a
 * failure), only while the tab is visible. Every failure is silent: weather is decoration.
 * Call once, from the /play route.
 */
export function useSkyClock(place: Pick<Place, "lat" | "lon">) {
  const { lat, lon } = place;
  // Before the first paint, so the sky never shows day for a frame at night.
  useLayoutEffect(() => {
    const store = hubStore.getState();
    const tick = () => store.setPhase(phaseAt(Date.now(), { lat, lon }));
    store.setDisplay(readDisplay());
    tick();
    const clock = window.setInterval(tick, PHASE_EVERY_MS);

    let controller: AbortController | null = null;
    let timer: number | undefined;
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
      getJson("/api/weather", WeatherSchema, request.signal).then(
        (weather) => {
          store.setWeather(weather);
          later(WEATHER_EVERY_MS);
        },
        () => {
          if (request.signal.aborted) return;
          store.setWeather(null);
          later(WEATHER_RETRY_MS);
        },
      );
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
      window.clearInterval(clock);
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lat, lon]);
}
