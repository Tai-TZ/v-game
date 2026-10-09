import { readFileSync } from "node:fs";
import path from "node:path";

import type { BufferGeometry } from "three";
import { describe, expect, it } from "vitest";

import { parseThemeIndex, parseThemeManifest, type ThemeManifest } from "~/features/theme/schema";

import { BACK, BASE, SITES, SPAWN, TREES, type Box } from "../layout";
import {
  buildLandmark,
  buildLibrary,
  buildMarket,
  buildWatchtower,
  entranceLampSpots,
} from "../scene/campus";
import { palette } from "../scene/palette";
import {
  blueprintPieces,
  blueprintViewBox,
  buildingStacks,
  entryFocus,
  MIRROR,
  SHELL_VIEWBOX,
  type Mass,
  type Piece,
} from "./blueprint";

const THEMES_DIR = path.resolve(process.cwd(), "public", "themes");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const manifests: ThemeManifest[] = parseThemeIndex(
  readJson(path.join(THEMES_DIR, "index.json")),
).map(({ id }) => parseThemeManifest(readJson(path.join(THEMES_DIR, id, "manifest.json"))));

type Bounds = [number, number, number, number, number, number];
const EMPTY: Bounds = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
const grow = (b: Bounds, x: number, y: number, z: number): Bounds => [
  Math.min(b[0], x),
  Math.max(b[1], x),
  Math.min(b[2], y),
  Math.max(b[3], y),
  Math.min(b[4], z),
  Math.max(b[5], z),
];
const massBounds = (masses: readonly Mass[], start = EMPTY) =>
  masses.reduce<Bounds>(
    (b, { box: [x0, x1, y0, y1, z0, z1] }) => grow(grow(b, x0, y0, z0), x1, y1, z1),
    start,
  );
/** Bounds of the vertices of a built geometry that pass `keep`. */
function geometryBounds(
  geometry: BufferGeometry,
  keep: (x: number, y: number, z: number) => boolean,
) {
  const position = geometry.getAttribute("position");
  let b = EMPTY;
  for (let i = 0; i < position.count; i += 1) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    if (keep(x, y, z)) b = grow(b, x, y, z);
  }
  return b;
}
const expectClose = (
  actual: Bounds,
  expected: Bounds,
  label: string,
  axes = [0, 1, 2, 3, 4, 5],
) => {
  for (const k of axes) {
    expect(
      Math.abs((actual[k] ?? 0) - (expected[k] ?? 0)),
      `${label} bound ${k}`,
    ).toBeLessThanOrEqual(0.15);
  }
};
/**
 * Keeps a zone building's vertices, not its entrance lamps (the blueprint draws no lamps): the
 * post (r 0.055) below 1.6, the head and cap (r ≤ 0.17) above. The market's side roof has a
 * corner 0.15 from a lamp, so the radius splits by height.
 */
const noLamps = (id: Parameters<typeof entranceLampSpots>[0]) => {
  const spots = entranceLampSpots(id);
  return (x: number, y: number, z: number) =>
    spots.every((spot) => Math.hypot(x - spot.x, z - spot.z) > (y < 1.59 ? 0.06 : 0.18));
};
const fromBox = (f: Box) => [f.x - f.halfX, f.x + f.halfX, f.z - f.halfZ, f.z + f.halfZ];

describe("blueprintViewBox (alignment with the first 3D frame, spec §4.2)", () => {
  const parse = (box: string) => box.split(" ").map(Number);

  it("matches the 1280×800 overview", () => {
    // Overview: the width-limited fit of ORBIT_FRAME (45.88 wide), centred 0.24 below PIVOT.
    const zoom = (1280 - 48) / 45.88;
    const [cx, cy] = [4.45 / Math.SQRT2, 4.45 / Math.sqrt(6) - 0.24];
    const expected = [cx - 640 / zoom, -cy - 400 / zoom, 1280 / zoom, 800 / zoom];
    parse(blueprintViewBox(1280, 800, SPAWN)).forEach((n, i) =>
      expect(n).toBeCloseTo(expected[i] ?? 0, 3),
    );
    expect(parse(blueprintViewBox(1280, 800, SPAWN))).toEqual([-20.687, -16.473, 47.668, 29.792]);
  });

  it("matches the 375×812 follow view, clamped at the model's front edge", () => {
    expect(parse(blueprintViewBox(375, 812, SPAWN))).toEqual([-5.721, -15.181, 12.573, 27.224]);
  });

  it("frames the pre-rendered board like the overview: ORBIT_FRAME round PIVOT", () => {
    expect(parse(SHELL_VIEWBOX)).toEqual([-19.793, -15.237, 45.88, 27.32]);
  });

  it("centres on the door the player returns to", () => {
    expect(entryFocus("?at=library")).not.toEqual(SPAWN);
    expect(entryFocus("?at=nowhere")).toEqual(SPAWN);
  });
});

