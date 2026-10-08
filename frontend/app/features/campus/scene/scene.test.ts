import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { renderHook } from "@testing-library/react";
import { Vector3, type Color } from "three";
import { describe, expect, it } from "vitest";

import { parseThemeIndex, parseThemeManifest, type ThemeManifest } from "~/features/theme/schema";

import { CONTENT, toScreen } from "../camera";
import { desaturate, palette, shade } from "./palette";
import { triangleCount } from "./primitives";
import { sceneBudget, useCampusGeometry, type CampusGeometry } from "./useCampusGeometry";

const THEMES_DIR = path.resolve(process.cwd(), "public", "themes");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const themeIds = parseThemeIndex(readJson(path.join(THEMES_DIR, "index.json"))).map((t) => t.id);
const manifests: ThemeManifest[] = themeIds.map((id) =>
  parseThemeManifest(readJson(path.join(THEMES_DIR, id, "manifest.json"))),
);

function build(manifest: ThemeManifest) {
  return renderHook(
    ({ campus }) => useCampusGeometry(campus, "open", "coming_soon", "coming_soon"),
    { initialProps: { campus: manifest.campus } },
  );
}

const geometries = (g: CampusGeometry) => [
  g.terrain,
  g.landmark,
  g.library,
  g.watchtower,
  g.market,
  g.roundTree,
  g.cypress,
  g.player,
  g.lan,
];

describe("theme manifests", () => {
  it("parse with the schema and declare both landmark archetypes", () => {
    expect(manifests.length).toBeGreaterThanOrEqual(2);
    const archetypes = new Set(manifests.map((m) => m.campus.landmark.archetype));
    expect(archetypes).toEqual(new Set(["spire-hall", "clock-tower"]));
  });
});

describe("baked lighting (art §2.3)", () => {
  it("gives top, left and right faces 1.0, 0.8 and 0.6", () => {
    expect(shade(new Vector3(0, 1, 0))).toBeCloseTo(1, 2);
    expect(shade(new Vector3(0, 0, 1))).toBeCloseTo(0.8, 2);
    expect(shade(new Vector3(1, 0, 0))).toBeCloseTo(0.6, 2);
  });

  it("derives colours by the art §2.2 formulas", () => {
    const campus = manifests.find((m) => m.campus.landmark.archetype === "spire-hall")?.campus;
    expect(campus).toBeDefined();
    if (!campus) return;
    const pal = palette(campus);
    const hex = (c: Color) => parseInt(c.getHexString(), 16);
    const near = (actual: Color, expected: string) => {
      const a = hex(actual);
      const e = parseInt(expected.slice(1), 16);
      for (const shift of [16, 8, 0]) {
        expect(Math.abs(((a >> shift) & 255) - ((e >> shift) & 255))).toBeLessThanOrEqual(1);
      }
    };
    near(pal.soil, "#74895b");
    near(pal.lit, "#ddba8b");
    near(pal.xray, "#b3baca");
    near(desaturate(pal.wt.roof), "#222936");
  });
});

describe.each(manifests.map((m) => [m.id, m] as const))(
  "scene budget, theme %s",
  (_id, manifest) => {
    it("stays well inside 40 draw calls and 60k triangles (target 13 / ≈14.8k)", () => {
      const { result, unmount } = build(manifest);
      const budget = sceneBudget(result.current);
      expect(budget.drawCalls).toBeLessThanOrEqual(16);
      expect(budget.triangles).toBeLessThanOrEqual(20_000);
      unmount();
    });

    it("keeps the landmark and terrain under the top of the camera framing", () => {
      const { result, unmount } = build(manifest);
      for (const geometry of [result.current.landmark, result.current.terrain]) {
        const position = geometry.getAttribute("position");
        let top = -Infinity;
        for (let i = 0; i < position.count; i += 1) {
          const { x, y, z } = { x: position.getX(i), y: position.getY(i), z: position.getZ(i) };
          top = Math.max(top, toScreen(x, y, z).sy);
        }
        expect(top).toBeLessThanOrEqual(CONTENT.maxY);
      }
      unmount();
    });

    it("bakes only position and colour into static groups", () => {
      const { result, unmount } = build(manifest);
      const names = Object.keys(result.current.terrain.attributes).sort();
      expect(names).toEqual(["color", "position"]);
      unmount();
    });
  },
);

describe("switching theme", () => {
  const [first, second] = manifests;

  it("changes colours and the landmark, and disposes every old geometry", () => {
    if (!first || !second) throw new Error("Need two themes.");
    const { result, rerender, unmount } = build(first);
    const before = result.current;
    const disposed = new Set<unknown>();
    for (const geometry of geometries(before)) {
      geometry.addEventListener("dispose", () => disposed.add(geometry));
    }

    rerender({ campus: second.campus });
    const after = result.current;

    expect(after.palette.ground.equals(before.palette.ground)).toBe(false);
    expect(triangleCount(after.landmark)).not.toBe(triangleCount(before.landmark));
    for (const geometry of geometries(before)) expect(disposed.has(geometry)).toBe(true);
    unmount();
  });

  it("rebuilds only the building whose status changed", () => {
    if (!first) throw new Error("Need a theme.");
    const { result, rerender, unmount } = renderHook(
      ({ market }) => useCampusGeometry(first.campus, "open", "coming_soon", market),
      { initialProps: { market: "coming_soon" as "open" | "coming_soon" } },
    );
    const before = result.current;
    rerender({ market: "open" });
    expect(result.current.market).not.toBe(before.market);
    expect(result.current.library).toBe(before.library);
    expect(result.current.terrain).toBe(before.terrain);
    unmount();
  });
});

describe("render budget rules", () => {
  it("uses no shadow maps or post-processing anywhere in the campus feature", () => {
    const root = path.resolve(process.cwd(), "app", "features", "campus");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !name.includes(".test.")) files.push(full);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /castShadow|receiveShadow|\bshadows\b|EffectComposer|postprocessing/,
      );
    }
  });
});
