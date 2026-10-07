import {
  type BufferGeometry,
  type Color,
  ConeGeometry,
  CylinderGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";

import type { LandmarkArchetype } from "~/features/theme/schema";
import type { ZoneStatus } from "~/features/zones/schema";

import {
  arcPoint,
  COLONNADE_COLUMNS,
  COLONNADE_PIERS,
  LANDMARK,
  PLAZA,
  ROUND_TREES,
  SITES,
  TREES,
  WORLD_BOUNDS,
  type Box,
  type Vec2,
} from "../layout";
import { desaturate, type BuildingPalette, type Palette } from "./palette";
import {
  arch,
  arcSlab,
  box,
  circle,
  cone,
  cyl,
  disc,
  groundTriangles,
  ico,
  lathe,
  merge,
  onFace,
  part,
  quad,
  rect,
  ring,
  type PartStyle,
} from "./primitives";

/*
 * Procedural campus, built to campus-scene v0.2 §5 with the helpers of art-direction §5.0.
 * Each exported builder returns the merged geometry of one draw call. Coordinates are absolute
 * world units from layout.ts (D9).
 */

type Parts = BufferGeometry[];
const P = (
  geometry: BufferGeometry,
  color: PartStyle["color"],
  flags: Omit<PartStyle, "color"> = {},
) => part(geometry, { color, ...flags });

const PI = Math.PI;
const SIDES = [-1, 1] as const;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const grid = <T>(xs: readonly number[], ys: readonly number[], f: (x: number, y: number) => T) =>
  xs.flatMap((x) => ys.map((y) => f(x, y)));

// --- Trees (shared by the terrain contact discs and the instanced meshes) -------------------

const hash = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export interface TreeInstance {
  x: number;
  z: number;
  scale: number;
  scaleY: number;
  yaw: number;
  brightness: number;
  kind: "round" | "cypress";
}

export const TREE_INSTANCES: readonly TreeInstance[] = TREES.map((tree, i) => {
  const scale = 0.9 + 0.22 * hash(i, 0);
  return {
    x: tree.x,
    z: tree.z,
    scale,
    scaleY: scale * (0.95 + 0.2 * hash(i, 1)),
    yaw: 2 * PI * hash(i, 2),
    brightness: 0.9 + 0.18 * hash(i, 3),
    kind: i < ROUND_TREES.length ? "round" : "cypress",
  };
});

export function treeMatrix(tree: TreeInstance): Matrix4 {
  return new Matrix4().compose(
    new Vector3(tree.x, 0, tree.z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), tree.yaw),
    new Vector3(tree.scale, tree.scaleY, tree.scale),
  );
}

// --- Terrain, paths, plaza, fountain, lake, lamps (G-terrain) -------------------------------

/** Flat quad on the ground from four corners in order, one colour. */
function groundQuad([a, b, c, d]: readonly [Vec2, Vec2, Vec2, Vec2], y: number, color: Color) {
  return groundTriangles(
    [a, b, c, a, c, d].map((p) => ({ ...p, color })),
    y,
  );
}

function skirt(footprint: Box, pal: Palette) {
  const x0 = footprint.x - footprint.halfX;
  const x1 = footprint.x + footprint.halfX;
  const z0 = footprint.z - footprint.halfZ;
  const z1 = footprint.z + footprint.halfZ;
  const w = 0.45;
  const inner = (x: number, z: number) => ({ x, z, color: pal.skirt });
  const outer = (x: number, z: number) => ({ x, z, color: pal.ground });
  const corners = [
    [inner(x0, z0), outer(x0 - w, z0 - w)],
    [inner(x1, z0), outer(x1 + w, z0 - w)],
    [inner(x1, z1), outer(x1 + w, z1 + w)],
    [inner(x0, z1), outer(x0 - w, z1 + w)],
  ] as const;
  const vertices = corners.flatMap(([a, aOut], i) => {
    const [b, bOut] = corners[(i + 1) % 4] ?? corners[0];
    return [a, aOut, bOut, a, bOut, b];
  });
  return groundTriangles(vertices, 0.006);
}

function contactDisc(tree: TreeInstance, color: Color) {
  const r = (tree.kind === "round" ? 0.62 : 0.26) * tree.scale;
  const vertices = [];
  for (let i = 0; i < 12; i += 1) {
    const a0 = (i / 12) * PI * 2;
    const a1 = ((i + 1) / 12) * PI * 2;
    vertices.push(
      { x: tree.x, z: tree.z, color },
      { x: tree.x + Math.cos(a0) * r, z: tree.z + Math.sin(a0) * r, color },
      { x: tree.x + Math.cos(a1) * r, z: tree.z + Math.sin(a1) * r, color },
    );
  }
  return groundTriangles(vertices, 0.006);
}

function lamp({ x, z }: Vec2, pal: Palette): Parts {
  return [
    P(cyl(0.045, 0.055, 6, 0, 1.6, x, z), pal.band),
    P(box(x - 0.1, x + 0.1, 1.6, 1.8, z - 0.1, z + 0.1), pal.lit, { emissive: true }),
    P(cone(0.17, 4, 1.8, 1.9, x, z, true), pal.band),
  ];
}

