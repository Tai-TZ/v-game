import * as v from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BAKE,
  CONDITION_TEXT,
  CONDITIONS,
  clockText,
  partOfDay,
  phaseAt,
  readDisplay,
  sceneLook,
  sunElevation,
  WeatherSchema,
  writeDisplay,
} from "./sky";

const HANOI = { name: "Hà Nội", lat: 21.0285, lon: 105.8542, timeZone: "Asia/Ho_Chi_Minh" };
/** Hanoi has no daylight saving: +07:00 all year. */
const at = (day: string, hm: string) => Date.parse(`${day}T${hm}:00+07:00`);
const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));

/** Sunrise and sunset (sun centre at −0.833°) of a Hanoi day, as minutes after midnight. */
function sunTimes(day: string): [number, number] {
  const start = at(day, "00:00");
  let rise = 0;
  let set = 0;
  for (let m = 0; m < 1440; m += 1) {
    const a = sunElevation(start + m * 60_000, HANOI.lat, HANOI.lon);
    const b = sunElevation(start + (m + 1) * 60_000, HANOI.lat, HANOI.lon);
    if (a < -0.833 && b >= -0.833) rise = m + 1;
    if (a >= -0.833 && b < -0.833) set = m + 1;
  }
  return [rise, set];
}

describe("sun and phase at the theme's place (weather-data §7, campus v0.4 W3)", () => {
  // Open-Meteo's sunrise/sunset for Hanoi on the 15th of each month of 2025, and 2026-10-08.
  const REFERENCE = [
    ["2025-01-15", "06:35", "17:35"],
    ["2025-02-15", "06:26", "17:54"],
    ["2025-03-15", "06:05", "18:05"],
    ["2025-04-15", "05:37", "18:15"],
    ["2025-05-15", "05:18", "18:27"],
    ["2025-06-15", "05:14", "18:39"],
    ["2025-07-15", "05:23", "18:41"],
    ["2025-08-15", "05:35", "18:26"],
    ["2025-09-15", "05:43", "17:59"],
    ["2025-10-15", "05:51", "17:32"],
    ["2025-11-15", "06:06", "17:15"],
    ["2025-12-15", "06:25", "17:17"],
    ["2026-10-08", "05:49", "17:38"],
  ] as const;

  it.each(REFERENCE)("puts sunrise and sunset within 3 min of Open-Meteo on %s", (day, r, s) => {
    const [rise, set] = sunTimes(day);
    expect(Math.abs(rise - minutes(r))).toBeLessThanOrEqual(3);
    expect(Math.abs(set - minutes(s))).toBeLessThanOrEqual(3);
  });

  it("runs night, dawn, day, dusk, night through a day, each twilight about an hour", () => {
    const runs: { phase: string; from: number }[] = [];
    for (let m = 0; m < 1440; m += 1) {
      const phase = phaseAt(at("2026-10-08", "00:00") + m * 60_000, HANOI);
      if (runs.at(-1)?.phase !== phase) runs.push({ phase, from: m });
    }
    expect(runs.map((run) => run.phase)).toEqual(["night", "dawn", "day", "dusk", "night"]);
    for (const i of [1, 3]) {
      const length = (runs[i + 1]?.from ?? 0) - (runs[i]?.from ?? 0);
      expect(length).toBeGreaterThanOrEqual(45);
      expect(length).toBeLessThanOrEqual(65);
    }
  });

  it("flips at the sun-altitude edges (±6°) around sunrise and sunset, to the minute", () => {
    // weather-time-visuals §1.1, 2026-10-08: dawn 05:28, day 06:20, dusk 17:09, night 18:01.
    const phase = (hm: string) => phaseAt(at("2026-10-08", hm), HANOI);
    expect([phase("05:25"), phase("05:31")]).toEqual(["night", "dawn"]);
    expect([phase("06:17"), phase("06:23")]).toEqual(["dawn", "day"]);
    expect([phase("17:06"), phase("17:12")]).toEqual(["day", "dusk"]);
    expect([phase("17:58"), phase("18:04")]).toEqual(["dusk", "night"]);
  });

  it("names the part of day in the place's zone, whatever the machine's zone", () => {
    vi.stubEnv("TZ", "America/New_York");
    const label = (hm: string) => {
      const ms = at("2026-10-08", hm);
      return partOfDay(phaseAt(ms, HANOI), ms, HANOI.timeZone);
    };
    expect(
      ["04:30", "05:40", "10:59", "11:00", "13:00", "17:30", "19:00", "21:59", "22:00"].map(label),
    ).toEqual(["Đêm", "Bình minh", "Sáng", "Trưa", "Chiều", "Hoàng hôn", "Tối", "Tối", "Đêm"]);
    expect(clockText(at("2026-10-08", "07:05"), HANOI.timeZone)).toBe("07:05");
    expect(clockText(Date.parse("2026-10-08T16:30:00Z"), HANOI.timeZone)).toBe("23:30");
    vi.unstubAllEnvs();
  });
});

describe("weather groups", () => {
  it("names and bakes all seven groups, rain and storm alike, cloud and fog alike", () => {
    expect(Object.keys(CONDITION_TEXT)).toEqual([...CONDITIONS]);
    expect(Object.values(CONDITION_TEXT)).toEqual([
      "Trời quang",
      "Ít mây",
      "Nhiều mây",
      "Sương mù",
      "Mưa phùn",
      "Mưa",
      "Mưa dông",
    ]);
    expect(BAKE).toEqual({
      clear: "clear",
      partly_cloudy: "partly",
      cloudy: "overcast",
      fog: "overcast",
      drizzle: "damp",
      rain: "wet",
      thunderstorm: "wet",
    });
  });

  it("reads the API body and nothing else", () => {
    const body = { condition: "drizzle", temperature_c: 26.6, updated_at: "2026-10-08T16:30:00Z" };
    expect(v.parse(WeatherSchema, body)).toEqual(body);
    expect(v.safeParse(WeatherSchema, { ...body, condition: "snow" }).success).toBe(false);
    expect(v.safeParse(WeatherSchema, { ...body, updated_at: "yesterday" }).success).toBe(false);
  });
});

describe("scene look", () => {
  it("keeps the fixed daytime look whatever the hour and weather", () => {
    expect(sceneLook("day", "night", "thunderstorm")).toEqual({
      sky: "day",
      weather: "clear",
      bake: "clear",
      clouds: "none",
    });
  });

  it("shows the phase's clear look without data, and the weather on top with it", () => {
    expect(sceneLook("live", "night", null)).toEqual({
      sky: "night",
      weather: "clear",
      bake: "clear",
      clouds: "none",
    });
    expect(sceneLook("live", "dusk", "thunderstorm")).toEqual({
      sky: "dusk",
      weather: "thunderstorm",
      bake: "wet",
      clouds: "full",
    });
    expect(sceneLook("live", "day", "partly_cloudy").clouds).toBe("some");
  });
});

describe("display mode storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("defaults to live and keeps the choice per device", () => {
    expect(readDisplay()).toBe("live");
    writeDisplay("day");
    expect(localStorage.getItem("vg-hub-display")).toBe("day");
    expect(readDisplay()).toBe("day");
    localStorage.setItem("vg-hub-display", "sepia");
    expect(readDisplay()).toBe("live");
  });

  it("never throws when storage does", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readDisplay()).toBe("live");
    expect(() => writeDisplay("day")).not.toThrow();
  });
});
