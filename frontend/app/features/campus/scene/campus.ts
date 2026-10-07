import {
  type BufferGeometry,
  type Color,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";

import type { LandmarkArchetype } from "~/features/theme/schema";
import type { ZoneStatus } from "~/features/zones/schema";

import {
  COLONNADE_COLUMNS,
  LANDMARK,
  PLAZA,
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
  prismX,
  quad,
  rect,
  ring,
  type PartStyle,
} from "./primitives";

/*
 * Procedural campus, built to art-direction §5. Each exported builder returns the merged
 * geometry of one draw call. Coordinates are absolute world units from layout.ts (D9).
 */

type Parts = BufferGeometry[];
const P = (
  geometry: BufferGeometry,
  color: PartStyle["color"],
  flags: Omit<PartStyle, "color"> = {},
) => part(geometry, { color, ...flags });

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
    yaw: 2 * Math.PI * hash(i, 2),
    brightness: 0.9 + 0.18 * hash(i, 3),
    kind: Math.abs(tree.x) <= 5.5 ? "cypress" : "round",
  };
});

export function treeMatrix(tree: TreeInstance): Matrix4 {
  return new Matrix4().compose(
    new Vector3(tree.x, 0, tree.z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), tree.yaw),
    new Vector3(tree.scale, tree.scaleY, tree.scale),
  );
}

// --- Terrain, paths, plaza, fountain, lamps (G-terrain) -------------------------------------

const LAMPS: readonly Vec2[] = [
  { x: -5.0, z: 1.0 },
  { x: 5.8, z: 1.0 },
  { x: -1.35, z: 5.4 },
  { x: 1.35, z: 5.4 },
];

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
  const r = (tree.kind === "round" ? 0.62 : 0.4) * tree.scale;
  const vertices = [];
  for (let i = 0; i < 12; i += 1) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = ((i + 1) / 12) * Math.PI * 2;
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
    P(cyl(0.05, 0.06, 6, 0, 1.9, x, z), pal.dark),
    P(box(x - 0.1, x + 0.1, 1.9, 2.12, z - 0.1, z + 0.1), pal.lit, { emissive: true }),
    P(cone(0.17, 4, 2.12, 2.24, x, z, true), pal.dark),
  ];
}

export function buildTerrain(pal: Palette, colonnades: boolean): BufferGeometry {
  const { x: px, z: pz } = PLAZA;
  const hx = WORLD_BOUNDS.halfX + 0.8;
  const hz = WORLD_BOUNDS.halfZ + 0.8;
  const lamps = colonnades
    ? LAMPS
    : [...LAMPS, ...[0, 5, 6, 11].flatMap((i) => COLONNADE_COLUMNS[i] ?? [])];
  return merge([
    P(box(-hx, hx, -0.6, 0, -hz, hz), { top: pal.ground, side: pal.soil }),
    P(box(-hx - 0.25, hx + 0.25, -0.8, -0.6, -hz - 0.25, hz + 0.25), pal.plaza),
    P(rect(-1.0, 1.0, -5.4, 6.1, 0.012), pal.path),
    P(rect(-6.3, 7.1, 1.4, 2.6, 0.012), pal.path),
    P(rect(-6.3, -4.5, 0.0, 4.0, 0.013), pal.path),
    P(cyl(4.9, 4.9, 48, 0, 0.04, px, pz), pal.plaza),
    P(ring(2.3, 2.45, 48, px, 0.041, pz), pal.lm.trim),
    P(ring(4.5, 4.65, 48, px, 0.041, pz), pal.lm.trim),
    ...[LANDMARK.footprint, ...SITES.map((site) => site.footprint)].map((f) => skirt(f, pal)),
    ...TREE_INSTANCES.map((tree) => contactDisc(tree, pal.contact)),
    // Fountain: basin, water, static ripple, column, upper bowl, finial.
    P(
      lathe(
        [
          [1.22, 0.04],
          [1.22, 0.46],
          [1.5, 0.46],
          [1.5, 0.4],
          [1.4, 0.4],
          [1.4, 0.04],
          [1.22, 0.04],
        ],
        32,
        px,
        pz,
      ),
      pal.lm.wall,
    ),
    P(circle(1.22, 32, px, 0.3, pz), pal.water),
    P(ring(0.7, 0.8, 32, px, 0.302, pz), pal.waterHi),
    P(cyl(0.26, 0.34, 12, 0.3, 1.05, px, pz), pal.lm.wall),
    P(cyl(0.72, 0.32, 24, 1.05, 1.25, px, pz), pal.lm.wall),
    P(circle(0.62, 24, px, 1.252, pz), pal.water),
    P(cyl(0.08, 0.12, 8, 1.25, 1.65, px, pz), pal.lm.wall),
    P(ico(0.15, 0, px, 1.78, pz), pal.lm.accent),
    ...lamps.flatMap((spot) => lamp(spot, pal)),
  ]);
}

