import * as v from "valibot";

import type { Place, TimeOfDay } from "~/features/theme/schema";

/*
 * The hub's sky (campus v0.4 "Thời tiết và giờ thật"): the phase of the day from the sun at the
 * theme's place and the visitor's clock (one source, no network, right while the API sleeps),
 * plus today's weather from GET /api/weather on top. Pure; no three.js.
 */

export type Phase = TimeOfDay;

const RAD = Math.PI / 180;

/** Sun elevation (degrees) at (lat, lon) at `ms` (epoch, UTC); NOAA/USNO short form, ± minutes. */
export function sunElevation(ms: number, lat: number, lon: number): number {
  const d = ms / 86_400_000 - 10_957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const l = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(l));
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
  const ha = (280.46061837 + 360.98564736629 * d + lon) * RAD - ra;
  return (
    Math.asin(
      Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha),
    ) / RAD
  );
}

/** Day from 6° up, night below −6° (end of civil twilight); between, dawn while the sun rises. */
export function phaseAt(ms: number, place: Pick<Place, "lat" | "lon">): Phase {
  const h = sunElevation(ms, place.lat, place.lon);
  if (h >= 6) return "day";
  if (h < -6) return "night";
  return sunElevation(ms + 600_000, place.lat, place.lon) > h ? "dawn" : "dusk";
}

const hourIn = (ms: number, timeZone: string) =>
  Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(ms),
  );

/** "HH:mm" in the place's zone (the chip's popover). */
export const clockText = (ms: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(ms);

/** The Vietnamese name of the part of day, in the place's zone (weather-time-visuals §1.1). */
export function partOfDay(phase: Phase, ms: number, timeZone: string): string {
  if (phase === "dawn") return "Bình minh";
  if (phase === "dusk") return "Hoàng hôn";
  const hour = hourIn(ms, timeZone);
  if (phase === "night") return hour >= 12 && hour < 22 ? "Tối" : "Đêm";
  return hour < 11 ? "Sáng" : hour < 13 ? "Trưa" : "Chiều";
}

/** The API's seven groups (backend routes/weather.py WMO_GROUP). */
export const CONDITIONS = [
  "clear",
  "partly_cloudy",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "thunderstorm",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_TEXT: Record<Condition, string> = {
  clear: "Trời quang",
  partly_cloudy: "Ít mây",
  cloudy: "Nhiều mây",
  fog: "Sương mù",
  drizzle: "Mưa phùn",
  rain: "Mưa",
  thunderstorm: "Mưa dông",
};

/** Five baked looks: rain ↔ storm and cloud ↔ fog differ only in the CSS overlay, no re-bake. */
export type Bake = "clear" | "partly" | "overcast" | "damp" | "wet";
export const BAKE: Record<Condition, Bake> = {
  clear: "clear",
  partly_cloudy: "partly",
  cloudy: "overcast",
  fog: "overcast",
  drizzle: "damp",
  rain: "wet",
  thunderstorm: "wet",
};

export const WeatherSchema = v.object({
  condition: v.picklist(CONDITIONS),
  temperature_c: v.number(),
  updated_at: v.pipe(v.string(), v.isoTimestamp()),
});
export type Weather = v.InferOutput<typeof WeatherSchema>;

/** "live": the real hour and weather. "day": the fixed daytime look (projectors; WCAG 2.2.2). */
export type Display = "live" | "day";
export type Clouds = "none" | "some" | "full";

/** What the scene, the sky and the overlays draw. */
export interface SceneLook {
  sky: Phase;
  weather: Condition;
  bake: Bake;
  clouds: Clouds;
}

/** The fixed look; with no data yet, the phase's clear look (weather is decoration). */
export function sceneLook(display: Display, phase: Phase, condition: Condition | null): SceneLook {
  const weather = display === "day" ? "clear" : (condition ?? "clear");
  return {
    sky: display === "day" ? "day" : phase,
    weather,
    bake: BAKE[weather],
    clouds: weather === "clear" ? "none" : weather === "partly_cloudy" ? "some" : "full",
  };
}

const DISPLAY_KEY = "vg-hub-display";

/** The saved display mode; anything unreadable is "live". */
export function readDisplay(): Display {
  try {
    return localStorage.getItem(DISPLAY_KEY) === "day" ? "day" : "live";
  } catch {
    return "live";
  }
}

export function writeDisplay(display: Display): void {
  try {
    localStorage.setItem(DISPLAY_KEY, display);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}
