import { readFileSync } from "node:fs";
import path from "node:path";

import { Color, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { parseThemeIndex, parseThemeManifest, type ThemeManifest } from "~/features/theme/schema";

import { DRESSING } from "../dressing";
import { BASE } from "../layout";
import { palette, shade } from "./palette";
import { triangleCount } from "./primitives";
import type { PropsJson } from "./props";
import { buildDressing, fetchProps, PROPS_URL } from "./useDressing";

const readJson = (...parts: string[]): unknown =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), "public", ...parts), "utf8"));
const text = readFileSync(path.resolve(process.cwd(), "public", "models", "props.json"), "utf8");
const json = JSON.parse(text) as PropsJson;
const manifests: ThemeManifest[] = parseThemeIndex(readJson("themes", "index.json")).map((t) =>
  parseThemeManifest(readJson("themes", t.id, "manifest.json")),
);

describe("fetchProps", () => {
  const answer = (body: unknown, ok = true) =>
    ((url: string) => {
      expect(url).toBe(PROPS_URL);
      return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
    }) as typeof fetch;

  it("parses the file", async () => {
    expect(await fetchProps(answer(json))).toEqual(json);
  });

  it("gives null on a network error, an HTTP error or a malformed file", async () => {
    const offline = (() => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
    expect(await fetchProps(offline)).toBeNull();
    expect(await fetchProps(answer(json, false))).toBeNull();
    expect(await fetchProps(answer({ version: 2 }))).toBeNull();
  });
});

/** One placed copy per entry, plus the back faces of the double-sided parasol (§2 B). */
const PLANNED = DRESSING.reduce((sum, row) => {
  const data = json.props[row.prop];
  return sum + ((data?.index.length ?? 0) / 3) * row.at.length * (data?.doubleSided ? 2 : 1);
}, 0);

describe.each(manifests.map((m) => [m.id, m] as const))("dressing mesh, theme %s", (_id, m) => {
  it.each(["day", "dusk"] as const)("bakes one position + colour geometry at %s", (time) => {
    const pal = palette(m.campus, time);
    const geometry = buildDressing(json, pal);
    // 7,914 planned triangles (§3) - the 384 of the dropped wall rocks + 288 back faces of the
    // three parasols.
    expect(PLANNED).toBe(7818);
    expect(triangleCount(geometry)).toBe(PLANNED);
    expect(Object.keys(geometry.attributes).sort()).toEqual(["color", "position"]);
    const color = geometry.getAttribute("color");
    for (let i = 0; i < color.count; i += 1)
      for (const c of [color.getX(i), color.getY(i), color.getZ(i)])
        expect(c >= 0 && c <= 1, `vertex ${i}`).toBe(true);
    geometry.dispose();
  });

  it("paints the hedge row with the theme's hedge green, lit like a top face", () => {
    const pal = palette(m.campus, "day");
    const geometry = buildDressing(json, pal);
    const lit = pal.hedge.clone().multiply(shade(new Vector3(0, 1, 0), pal.light));
    const position = geometry.getAttribute("position");
    const color = geometry.getAttribute("color");
    const c = new Color();
    let hits = 0;
    for (let i = 0; i < position.count; i += 1) {
      // The top of a fence-row bush: inside the front strip, highest band of the shrub.
      if (position.getZ(i) < 11.4 || position.getZ(i) > 12.3 || position.getY(i) < 0.5) continue;
      c.fromBufferAttribute(color, i);
      if (Math.abs(c.g - lit.g) < 0.02 && Math.abs(c.r - lit.r) < 0.02) hits += 1;
    }
    expect(hits).toBeGreaterThan(0);
    geometry.dispose();
  });

  it("keeps every vertex inside the slab corners' orbit ellipse and above the ground", () => {
    const geometry = buildDressing(json, palette(m.campus, "day"));
    const position = geometry.getAttribute("position");
    const zc = (BASE.minZ + BASE.maxZ) / 2;
    const reach = Math.hypot(BASE.maxX, BASE.maxZ - zc);
    let worst = Infinity;
    let below = 0;
    for (let i = 0; i < position.count; i += 1) {
      const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
      worst = Math.min(worst, reach - (Math.hypot(x, z - zc) + Math.SQRT2 * Math.max(0, y)));
      if (y < -0.01) below += 1;
    }
    expect(worst).toBeGreaterThan(0);
    expect(below).toBe(0);
    geometry.dispose();
  });
});

it("re-bakes, never repositions, across themes", () => {
  const [first, second] = manifests;
  if (!first || !second) throw new Error("Need two themes.");
  const a = buildDressing(json, palette(first.campus, "day"));
  const b = buildDressing(json, palette(second.campus, "dusk"));
  expect(b.getAttribute("position").array).toEqual(a.getAttribute("position").array);
  expect(b.getAttribute("color").array).not.toEqual(a.getAttribute("color").array);
});