describe("blueprintPieces", () => {
  for (const manifest of manifests) {
    const { landmark } = manifest.campus;
    const pieces = blueprintPieces(landmark, SPAWN);

    describe(`for the ${landmark.archetype} landmark`, () => {
      it("draws the board on BASE and one piece per tree", () => {
        const board = pieces[0]?.shapes.find((shape) => shape.attrs["data-bp"] === "board");
        expect(board?.attrs.points).toBe(
          [
            [BASE.minX, BASE.minZ],
            [BASE.maxX, BASE.minZ],
            [BASE.maxX, BASE.maxZ],
            [BASE.minX, BASE.maxZ],
          ]
            .map(
              ([x = 0, z = 0]) =>
                `${+((x - z) / Math.SQRT2).toFixed(3)},${+((x + z) / Math.sqrt(6)).toFixed(3)}`,
            )
            .join(" "),
        );
        expect(pieces.filter((p) => p.kind === "tree")).toHaveLength(TREES.length);
      });

      it("stands every zone and back building on its layout footprint", () => {
        const stacks = buildingStacks(landmark);
        for (const [i, site] of SITES.entries()) {
          const stack = stacks.find(
            ({ masses }) => masses === [MIRROR.library, MIRROR.watchtower, MIRROR.market][i],
          );
          const [x0, x1, , , z0, z1] = stack?.masses[0]?.box ?? [];
          expect([x0, x1, z0, z1]).toEqual(fromBox(site.footprint));
        }
        for (const f of Object.values(BACK)) {
          const stack = stacks.find(({ masses }) => {
            const [x0, x1, , , z0, z1] = masses[0]?.box ?? [];
            return [x0, x1, z0, z1].every((n, k) => n === fromBox(f)[k]);
          });
          expect(stack, JSON.stringify(f)).toBeDefined();
        }
      });

      it("mirrors the real building masses within 0.15 units", () => {
        const pal = palette(manifest.campus);
        const stacks = buildingStacks(landmark);
        const real = buildLandmark(pal, landmark.archetype, landmark.colonnades);
        // The main building and its tower: everything of the landmark behind the lawn (z < 0).
        const front = stacks.filter(({ at }) => at === 0.86).flatMap(({ masses }) => masses);
        expectClose(
          massBounds(front),
          geometryBounds(real, (_x, _y, z) => z < 0),
          "landmark",
        );
        // The gate, without its fence and column plinths (both low, left out of the mirror).
        const gate = stacks.filter(({ at }) => at === 0.92).flatMap(({ masses }) => masses);
        const realGate = geometryBounds(real, (x, y, z) => z > 11 && Math.abs(x) < 3 && y > 0.35);
        expectClose(massBounds(gate), realGate, "gate", [0, 1, 3, 4, 5]);

        expectClose(
          massBounds(MIRROR.library),
          geometryBounds(buildLibrary(pal, "open"), noLamps("library")),
          "library",
        );
        expectClose(
          massBounds(MIRROR.watchtower),
          geometryBounds(buildWatchtower(pal, "open"), noLamps("watchtower")),
          "watchtower",
        );
        const { y, north, south, east } = MIRROR.awnings;
        const awnings: Mass[] = [
          { role: "mk", box: [north[0], north[1], y[1], y[0], north[2], north[3]] },
          { role: "mk", box: [south[0], south[1], y[1], y[0], south[2], south[3]] },
          { role: "mk", box: [east[0], east[1], y[1], y[0], east[2], east[3]] },
        ];
        expectClose(
          massBounds([...MIRROR.market, ...awnings]),
          geometryBounds(buildMarket(pal, "open"), noLamps("market")),
          "market",
        );
      });

      it("paints nothing behind a piece after it", () => {
        const stand = pieces.filter(
          (p): p is Piece & { fp: NonNullable<Piece["fp"]> } => p.fp !== undefined,
        );
        const span = (f: readonly number[]) => [
          ((f[0] ?? 0) - (f[3] ?? 0)) / Math.SQRT2,
          ((f[1] ?? 0) - (f[2] ?? 0)) / Math.SQRT2,
        ];
        const behind = (a: readonly number[], b: readonly number[]) =>
          (a[1] ?? 0) <= (b[0] ?? 0) + 1e-6 || (a[3] ?? 0) <= (b[2] ?? 0) + 1e-6;
        stand.forEach((a, i) =>
          stand.slice(i + 1).forEach((b) => {
            const [a0 = 0, a1 = 0] = span(a.fp);
            const [b0 = 0, b1 = 0] = span(b.fp);
            if (a1 <= b0 || b1 <= a0) return;
            expect(
              behind(b.fp, a.fp) && !behind(a.fp, b.fp),
              `${a.kind} ${a.fp.join()} / ${b.kind} ${b.fp.join()}`,
            ).toBe(false);
          }),
        );
      });
    });
  }
});

describe("loader modules", () => {
  it("never import three.js, r3f or the scene chunk", () => {
    for (const file of ["sceneLoad.ts", "blueprint.ts", "SceneLoader.tsx"]) {
      const source = readFileSync(
        path.resolve(process.cwd(), "app", "features", "campus", "hud", file),
        "utf8",
      );
      expect(source, file).not.toMatch(/from "three"|@react-three|\/scene\//);
    }
  });
});