// --- Landmark and colonnades (G-landmark) ----------------------------------------------------

function colonnade(pal: Palette): Parts {
  const lm = pal.lm;
  const parts: Parts = COLONNADE_COLUMNS.flatMap(({ x, z }) => [
    P(box(x - 0.18, x + 0.18, 0.1, 0.2, z - 0.18, z + 0.18), lm.trim),
    P(cyl(0.13, 0.15, 10, 0.2, 2.26, x, z), lm.wall),
    P(box(x - 0.17, x + 0.17, 2.26, 2.36, z - 0.17, z + 0.17), lm.trim),
  ]);
  for (const s of [-1, 1]) {
    parts.push(
      P(arcSlab(3.9, 4.5, s * 0.34 * Math.PI, s * 0.72 * Math.PI, 0.04, 0.1), lm.trim),
      P(arcSlab(3.98, 4.42, s * 0.34 * Math.PI, s * 0.72 * Math.PI, 2.36, 2.62), lm.wall),
      P(arcSlab(3.93, 4.47, s * 0.335 * Math.PI, s * 0.725 * Math.PI, 2.62, 2.7), lm.trim),
    );
  }
  return parts;
}

const grid = <T>(xs: readonly number[], ys: readonly number[], f: (x: number, y: number) => T) =>
  xs.flatMap((x) => ys.map((y) => f(x, y)));

function spireHall(pal: Palette): Parts {
  const { wall, trim, roof, accent } = pal.lm;
  const g = pal.glass;
  const ao = { ao: true };
  return [
    P(box(-3.2, 3.2, 0.3, 2.2, -9.05, -6.25), wall, ao),
    P(box(-3.3, 3.3, 2.2, 2.32, -9.15, -6.15), trim),
    P(box(-1.4, 1.4, 0.3, 3.1, -9.05, -5.95), wall, ao),
    ...[-0.9, -0.3, 0.3, 0.9].map((x) => P(cyl(0.11, 0.13, 8, 0.3, 2.2, x, -5.72), wall)),
    P(box(-1.4, 1.4, 2.2, 2.38, -5.95, -5.5), trim),
    P(box(-1.5, 1.5, 3.1, 3.24, -9.15, -5.85), trim),
    P(box(-1.1, 1.1, 3.24, 4.44, -8.5, -6.3), wall),
    P(box(-1.2, 1.2, 4.44, 4.56, -8.6, -6.2), trim),
    P(box(-0.8, 0.8, 4.56, 5.46, -8.2, -6.6), wall),
    P(box(-0.88, 0.88, 5.46, 5.56, -8.28, -6.52), trim),
    P(cyl(0.55, 0.6, 8, 5.56, 6.36, 0, -7.4), wall),
    P(cyl(0.64, 0.64, 8, 6.36, 6.44, 0, -7.4), trim),
    P(cone(0.52, 8, 6.44, 7.14, 0, -7.4), roof),
    P(cyl(0.035, 0.12, 6, 7.14, 9.44, 0, -7.4), roof),
    P(ico(0.2, 0, 0, 9.62, -7.4), accent),
    // 37 windows.
    ...grid([-2.85, -2.3, -1.75, 1.75, 2.3, 2.85], [0.95, 1.7], (x, y) =>
      P(quad("+z", -6.25, x, y, 0.3, 0.5), g),
    ),
    ...grid([-6.7, -7.3, -7.9, -8.5], [0.95, 1.7], (z, y) => P(quad("+x", 3.2, z, y, 0.3, 0.5), g)),
    ...[-0.9, -0.3, 0.3, 0.9].map((x) => P(quad("+z", -5.95, x, 2.75, 0.3, 0.45), g)),
    ...[-6.5, -7.1, -7.7, -8.3].map((z) => P(quad("+x", 1.4, z, 2.75, 0.3, 0.45), g)),
    ...[-0.6, 0, 0.6].map((x) => P(quad("+z", -6.3, x, 3.84, 0.28, 0.6), g)),
    ...[-6.8, -7.4, -8.0].map((z) => P(quad("+x", 1.1, z, 3.84, 0.28, 0.6), g)),
    P(quad("+z", -6.6, 0, 5.0, 0.36, 0.55), g),
    P(quad("+x", 0.8, -7.4, 5.0, 0.36, 0.55), g),
    P(quad("+z", -5.95, 0, 0.85, 0.5, 1.1), g),
  ];
}