/** Statue on a pedestal: life size on the lawn walks, `small` in the fountain basin. */
function statue(x: number, z: number, pal: Palette, small = false): Parts {
  const { wall, trim } = pal.lm;
  if (small) {
    return [
      P(box(x - 0.06, x + 0.06, 0.22, 0.36, z - 0.06, z + 0.06), trim),
      P(cyl(0.035, 0.05, 5, 0.36, 0.56, x, z), wall),
      P(ico(0.045, 0, x, 0.6, z), wall),
    ];
  }
  return [
    P(box(x - 0.13, x + 0.13, 0, 0.32, z - 0.13, z + 0.13), trim),
    P(cyl(0.06, 0.09, 6, 0.32, 0.72, x, z), wall),
    P(ico(0.06, 0, x, 0.78, z), wall),
  ];
}

/** Lake shore: a quarter ellipse around the front-right corner of the base (§2.2). */
const LAKE = { x: 14.8, z: 10.8, rx: 8.2, rz: 5.0 } as const;
const LAKE_STEPS = 16;
const shore = (i: number, k: number, grow = 0): Vec2 => {
  const t = (PI / 2) * (i / LAKE_STEPS);
  return {
    x: LAKE.x - (k * LAKE.rx + grow) * Math.cos(t),
    z: LAKE.z - (k * LAKE.rz + grow) * Math.sin(t),
  };
};

/** Band between two lake ellipses (scale k, plus `grow` units outwards). */
function lakeBand(k0: number, g0: number, k1: number, g1: number, y: number, color: Color) {
  return range(LAKE_STEPS).map((i) =>
    groundQuad(
      [shore(i, k0, g0), shore(i, k1, g1), shore(i + 1, k1, g1), shore(i + 1, k0, g0)],
      y,
      color,
    ),
  );
}

function lake(pal: Palette): Parts {
  const water = (p: Vec2) => ({ ...p, color: pal.water });
  const fan = range(LAKE_STEPS).flatMap((i) => [
    water(LAKE),
    water(shore(i, 1)),
    water(shore(i + 1, 1)),
  ]);
  return [groundTriangles(fan, 0.008), ...lakeBand(1, 0, 1, 0.14, 0.009, pal.lm.trim)];
}

/** Fountain plaza: concentric paving, curved steps, hedge and roses, tiered basin, statues. */
function fountain(pal: Palette): Parts {
  const { x: px, z: pz } = PLAZA;
  const { wall, trim } = pal.lm;
  const arm = new CylinderGeometry(0.025, 0.03, 0.36, 5)
    .rotateZ(-0.35)
    .translate(px + 0.13, 1.88, pz);
  return [
    P(cyl(4.2, 4.2, 48, 0, 0.04, px, pz), pal.plaza),
    P(ring(2.3, 2.55, 48, px, 0.041, pz), trim),
    P(ring(2.75, 2.82, 48, px, 0.041, pz), pal.band),
    P(ring(3.6, 3.85, 48, px, 0.041, pz), trim),
    P(ring(4.02, 4.09, 48, px, 0.041, pz), pal.band),
    P(ring(4.2, 4.72, 24, px, 0.012, pz, (7 * PI) / 6, (2 * PI) / 3), pal.path),
    ...[4.22, 4.42, 4.62].map((r) =>
      P(ring(r, r + 0.1, 24, px, 0.013, pz, (7 * PI) / 6, (2 * PI) / 3), pal.band),
    ),
    P(cyl(1.88, 1.88, 32, 0.04, 0.14, px, pz), pal.hedge),
    P(circle(1.78, 32, px, 0.142, pz), pal.bloom),
    P(
      lathe(
        [
          [1.3, 0.14],
          [1.3, 0.3],
          [1.5, 0.3],
          [1.5, 0.14],
        ],
        32,
        px,
        pz,
      ),
      wall,
    ),
    P(circle(1.3, 32, px, 0.22, pz), pal.water),
    P(ring(1.12, 1.2, 32, px, 0.222, pz), pal.waterHi),
    ...range(8).flatMap((k) => {
      const a = PI / 8 + (k * PI) / 4;
      return statue(px + Math.cos(a), pz + Math.sin(a), pal, true);
    }),
    P(cyl(0.68, 0.7, 24, 0.22, 0.6, px, pz), wall),
    P(circle(0.6, 24, px, 0.602, pz), pal.water),
    P(cyl(0.36, 0.42, 8, 0.6, 0.85, px, pz), wall),
    P(cyl(0.26, 0.3, 8, 0.85, 1.05, px, pz), trim),
    P(cyl(0.11, 0.2, 8, 1.05, 1.85, px, pz), wall),
    P(ico(0.09, 1, px, 1.95, pz), wall),
    P(arm, wall),
  ];
}

/** Rose garden: six hedged beds on gravel, front-left of the plaza. */
function roseGarden(pal: Palette): Parts {
  return grid([0, 1], [0, 1, 2], (c, r) => {
    const x0 = -12.6 + 3.2 * c;
    const z0 = 3.85 + 1.85 * r;
    return [
      P(box(x0, x0 + 2.6, 0, 0.14, z0, z0 + 1.5), pal.hedge),
      P(rect(x0 + 0.12, x0 + 2.48, z0 + 0.12, z0 + 1.38, 0.142), pal.foliage),
      ...[0.38, 0.92].map((dz) =>
        P(rect(x0 + 0.35, x0 + 2.25, z0 + dz, z0 + dz + 0.2, 0.143), pal.bloom),
      ),
    ];
  }).flat();
}

