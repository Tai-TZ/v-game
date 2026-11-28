import { readFileSync } from "node:fs";
import path from "node:path";

import { Color, Vector3, type BufferGeometry } from "three";
import { describe, expect, it } from "vitest";

import { parseThemeIndex, parseThemeManifest } from "~/features/theme/schema";

import { light, shade } from "./palette";
import { box, chamferBox, part, triangleCount } from "./primitives";

const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

const THEMES_DIR = path.resolve(process.cwd(), "public", "themes");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const manifests = parseThemeIndex(readJson(path.join(THEMES_DIR, "index.json"))).map((t) =>
  parseThemeManifest(readJson(path.join(THEMES_DIR, t.id, "manifest.json"))),
);

/** Every triangle of a non-indexed geometry: face normal from the winding, and its colour. */
function triangles(geometry: BufferGeometry) {
  const position = geometry.getAttribute("position");
  const coloured = geometry.hasAttribute("color");
  return Array.from({ length: position.count / 3 }, (_, t) => {
    const [a, b, c] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(position, 3 * t + k));
    if (!a || !b || !c) throw new Error("short triangle");
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const centre = a.clone().add(b).add(c).divideScalar(3);
    return {
      normal,
      centre,
      colour: coloured
        ? new Color().fromBufferAttribute(geometry.getAttribute("color"), 3 * t)
        : new Color(),
    };
  });
}

describe("chamferBox", () => {
  it("has 44 triangles and the box's outer bounds", () => {
    const chamfer = chamferBox(-1, 2, 0.5, 3, -4, -1.5);
    const plain = box(-1, 2, 0.5, 3, -4, -1.5);
    expect(chamfer.index).toBeNull();
    expect(triangleCount(chamfer)).toBe(44);
    chamfer.computeBoundingBox();
    plain.computeBoundingBox();
    expect(chamfer.boundingBox?.min.toArray()).toEqual(plain.boundingBox?.min.toArray());
    expect(chamfer.boundingBox?.max.toArray()).toEqual(plain.boundingBox?.max.toArray());
  });

  it("is closed and faces outwards, with a flat unbevelled bottom", () => {
    const geometry = chamferBox(0, 2, 0, 1, 0, 3);
    const centre = new Vector3(1, 0.5, 1.5);
    const all = triangles(geometry);
    for (const t of all) {
      expect(t.normal.dot(t.centre.clone().sub(centre))).toBeGreaterThan(0);
    }
    const down = all.filter((t) => t.normal.y < -0.99);
    expect(down.every((t) => t.centre.y === 0)).toBe(true);
    // Watertight: every edge is shared by exactly two triangles.
    const position = geometry.getAttribute("position");
    const key = (i: number) =>
      [position.getX(i), position.getY(i), position.getZ(i)].map((n) => n.toFixed(5)).join();
    const edges = new Map<string, number>();
    for (let t = 0; t < position.count; t += 3) {
      for (const [a, b] of [
        [0, 1],
        [1, 2],
        [2, 0],
      ] as const) {
        const e = [key(t + a), key(t + b)].sort().join("|");
        edges.set(e, (edges.get(e) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
  });

  it.each(manifests.map((m) => [m.id, m] as const))(
    "a chamfer bakes between top and side, theme %s",
    (_id, manifest) => {
      const dayLight = light(manifest.campus.lights.day);
      const wall = new Color("#c9b99a");
      const baked = part(chamferBox(0, 2, 0, 1, 0, 3), { color: wall }, dayLight);
      const all = triangles(baked);
      const top = all.find((t) => t.normal.y > 0.99);
      const side = all.find((t) => t.normal.x > 0.99);
      const bevels = all.filter((t) => t.normal.y > 0.5 && t.normal.y < 0.9 && t.normal.x > 0.5);
      expect(top).toBeDefined();
      expect(side).toBeDefined();
      expect(bevels.length).toBeGreaterThan(0);
      if (!top || !side) return;
      // The top face is still exactly the manifest colour.
      for (const [got, want] of [
        [top.colour.r, wall.r],
        [top.colour.g, wall.g],
        [top.colour.b, wall.b],
      ] as const) {
        expect(Math.abs(Math.round(got * 255) - Math.round(want * 255))).toBeLessThanOrEqual(1);
      }
      for (const bevel of bevels) {
        expect(luminance(bevel.colour)).toBeLessThan(luminance(top.colour));
        expect(luminance(bevel.colour)).toBeGreaterThan(luminance(side.colour));
      }
      // The bake agrees with shade() at the bevel's own normal.
      const first = bevels[0];
      if (first) {
        const want = wall.clone().multiply(shade(first.normal, dayLight));
        expect(luminance(first.colour)).toBeCloseTo(luminance(want), 4);
      }
    },
  );
});