/** Clock hand pointing `angle` radians clockwise from 12, on the clock face of `face`. */
function hand(
  face: "+x" | "+z",
  plane: number,
  u: number,
  width: number,
  length: number,
  angle: number,
) {
  const geometry = new PlaneGeometry(width, length).translate(0, length / 2, 0).rotateZ(-angle);
  return onFace(geometry, face, plane + 0.01, u, 4.57);
}

function clockTower(pal: Palette): Parts {
  const { wall, trim, roof, accent } = pal.lm;
  const g = pal.glass;
  const ao = { ao: true };
  const e = { emissive: true };
  const hipRoof = cone(1, 4, 2.42, 3.52, 0, 0, true);
  hipRoof
    .translate(0, -2.97, 0)
    .scale(3.1 * Math.SQRT2, 1, 1.5 * Math.SQRT2)
    .translate(0, 2.97, -7.6);
  const faces = [
    ["+z", -5.65, 0],
    ["+x", 0.65, -6.3],
  ] as const;
  return [
    P(box(-3.0, 3.0, 0.3, 2.3, -9.0, -6.2), wall, ao),
    P(box(-3.1, 3.1, 2.3, 2.42, -9.1, -6.1), trim),
    P(hipRoof, roof),
    P(box(-0.7, 0.7, 0.3, 3.9, -7.0, -5.6), wall, ao),
    P(box(-0.8, 0.8, 3.9, 4.02, -7.1, -5.5), trim),
    P(box(-0.65, 0.65, 4.02, 5.12, -6.95, -5.65), wall),
    P(cone(1.0, 4, 5.12, 6.72, 0, -6.3, true), roof),
    P(cyl(0.025, 0.025, 4, 6.72, 7.12, 0, -6.3), accent),
    P(ico(0.12, 0, 0, 7.2, -6.3), accent),
    ...faces.flatMap(([face, plane, u]) => [
      P(disc(face, plane, u, 4.57, 0.4, 16), pal.plaza, e),
      P(onFace(new RingGeometry(0.4, 0.48, 16), face, plane, u, 4.57), accent),
      P(hand(face, plane, u, 0.04, 0.32, Math.PI), pal.dark, e),
      P(hand(face, plane, u, 0.05, 0.22, (3 * Math.PI) / 4), pal.dark, e),
    ]),
    // 25 windows.
    ...grid([-2.5, -1.9, -1.3, 1.3, 1.9, 2.5], [0.95, 1.75], (x, y) =>
      P(quad("+z", -6.2, x, y, 0.32, 0.5), g),
    ),
    ...grid([-6.6, -7.2, -7.8, -8.4], [0.95, 1.75], (z, y) =>
      P(quad("+x", 3.0, z, y, 0.32, 0.5), g),
    ),
    P(quad("+z", -5.6, 0, 0.85, 0.5, 1.1), g),
    P(quad("+z", -5.6, 0, 2.3, 0.3, 0.6), g),
    P(quad("+z", -5.6, 0, 3.3, 0.3, 0.5), g),
    P(quad("+x", 0.7, -6.3, 2.3, 0.3, 0.6), g),
    P(quad("+x", 0.7, -6.3, 3.3, 0.3, 0.5), g),
  ];
}