/** Balustrade across the lawn in front of the plaza, one run on each side of the axis. */
function balustrades(pal: Palette): Parts {
  const { wall, trim } = pal.lm;
  return SIDES.flatMap((s) => {
    const [x0, x1] = s < 0 ? [-2.0, -0.7] : [0.7, 2.0];
    return [
      P(box(x0, x1, 0, 0.28, 1.4, 1.5), wall),
      P(box(x0 - 0.04, x1 + 0.04, 0.28, 0.33, 1.37, 1.53), trim),
      ...[x0, x1].flatMap((xe) => [
        P(box(xe - 0.08, xe + 0.08, 0, 0.4, 1.37, 1.53), wall),
        P(ico(0.07, 0, xe, 0.47, 1.45), wall),
      ]),
    ];
  });
}

/** Six dark inlaid rays on the forecourt, converging on the steps. */
function forecourtRays(pal: Palette) {
  const rays = [
    [0.55, 1.25],
    [1.15, 2.45],
    [1.7, 3.35],
  ] as const;
  return SIDES.flatMap((s) =>
    rays.map(([xa, xb]) =>
      groundQuad(
        [
          { x: s * xa - 0.05, z: -3.55 },
          { x: s * xa + 0.05, z: -3.55 },
          { x: s * xb + 0.05, z: -1.8 },
          { x: s * xb - 0.05, z: -1.8 },
        ],
        0.013,
        pal.band,
      ),
    ),
  );
}

export function buildTerrain(pal: Palette, colonnades: boolean): BufferGeometry {
  const hx = WORLD_BOUNDS.halfX + 0.8;
  const hz = WORLD_BOUNDS.halfZ + 0.8;
  const lamps: Vec2[] = [
    ...SIDES.flatMap((s) => [
      { x: s * 3.55, z: -3.7 },
      arcPoint(s * 0.3 * PI, 4.6),
      arcPoint(s * 0.75 * PI, 4.6),
    ]),
    // Without colonnades the hedge arcs get lamps instead.
    ...(colonnades ? [] : SIDES.flatMap((s) => [0.37, 0.66].map((k) => arcPoint(s * k * PI, 3.4)))),
  ];
  const statues = [
    ...grid([-3.05, 3.05], [-1.35, -0.45, 0.45, 1.35], (x, z) => ({ x, z })),
    ...grid([-3.3, 3.3], [-2.05, -5.5], (x, z) => ({ x, z })),
  ];
  return merge([
    P(box(-hx, hx, -0.6, 0, -hz, hz), { top: pal.ground, side: pal.soil }),
    P(box(-hx - 0.25, hx + 0.25, -0.8, -0.6, -hz - 0.25, hz + 0.25), pal.plaza),
    // Forecourt, lawn walks, entrance paths, rose-garden gravel.
    P(rect(-3.4, 3.4, -6.0, -1.8, 0.012), pal.path),
    P(rect(-3.1, -2.0, -1.8, 1.7, 0.012), pal.path),
    P(rect(2.0, 3.1, -1.8, 1.7, 0.012), pal.path),
    P(rect(-8.8, -3.4, -3.1, -2.5, 0.012), pal.path),
    P(rect(3.4, 8.8, -3.1, -2.5, 0.012), pal.path),
    P(rect(3.6, 7.0, 3.6, 4.2, 0.012), pal.path),
    P(rect(-12.8, -6.2, 3.6, 9.4, 0.011), pal.path),
    ...forecourtRays(pal),
    P(rect(-3.4, 3.4, -2.0, -1.9, 0.013), pal.band),
    ...roseGarden(pal),
    P(box(-2.02, -1.92, 0, 0.16, -1.7, 1.3), pal.hedge),
    P(box(1.92, 2.02, 0, 0.16, -1.7, 1.3), pal.hedge),
    ...fountain(pal),
    ...lake(pal),
    ...balustrades(pal),
    ...statues.flatMap(({ x, z }) => statue(x, z, pal)),
    ...lamps.flatMap((spot) => lamp(spot, pal)),
    // Clipped bushes at the foot of the colonnades.
    ...SIDES.flatMap((s) =>
      [0.42, 0.52, 0.62].map((k) => {
        const { x, z } = arcPoint(s * k * PI, 4.2);
        return P(ico(0.22, 0, 0, 0, 0).scale(1, 0.8, 1).translate(x, 0.18, z), pal.hedge);
      }),
    ),
    ...[...LANDMARK.footprints, ...SITES.map((site) => site.footprint)].map((f) => skirt(f, pal)),
    ...TREE_INSTANCES.map((tree) => contactDisc(tree, pal.contact)),
  ]);
}

// --- Landmark: shared U-shaped main building, tower archetype, colonnades (G-landmark) -------

