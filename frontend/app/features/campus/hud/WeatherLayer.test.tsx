import { readFileSync } from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { parseThemeIndex } from "~/features/theme/schema";

import { CONDITIONS, sceneLook } from "../sky";
import { WeatherLayer } from "./WeatherLayer";

describe("WeatherLayer", () => {
  const layer = (condition: (typeof CONDITIONS)[number], display: "live" | "day" = "live") =>
    render(<WeatherLayer look={sceneLook(display, "night", condition)} />).container;

  it("draws rain, fog and storm only for their groups, one flash at most", () => {
    const drawn = Object.fromEntries(
      CONDITIONS.map((condition) => {
        const root = layer(condition);
        const parts = [...root.querySelectorAll(".weather-layer > *")].map(
          (el) => el.className + (el.hasAttribute("data-dense") ? "[dense]" : ""),
        );
        return [condition, parts.join(" ")];
      }),
    );
    expect(drawn).toEqual({
      clear: "",
      partly_cloudy: "",
      cloudy: "",
      fog: "weather-fog",
      drizzle: "weather-rain",
      rain: "weather-rain",
      thunderstorm: "weather-rain[dense] weather-storm weather-flash",
    });
    expect(layer("thunderstorm").querySelector(".weather-layer")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("draws nothing in the fixed daytime display", () => {
    expect(layer("thunderstorm", "day").innerHTML).toBe("");
  });
});

/*
 * The sky rules of app.css against every theme's tokens (weather-time-visuals §4.2): the focus
 * ring of the controls on the scene stays ≥ 3:1 (WCAG 1.4.11) on every sky it can sit on.
 */
describe.each(
  parseThemeIndex(
    JSON.parse(readFileSync(path.resolve(process.cwd(), "public", "themes", "index.json"), "utf8")),
  ).map(({ id }) => id),
)("sky contrast, theme %s", (id) => {
  const css = readFileSync(
    path.resolve(process.cwd(), "public", "themes", id, "theme.css"),
    "utf8",
  );
  const token = (name: string) => {
    const hex = new RegExp(`--vg-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
    if (!hex) throw new Error(`${id}: --vg-${name} missing`);
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  };
  /** color-mix(in srgb, a p, b). */
  const mix = (a: number[], p: number, b: number[]) =>
    a.map((c, i) => c * p + (b[i] ?? 0) * (1 - p));
  const luminance = (rgb: number[]) => {
    const [r = 0, g = 0, b = 0] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  const cloud = token("scene-cloud");
  const ink = token("ink");

  it("keeps the surface ring ≥ 3:1 on every night sky", () => {
    const night = token("scene-night");
    const cloudNight = token("scene-cloud-night");
    for (const sky of [night, mix(cloudNight, 0.3, night), cloudNight]) {
      expect(contrast(token("surface"), sky)).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the brand ring ≥ 3:1 on every other sky, storm shade included", () => {
    for (const phase of ["sky", "dawn", "dusk"]) {
      const clear = token(`scene-${phase}`);
      const full = phase === "sky" ? cloud : mix(cloud, 0.6, clear);
      for (const sky of [clear, mix(cloud, 0.3, clear), full, mix(ink, 0.1, full)]) {
        expect(contrast(token("brand"), sky), `${phase} ${sky.join()}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