export function buildLandmark(pal: Palette, archetype: LandmarkArchetype, colonnades: boolean) {
  const { trim } = pal.lm;
  return merge([
    P(box(-3.4, 3.4, 0, 0.3, -9.2, -5.5), trim, { ao: true }),
    P(box(-1.3, 1.3, 0, 0.15, -5.5, -5.2), trim, { ao: true }),
    ...(archetype === "spire-hall" ? spireHall(pal) : clockTower(pal)),
    ...(colonnades ? colonnade(pal) : []),
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
    window: status === "open" ? pal.lit : tone(pal.glass),
    goods: [tone(pal.player), tone(pal.npc), tone(pal.lm.accent)] as const,
  };
}

export function buildLibrary(pal: Palette, status: ZoneStatus) {
  const c = siteColours(pal, pal.lib, status);
  const open = status === "open";
  const lit = { emissive: open };
  const windowsX = [-10.0, -9.2, -8.4, -7.6];
  const parts: Parts = [
    P(box(-10.8, -6.2, 0, 0.25, 0.3, 3.7), c.trim, { ao: true }),
    P(box(-10.6, -7.0, 0.25, 2.55, 0.5, 3.5), c.wall, { ao: true }),
    ...[1.1, 1.7, 2.3, 2.9].map((z) => P(cyl(0.1, 0.12, 8, 0.25, 2.55, -6.55, z), c.wall)),
    P(box(-10.7, -6.3, 2.55, 2.75, 0.4, 3.6), c.trim),
    P(prismX(-10.75, -6.25, 0.35, 3.65, 2.75, 3.5), { top: c.roof, side: c.wall }),
    P(disc("+x", -6.25, 2.0, 3.0, 0.2, 12), c.window, lit),
    P(quad("+x", -7.0, 2.0, 0.95, 0.7, 1.4), c.window, lit),
    ...windowsX.flatMap((x) => [
      P(quad("+z", 3.5, x, 1.325, 0.44, 1.35), c.window, lit),
      P(arch("+z", 3.5, x, 2.0, 0.22), c.window, lit),
    ]),
  ];
  if (open) {
    // Coloured book spines behind each window, read as shelves through the glass.
    const spines = [pal.lib.roof, pal.lm.accent, pal.mk.roof, pal.wt.roof, pal.lib.trim];
    const rows = [
      { base: 0.75, heights: [0.55, 0.48, 0.6, 0.5, 0.56] },
      { base: 1.42, heights: [0.45, 0.5, 0.42, 0.52, 0.47] },
    ];
    for (const x of windowsX) {
      rows.forEach((row, r) => {
        row.heights.forEach((h, k) => {
          const spine = new PlaneGeometry(0.07, h).translate(
            x - 0.164 + 0.082 * k,
            row.base + h / 2,
            3.512,
          );
          parts.push(P(spine, spines[(k + 2 * r) % 5] ?? pal.lib.roof, { emissive: true }));
        });
      });
      const shelf = new PlaneGeometry(0.44, 0.03).translate(x, 1.39, 3.513);
      parts.push(P(shelf, pal.lib.trim, { emissive: true }));
    }
  } else {
    // Scaffolding on the south face, like the watchtower's (art §5.4 fallback).
    parts.push(
      ...[-10.0, -8.5, -7.0].map((x) =>
        P(box(x - 0.035, x + 0.035, 0.25, 2.85, 3.615, 3.685), c.trunk),
      ),
      ...[1.05, 2.05].map((y) => P(box(-10.6, -6.9, y, y + 0.06, 3.53, 3.83), c.trunk)),
    );
  }
  return merge(parts);
}

export function buildWatchtower(pal: Palette, status: ZoneStatus) {
  const c = siteColours(pal, pal.wt, status);
  const open = status === "open";
  const offsets = [-1.03, 0, 1.03];
  const merlons = grid(offsets, offsets, (dx, dz) => ({ dx, dz })).filter(
    ({ dx, dz }) => dx !== 0 || dz !== 0,
  );
  return merge([
    P(box(7.0, 10.0, 0, 0.25, 0.5, 3.5), c.trim, { ao: true }),
    P(box(7.8, 9.8, 0.25, 3.85, 0.7, 2.7), c.wall, { ao: true }),
    P(box(7.6, 10.0, 3.85, 4.05, 0.5, 2.9), c.trim),
    ...merlons.map(({ dx, dz }) => {
      const x = 8.8 + dx;
      const z = 1.7 + dz;
      return P(box(x - 0.17, x + 0.17, 4.05, 4.39, z - 0.17, z + 0.17), c.wall);
    }),
    P(box(8.2, 9.4, 4.05, 4.95, 1.1, 2.3), c.window, { emissive: open }),
    P(cone(1.06, 4, 4.95, 5.85, 8.8, 1.7, true), c.roof),
    P(cyl(0.03, 0.03, 4, 5.85, 6.4, 8.8, 1.7), c.trim),
    P(ico(0.1, 0, 8.8, 6.48, 1.7), c.accent),
    ...[1.4, 2.6].flatMap((y) => [
      P(quad("+z", 2.7, 8.8, y, 0.14, 0.6), c.glass),
      P(quad("+x", 9.8, 1.7, y, 0.14, 0.6), c.glass),
    ]),
    ...(open
      ? []
      : [
          ...[7.85, 8.8, 9.75].map((x) =>
            P(box(x - 0.035, x + 0.035, 0.25, 3.55, 2.915, 2.985), c.trunk),
          ),
          ...[1.35, 2.55].map((y) => P(box(7.75, 9.85, y, y + 0.06, 2.73, 3.03), c.trunk)),
        ]),
  ]);
}

export function buildMarket(pal: Palette, status: ZoneStatus) {
  const c = siteColours(pal, pal.mk, status);
  const stalls = [-1.6, 0, 1.6];
  const goods = [
    { size: 0.18, dx: -0.35 },
    { size: 0.26, dx: 0 },
    { size: 0.36, dx: 0.38 },
  ];
  return merge([
    P(box(-2.7, 2.7, 0, 0.2, 6.0, 9.2), c.trim, { ao: true }),
    ...grid([-2.45, -0.82, 0.82, 2.45], [6.25, 8.95], (x, z) =>
      P(box(x - 0.09, x + 0.09, 0.2, 2.0, z - 0.09, z + 0.09), c.wall),
    ),
    P(box(-2.85, 2.85, 2.0, 2.12, 5.9, 9.3), c.trim),
    P(prismX(-2.9, 2.9, 5.85, 9.35, 2.12, 3.1), { top: c.roof, side: c.wall }),
    ...stalls.map((x) => P(box(x - 0.6, x + 0.6, 0.2, 0.95, 7.3, 7.9), c.trunk)),
    ...stalls.flatMap((x) =>
      goods.map(({ size, dx }, i) => {
        const h = size / 2;
        const block = box(x + dx - h, x + dx + h, 0.95, 0.95 + size, 7.6 - h, 7.6 + h);
        return P(block, c.goods[i] ?? c.trunk);
      }),
    ),
    ...(status === "open"
      ? []
      : [
          ...[6.3, 7.6, 8.9].map((z) =>
            P(box(2.745, 2.815, 0, 2.9, z - 0.035, z + 0.035), c.trunk),
          ),
          ...[1.0, 2.0].map((y) => P(box(2.73, 3.03, y, y + 0.06, 6.2, 9.0), c.trunk)),
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

export function buildRoundTree(pal: Palette) {
  const crown = ico(0.78, 1, 0, 0, 0).scale(1, 1.12, 1).translate(0, 1.45, 0);
  return merge([L(cyl(0.09, 0.13, 6, 0, 0.75), pal.trunk), L(crown, pal.foliage)]);
}

export function buildCypress(pal: Palette) {
  return merge([L(cyl(0.07, 0.1, 6, 0, 0.4), pal.trunk), L(cone(0.42, 8, 0.3, 2.6), pal.cypress)]);
}

/** Segments of the always-present helpers drawn besides the built groups (art §3, §5.10). */
export const BLOB_SEGMENTS = 20;
export const RING_SEGMENTS = 40;