/** Base, porch floor and steps; the stepped tower base; two wings; four pavilions (§5.2). */
function mainBuilding(pal: Palette): Parts {
  const { wall, trim, roof } = pal.lm;
  const g = pal.glass;
  const ao = { ao: true };
  const baseWindows = grid(
    range(14).map((k) => -2.6 + 0.4 * k),
    [0.62, 1.27, 1.92, 2.57],
    (x, y) => ({ x, y }),
  ).filter(({ x, y }) => !(Math.abs(x) < 1.7 && y < 1.5));
  const parts: Parts = [
    P(box(-9.9, 9.9, 0, 0.3, -9.95, -5.95), trim, ao),
    P(box(-3.15, 3.15, 0, 0.3, -5.95, -5.15), trim, ao),
    P(box(-1.7, 1.7, 0, 0.3, -5.15, -4.15), trim, ao),
    P(box(-1.7, 1.7, 0, 0.2, -4.15, -3.85), trim),
    P(box(-1.7, 1.7, 0, 0.1, -3.85, -3.55), trim),
    // Tower base: four storeys, corner piers stepping forward.
    P(box(-3.0, 3.0, 0.3, 2.9, -9.9, -5.3), wall, ao),
    P(box(-3.06, -2.5, 0.3, 2.9, -5.3, -5.24), wall),
    P(box(2.5, 3.06, 0.3, 2.9, -5.3, -5.24), wall),
    P(box(-3.12, 3.12, 2.9, 3.02, -10.02, -5.18), trim),
    ...baseWindows.map(({ x, y }) =>
      P(quad("+z", Math.abs(x) >= 2.5 ? -5.24 : -5.3, x, y, 0.2, 0.36), g),
    ),
    ...range(6).map((k) => P(quad("+x", 3.0, -9.6 + 0.4 * k, 2.57, 0.2, 0.36), g)),
  ];
  for (const s of SIDES) {
    const [x0, x1] = s < 0 ? [-9.7, -3.0] : [3.0, 9.7];
    parts.push(
      P(box(x0, x1, 0.3, 2.25, -9.7, -6.2), wall, ao),
      P(box(x0 - 0.05, x1 + 0.05, 2.25, 2.37, -9.75, -6.15), trim),
      P(rect(x0 + 0.12, x1 - 0.12, -9.63, -6.27, 2.372), roof),
      P(box(x0 - 0.05, x1 + 0.05, 2.37, 2.5, -6.27, -6.15), wall),
      ...[0.92, 1.57].map((y) => P(box(x0, x1, y, y + 0.04, -6.2, -6.16), trim)),
      ...range(9).flatMap((i) => {
        const x = s * (4.6 + 0.42 * i);
        return [
          P(quad("+z", -6.2, x, 1.27, 0.16, 0.4), g),
          P(quad("+z", -6.2, x, 1.92, 0.16, 0.4), g),
          P(quad("+z", -6.2, x, 0.55, 0.16, 0.34), g),
          P(arch("+z", -6.2, x, 0.72, 0.08), g),
        ];
      }),
      ...(s > 0
        ? grid(range(5), [0.62, 1.27, 1.92], (i, y) =>
            P(quad("+x", 9.7, -9.4 + 0.42 * i, y, 0.16, 0.4), g),
          )
        : []),
    );
  }
  for (const c of [-9.05, -3.7, 3.7, 9.05]) {
    const floors = [0.63, 1.29, 1.95, 2.61];
    parts.push(
      P(box(c - 0.7, c + 0.7, 0.3, 2.95, -7.4, -6.0), wall, ao),
      P(box(c - 0.76, c + 0.76, 2.95, 3.03, -7.46, -5.94), trim),
      P(box(c - 0.5, c + 0.5, 3.03, 3.13, -7.2, -6.2), wall),
      P(box(c - 0.26, c + 0.26, 3.13, 3.42, -6.96, -6.44), wall),
      P(box(c - 0.31, c + 0.31, 3.42, 3.48, -7.01, -6.39), trim),
      P(quad("+z", -6.44, c, 3.25, 0.14, 0.2), g),
      P(arch("+z", -6.44, c, 3.35, 0.07), g),
      P(quad("+x", c + 0.26, -6.7, 3.25, 0.14, 0.2), g),
      P(arch("+x", c + 0.26, -6.7, 3.35, 0.07), g),
      ...grid([c - 0.28, c + 0.28], floors, (x, y) => P(quad("+z", -6.0, x, y, 0.18, 0.38), g)),
      ...(c > 0
        ? grid([-7.0, -6.4], floors, (z, y) => P(quad("+x", c + 0.7, z, y, 0.18, 0.38), g))
        : []),
    );
  }
  return parts;
}

