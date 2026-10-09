import * as v from "valibot";

import type { Place, TimeOfDay } from "~/features/theme/schema";

/*
 * The hub's sky (campus v0.4 "Thời tiết và giờ thật"): the phase of the day from the sun at the
 * theme's place and the visitor's clock (one source, no network, right while the API sleeps),
 * plus today's weather on top, which the browser fetches from Open-Meteo itself (Render's shared
 * IP is rate-limited there; each visitor's own IP is not). Pure; no three.js.
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

/** The seven weather groups (WMO_GROUP). */
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

/** Open-Meteo's WMO table (docs "WMO Weather interpretation codes"), all 29 codes. */
// ponytail: no snow group (lowland Hanoi); snow codes show as rain. Add "snow" with a snowy place.
// prettier-ignore
export const WMO_GROUP: Readonly<Partial<Record<number, Condition>>> = {
  0: "clear", 1: "clear",
  2: "partly_cloudy",
  3: "cloudy",
  45: "fog", 48: "fog",
  51: "drizzle", 53: "drizzle", 55: "drizzle", 56: "drizzle", 57: "drizzle",
  61: "rain", 63: "rain", 65: "rain", 66: "rain", 67: "rain", 80: "rain", 81: "rain", 82: "rain",
  71: "rain", 73: "rain", 75: "rain", 77: "rain", 85: "rain", 86: "rain",
  95: "thunderstorm", 96: "thunderstorm", 97: "thunderstorm", 99: "thunderstorm",
};

/** What the chip and the scene read: the group, °C to 0.1, and when the values are valid (UTC). */
export interface Weather {
  condition: Condition;
  temperature_c: number;
  updated_at: string;
}

/**
 * The one request: 2 variables for 1 day (1 API call); 4 decimals (~11 m) keep the URL stable.
 * No `timezone`, so `current.time` is GMT without an offset.
 */
export function forecastUrl(place: Pick<Place, "lat" | "lon">): string {
  const query = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    current: "temperature_2m,weather_code",
    forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${query}`;
}

const ISO_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(Z|[+-]\d\d:\d\d)?$/;

/** The subset of Open-Meteo's reply we read, checked at the boundary. */
const ForecastSchema = v.object({
  current: v.object({
    time: v.pipe(v.string(), v.regex(ISO_TIME)),
    temperature_2m: v.pipe(v.number(), v.minValue(-90), v.maxValue(60)),
    weather_code: v.pipe(v.number(), v.integer()),
  }),
});

/** Served as "now", so it must be within 3 h of the visitor's clock. */
const MAX_SKEW_MS = 3 * 3_600_000;

/** Open-Meteo's reply as the hub's weather; null for anything off-contract or implausible. */
export function parseForecast(json: unknown, now: number): Weather | null {
  const result = v.safeParse(ForecastSchema, json);
  if (!result.success) return null;
  const { time, temperature_2m, weather_code } = result.output.current;
  // No offset means GMT (Date.parse would read it as local time); an offset is converted.
  const ms = Date.parse(ISO_TIME.exec(time)?.[1] ? time : `${time}Z`);
  if (!(Math.abs(now - ms) <= MAX_SKEW_MS)) return null; // NaN fails too
  return {
    condition: WMO_GROUP[weather_code] ?? "cloudy",
    temperature_c: Math.round(temperature_2m * 10) / 10,
    updated_at: new Date(ms).toISOString(),
  };
}

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