/** Stepped tower with a lantern, cup, needle spire and sun star (§5.3). */
function spireHall(pal: Palette): Parts {
  const { wall, trim, accent } = pal.lm;
  const g = pal.glass;
  const cz = -7.6;
  const posts = range(8).map((k) => {
    const a = PI / 8 + (k * PI) / 4;
    return { x: 0.44 * Math.cos(a), z: cz + 0.44 * Math.sin(a) };
  });
  return [
    // Porch: four columns, wider middle bay.
    ...[-1.4, -0.6, 0.6, 1.4].map((x) => P(cyl(0.09, 0.1, 8, 0.3, 1.3, x, -4.4), wall)),
    P(box(-1.65, 1.65, 1.3, 1.46, -5.3, -4.22), trim),
    P(quad("+z", -5.3, 0, 0.75, 1.0, 0.9), g),
    // Tier 2.
    P(box(-1.95, 1.95, 3.02, 3.8, -9.1, -6.1), wall),
    P(box(-2.03, 2.03, 3.8, 3.96, -9.18, -6.02), trim),
    ...range(9).map((k) => P(quad("+z", -6.1, -1.6 + 0.4 * k, 3.41, 0.2, 0.4), g)),
    ...range(7).map((k) => P(quad("+x", 1.95, -8.8 + 0.4 * k, 3.41, 0.2, 0.4), g)),
    // Tier 3, roof garden and corner kiosks.
    P(box(-1.83, 1.83, 3.96, 4.9, -9.0, -6.2), wall),
    P(box(-1.9, 1.9, 4.9, 5.0, -9.07, -6.13), trim),
    ...grid(range(9), [4.2, 4.62], (k, y) =>
      P(quad("+z", -6.2, -1.4 + 0.35 * k, y, 0.18, 0.28), g),
    ),
    ...grid(range(7), [4.2, 4.62], (k, y) =>
      P(quad("+x", 1.83, -8.7 + 0.37 * k, y, 0.18, 0.28), g),
    ),
    P(rect(-1.75, 1.75, -8.95, -6.25, 5.003), pal.lm.roof),
    P(rect(-1.75, 1.75, -6.5, -6.25, 5.004), pal.hedge),
    ...grid([-1.55, 1.55], [-8.75, -6.45], (kx, kz) => [
      P(box(kx - 0.17, kx + 0.17, 5.0, 5.42, kz - 0.17, kz + 0.17), wall),
      P(cone(0.26, 4, 5.42, 5.6, kx, kz, true), trim),
    ]).flat(),
    // Tier 4 with tall arched openings.
    P(box(-0.81, 0.81, 5.0, 6.2, -8.41, -6.79), wall),
    P(quad("+z", -6.79, 0, 5.5, 0.34, 0.62), g),
    P(arch("+z", -6.79, 0, 5.81, 0.17), g),
    P(quad("+x", 0.81, cz, 5.5, 0.34, 0.62), g),
    P(arch("+x", 0.81, cz, 5.81, 0.17), g),
    P(box(-0.88, 0.88, 6.2, 6.28, -8.48, -6.72), trim),
    // Lantern, cup, needle and star.
    P(cyl(0.56, 0.82, 8, 6.28, 6.55, 0, cz), wall),
    P(cyl(0.4, 0.4, 8, 6.55, 7.55, 0, cz), g),
    ...posts.map(({ x, z }) => P(box(x - 0.06, x + 0.06, 6.55, 7.55, z - 0.06, z + 0.06), wall)),
    P(cyl(0.52, 0.52, 8, 7.55, 7.65, 0, cz), trim),
    ...posts.map(({ x, z }) => P(cone(0.07, 4, 7.65, 7.85, x, z, true), wall)),
    P(cyl(0.2, 0.36, 8, 7.65, 7.9, 0, cz), wall),
    P(cyl(0.3, 0.14, 8, 7.9, 8.3, 0, cz), wall),
    P(cyl(0.035, 0.11, 6, 8.3, 9.7, 0, cz), wall),
    P(ico(0.14, 0, 0, 10.0, cz), accent),
    ...range(8).map((k) =>
      P(
        new ConeGeometry(0.055, 0.16, 4)
          .translate(0, 0.2, 0)
          .rotateZ((k * PI) / 4)
          .translate(0, 10.0, cz),
        accent,
      ),
    ),
  ];
}

/** Clock hand pointing `angle` radians clockwise from 12, on a clock face centred at (u, v). */
function hand(
  face: "+x" | "+z",
  plane: number,
  u: number,
  v: number,
  width: number,
  length: number,
  angle: number,
) {
  const geometry = new PlaneGeometry(width, length).translate(0, length / 2, 0).rotateZ(-angle);
  return onFace(geometry, face, plane + 0.01, u, v);
}

/** Town hall: hip roof on the shared tower base and a clock tower in front (§5.4). */
function clockTower(pal: Palette): Parts {
  const { wall, trim, roof, accent } = pal.lm;
  const g = pal.glass;
  const e = { emissive: true };
  const hipRoof = new ConeGeometry(1, 1.28, 4)
    .rotateY(PI / 4)
    .scale(3.12 * Math.SQRT2, 1, 2.42 * Math.SQRT2)
    .translate(0, 3.02 + 0.64, -7.6);
  const v = 5.31;
  const faces = [
    ["+z", -4.9, 0],
    ["+x", 0.75, -5.65],
  ] as const;
  const windows = [
    [2.3, 0.6],
    [3.4, 0.5],
  ] as const;
  return [
    P(hipRoof, roof),
    P(box(-0.85, 0.85, 0.3, 4.6, -6.5, -4.8), wall, { ao: true }),
    P(box(-0.95, 0.95, 4.6, 4.72, -6.6, -4.7), trim),
    P(box(-0.75, 0.75, 4.72, 5.9, -6.4, -4.9), wall),
    ...faces.flatMap(([face, plane, u]) => [
      P(disc(face, plane, u, v, 0.42, 16), pal.plaza, e),
      P(onFace(new RingGeometry(0.42, 0.5, 16), face, plane, u, v), accent),
      P(hand(face, plane, u, v, 0.04, 0.34, PI), pal.dark, e),
      P(hand(face, plane, u, v, 0.05, 0.24, (3 * PI) / 4), pal.dark, e),
    ]),
    P(cone(1.1, 4, 5.9, 7.6, 0, -5.65, true), roof),
    P(cyl(0.025, 0.025, 4, 7.6, 8.0, 0, -5.65), accent),
    P(ico(0.12, 0, 0, 8.08, -5.65), accent),
    P(quad("+z", -4.8, 0, 0.8, 0.6, 1.0), g),
    ...windows.flatMap(([y, h]) => [
      P(quad("+z", -4.8, 0, y, 0.3, h), g),
      P(quad("+x", 0.85, -5.65, y, 0.3, h), g),
    ]),
  ];
}

/** Two curved double colonnades around the plaza, each closed by a square pier (§5.5). */
function colonnade(pal: Palette): Parts {
  const { wall, trim } = pal.lm;
  const turned = (h: number, y0: number, y1: number, p: Vec2, a: number) =>
    box(-h, h, y0, y1, -h, h).rotateY(-a).translate(p.x, 0, p.z);
  return [
    ...COLONNADE_COLUMNS.flatMap(({ x, z }) => [
      P(box(x - 0.13, x + 0.13, 0.04, 0.12, z - 0.13, z + 0.13), trim),
      P(cyl(0.075, 0.088, 8, 0.12, 1.55, x, z), wall),
      P(box(x - 0.13, x + 0.13, 1.55, 1.65, z - 0.13, z + 0.13), trim),
    ]),
    ...SIDES.flatMap((s) => [
      P(arcSlab(2.86, 3.94, s * 0.35 * PI, s * 0.7 * PI, 1.65, 1.88), wall),
      P(arcSlab(2.8, 4.0, s * 0.345 * PI, s * 0.705 * PI, 1.88, 1.95), trim),
      ...[0.4, 0.49, 0.58].flatMap((k) => {
        const { x, z } = arcPoint(s * k * PI, 3.4);
        return [P(cyl(0.05, 0.09, 6, 1.95, 2.1, x, z), wall), P(ico(0.08, 0, x, 2.17, z), wall)];
      }),
    ]),
    ...COLONNADE_PIERS.flatMap((p, i) => {
      const a = (SIDES[i] ?? 1) * 0.68 * PI;
      return [
        P(turned(0.42, 0, 1.65, p, a), wall),
        P(turned(0.36, 1.95, 2.25, p, a), wall),
        P(cyl(0.07, 0.12, 6, 2.25, 2.42, p.x, p.z), wall),
        P(ico(0.1, 0, p.x, 2.5, p.z), wall),
      ];
    }),
  ];
}

/** Low hedge arcs in place of the colonnades; walkable, being under 0.4 high. */
function hedgeArcs(pal: Palette): Parts {
  return SIDES.map((s) => P(arcSlab(3.25, 3.55, s * 0.36 * PI, s * 0.68 * PI, 0, 0.3), pal.hedge));
}

export function buildLandmark(pal: Palette, archetype: LandmarkArchetype, colonnades: boolean) {
  return merge([
    ...mainBuilding(pal),
    ...(archetype === "spire-hall" ? spireHall(pal) : clockTower(pal)),
    ...(colonnades ? colonnade(pal) : hedgeArcs(pal)),
  ]);
}

// --- Zone buildings (G-library, G-watchtower, G-market) --------------------------------------

/** Building colours for a status: "coming soon" desaturates everything in the group. */
function siteColours(pal: Palette, own: BuildingPalette, status: ZoneStatus) {
  const tone = (c: Color) => (status === "open" ? c : desaturate(c));
  return {
    wall: tone(own.wall),
    trim: tone(own.trim),
    roof: tone(own.roof),
    trunk: tone(pal.trunk),
    glass: tone(pal.glass),
    accent: tone(pal.lm.accent),
    hedge: tone(pal.hedge),
    ground: tone(pal.ground),
    foliage: tone(pal.foliage),
    window: status === "open" ? pal.lit : tone(pal.glass),
    goods: [tone(pal.player), tone(pal.npc), tone(pal.lm.accent)] as const,
  };
}

/** Two-storey hall: gold-banded portico, lit arched windows with books, roof garden (§5.6). */
export function buildLibrary(pal: Palette, status: ZoneStatus) {
  const c = siteColours(pal, pal.lib, status);
  const open = status === "open";
  const lit = { emissive: open };
  const tall = [-11.85, -11.15, -10.45, -9.75];
  const parts: Parts = [
    P(box(-12.4, -8.8, 0, 0.25, -6.0, -0.6), c.trim, { ao: true }),
    P(box(-12.2, -9.4, 0.25, 1.85, -5.8, -0.8), c.wall, { ao: true }),
    ...[-5.2, -4.4, -3.6, -2.0, -1.2].flatMap((z) => [
      P(cyl(0.075, 0.085, 8, 0.25, 1.85, -9.05, z), c.wall),
      P(cyl(0.095, 0.095, 8, 1.66, 1.76, -9.05, z), c.accent),
    ]),
    P(box(-9.45, -8.85, 1.85, 2.02, -5.85, -0.75), c.trim),
    P(box(-12.3, -8.85, 2.02, 2.1, -5.9, -0.7), c.trim),
    P(rect(-12.1, -9.1, -5.65, -0.95, 2.102), c.trim),
    P(rect(-11.7, -9.5, -5.2, -1.4, 2.103), c.ground),
    ...grid([-11.6, -9.6], [-5.1, -1.5], (x, z) =>
      P(ico(0.18, 0, 0, 0, 0).scale(1, 0.9, 1).translate(x, 2.25, z), c.foliage),
    ),
    P(quad("+x", -9.4, -2.8, 0.7, 0.6, 0.9), c.window, lit),
    P(arch("+x", -9.4, -2.8, 1.15, 0.3), c.window, lit),
    P(box(-9.4, -8.6, 1.42, 1.48, -3.4, -2.2), c.roof),
    ...[-4.8, -4.0, -1.6].flatMap((z) => [
      P(quad("+x", -9.4, z, 0.65, 0.3, 0.55), c.window, lit),
      P(quad("+x", -9.4, z, 1.4, 0.3, 0.45), c.window, lit),
      P(arch("+x", -9.4, z, 1.625, 0.15), c.window, lit),
    ]),
    ...tall.flatMap((x) => [
      P(quad("+z", -0.8, x, 0.95, 0.44, 1.25), c.window, lit),
      P(arch("+z", -0.8, x, 1.575, 0.22), c.window, lit),
    ]),
  ];
  if (open) {
    // Coloured book spines behind each tall window, read as shelves through the glass.
    const spines = [pal.lib.roof, pal.lm.accent, pal.mk.roof, pal.wt.roof, pal.lib.trim];
    const rows = [
      { base: 0.42, heights: [0.5, 0.44, 0.55, 0.46, 0.52] },
      { base: 1.0, heights: [0.42, 0.46, 0.39, 0.48, 0.44] },
    ];
    for (const x of tall) {
      rows.forEach((row, r) => {
        row.heights.forEach((h, k) => {
          const spine = new PlaneGeometry(0.07, h).translate(
            x - 0.164 + 0.082 * k,
            row.base + h / 2,
            -0.788,
          );
          parts.push(P(spine, spines[(k + 2 * r) % 5] ?? pal.lib.roof, { emissive: true }));
        });
      });
      const shelf = new PlaneGeometry(0.44, 0.03).translate(x, 0.99, -0.787);
      parts.push(P(shelf, pal.lib.trim, { emissive: true }));
    }
  } else {
    parts.push(
      ...[-11.9, -10.8, -9.7].map((x) =>
        P(box(x - 0.035, x + 0.035, 0.25, 2.15, -0.715, -0.645), c.trunk),
      ),
      ...[0.85, 1.55].map((y) => P(box(-12.2, -9.4, y, y + 0.06, -0.75, -0.5), c.trunk)),
    );
  }
  return merge(parts);
}

/** A wing pavilion enlarged into a four-tier tower, with a lobby in front (§5.7). */
export function buildWatchtower(pal: Palette, status: ZoneStatus) {
  const c = siteColours(pal, pal.wt, status);
  const open = status === "open";
  const ao = { ao: true };
  const slot = { emissive: open };
  return merge([
    P(box(8.8, 12.0, 0, 0.25, -6.0, -1.0), c.trim, ao),
    P(box(9.0, 11.8, 0.25, 1.45, -3.8, -1.2), c.wall, ao),
    P(box(8.95, 11.85, 1.45, 1.53, -3.85, -1.15), c.trim),
    P(box(9.6, 11.6, 0.25, 3.45, -5.8, -3.8), c.wall, ao),
    P(box(9.52, 11.68, 3.45, 3.57, -5.88, -3.72), c.trim),
    P(box(9.8, 11.4, 3.57, 4.17, -5.6, -4.0), c.wall),
    P(box(9.75, 11.45, 4.17, 4.25, -5.65, -3.95), c.trim),
    P(box(10.05, 11.15, 4.25, 4.75, -5.35, -4.25), c.wall),
    P(box(10.0, 11.2, 4.75, 4.82, -5.4, -4.2), c.trim),
    P(box(10.3, 10.9, 4.82, 5.5, -5.1, -4.5), c.wall),
    P(box(10.24, 10.96, 5.5, 5.58, -5.16, -4.44), c.trim),
    P(quad("+z", -4.5, 10.6, 5.08, 0.16, 0.34), c.window, slot),
    P(arch("+z", -4.5, 10.6, 5.25, 0.08), c.window, slot),
    P(quad("+x", 10.9, -4.8, 5.08, 0.16, 0.34), c.window, slot),
    P(arch("+x", 10.9, -4.8, 5.25, 0.08), c.window, slot),
    P(cone(0.42, 4, 5.58, 6.05, 10.6, -4.8, true), c.roof),
    P(ico(0.07, 0, 10.6, 6.12, -4.8), c.accent),
    ...grid([10.2, 11.0], [1.95, 2.75], (x, y) => P(quad("+z", -3.8, x, y, 0.2, 0.42), c.glass)),
    ...grid([-5.2, -4.4], [0.65, 1.45, 2.25, 3.05], (z, y) =>
      P(quad("+x", 11.6, z, y, 0.2, 0.42), c.glass),
    ),
    ...[9.6, 10.4, 11.2].map((x) => P(quad("+z", -1.2, x, 0.75, 0.3, 0.5), c.glass)),
    ...[-3.2, -2.4, -1.6].map((z) => P(quad("+x", 11.8, z, 0.75, 0.3, 0.5), c.glass)),
    ...(open
      ? []
      : [
          ...[9.7, 10.6, 11.5].map((x) =>
            P(box(x - 0.035, x + 0.035, 1.53, 3.55, -3.715, -3.645), c.trunk),
          ),
          ...[2.1, 2.9].map((y) => P(box(9.6, 11.6, y, y + 0.06, -3.75, -3.5), c.trunk)),
        ]),
  ]);
}

/** Open market hall by the lake: white columns, flat roof, awnings, three stalls (§5.8). */
export function buildMarket(pal: Palette, status: ZoneStatus) {
  const c = siteColours(pal, pal.mk, status);
  const stalls = [7.9, 9.0, 10.1];
  const goods = [
    { size: 0.18, dx: -0.35 },
    { size: 0.26, dx: 0 },
    { size: 0.36, dx: 0.38 },
  ];
  const columns = [
    ...grid([7.25, 8.42, 9.58, 10.75], [2.85, 4.95], (x, z) => ({ x, z })),
    { x: 10.75, z: 3.9 },
  ];
  const tilt = 0.3805;
  return merge([
    P(box(7.0, 11.0, 0, 0.2, 2.6, 5.2), c.trim, { ao: true }),
    ...columns.map(({ x, z }) => P(cyl(0.08, 0.09, 8, 0.2, 1.75, x, z), c.wall)),
    P(box(6.95, 11.05, 1.75, 1.95, 2.55, 5.25), c.trim),
    P(box(7.6, 10.4, 1.95, 2.35, 3.05, 4.75), c.wall),
    P(box(7.55, 10.45, 2.35, 2.42, 3.0, 4.8), c.trim),
    P(new PlaneGeometry(3.9, 0.646).rotateX(-PI / 2 + tilt).translate(9.0, 1.5, 5.55), c.roof),
    P(
      new PlaneGeometry(0.646, 2.5)
        .rotateX(-PI / 2)
        .rotateZ(-tilt)
        .translate(11.35, 1.5, 3.9),
      c.roof,
    ),
    P(box(6.55, 7.0, 1.45, 1.51, 3.3, 4.5), c.roof),
    ...stalls.map((x) => P(box(x - 0.55, x + 0.55, 0.2, 0.9, 3.6, 4.2), c.trunk)),
    ...stalls.flatMap((x) =>
      goods.map(({ size, dx }, i) => {
        const h = size / 2;
        const block = box(x + dx - h, x + dx + h, 0.9, 0.9 + size, 3.9 - h, 3.9 + h);
        return P(block, c.goods[i] ?? c.trunk);
      }),
    ),
    ...(status === "open"
      ? []
      : [
          ...[2.8, 3.9, 5.0].map((z) =>
            P(box(11.06, 11.13, 0, 2.3, z - 0.035, z + 0.035), c.trunk),
          ),
          ...[0.9, 1.9].map((y) => P(box(11.05, 11.3, y, y + 0.06, 2.7, 5.1), c.trunk)),
        ]),
  ]);
}

// --- Figures and trees (MeshLambertMaterial, vertex colours without baked light) -------------

const L = (geometry: BufferGeometry, color: Color) => part(geometry, { color }, "lit");

/** Player figure, origin at the feet, facing local +z. Height 1.27. */
export function buildPlayer(pal: Palette) {
  return merge([
    L(cyl(0.15, 0.13, 8, 0, 0.42), pal.pants),
    L(cyl(0.19, 0.23, 8, 0.42, 0.92), pal.player),
    L(box(-0.14, 0.14, 0.54, 0.86, -0.31, -0.17), pal.pants),
    L(ico(0.17, 1, 0, 1.1, 0), pal.plaza),
  ]);
}

/** Librarian: flared skirt, long cardigan, book held to the chest, hair bun, glasses. */
export function buildLan(pal: Palette) {
  const book = box(-0.13, 0.13, -0.16, 0.16, -0.035, 0.035).rotateX(-0.26).translate(0, 0.86, 0.25);
  return merge([
    L(cyl(0.17, 0.31, 10, 0, 0.62), pal.lanSkirt),
    L(cyl(0.18, 0.24, 10, 0.56, 1.08), pal.npc),
    L(book, pal.lib.roof),
    L(ico(0.16, 1, 0, 1.24, 0), pal.plaza),
    L(ico(0.17, 1, 0, 1.28, -0.035), pal.dark),
    L(ico(0.085, 0, 0, 1.37, -0.17), pal.dark),
    L(box(-0.11, 0.11, 1.2275, 1.2625, 0.135, 0.165), pal.dark),
  ]);
}

/** Broad crown, a little wider than tall (§5.9). */
export function buildRoundTree(pal: Palette) {
  const crown = ico(0.8, 1, 0, 0, 0).scale(1, 0.85, 1).translate(0, 1.55, 0);
  return merge([L(cyl(0.08, 0.12, 6, 0, 0.95), pal.trunk), L(crown, pal.foliage)]);
}

/** Slender cypress, about 3.4 times taller than wide and well below the wing cornice (§5.9). */
export function buildCypress(pal: Palette) {
  const crown = lathe(
    [
      [0, 0.1],
      [0.17, 0.13],
      [0.23, 0.4],
      [0.225, 0.8],
      [0.15, 1.2],
      [0.05, 1.45],
      [0, 1.55],
    ],
    8,
    0,
    0,
  );
  return merge([L(cyl(0.04, 0.05, 5, 0, 0.12), pal.trunk), L(crown, pal.cypress)]);
}

/** Segments of the always-present helpers drawn besides the built groups (art §3, §5.10). */
export const BLOB_SEGMENTS = 20;
export const RING_SEGMENTS = 40;
