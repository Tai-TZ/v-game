import {
  type BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Shape,
  Vector2,
  Vector3,
} from "three";

import type { CampusTheme, LandmarkArchetype } from "~/features/theme/schema";
import type { ZoneLocation } from "~/features/zones/schema";

import {
  arcPoint,
  BACK,
  BASE,
  COLONNADE_COLUMNS,
  COLONNADE_PIERS,
  CYPRESS_TREES,
  FOUNTAIN_WATER,
  GATE,
  LAKE,
  LANDMARK,
  NPCS,
  PARK_TREES,
  PATHS,
  PLAZA,
  PLAZA_RADIUS,
  ROSE_BEDS,
  ROUND_TREES,
  SITES,
  siteFor,
  SPEAKERS,
  type Box,
  type Vec2,
} from "../layout";
import { DRESSING, DRESSING_LAMPS } from "../dressing";
import type { SiteLook } from "../sites";
import { desaturate, shade, type BuildingPalette, type Palette } from "./palette";
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
  outward,
  part,
  quad,
  rect,
  ring,
  type Face,
  type PartStyle,
} from "./primitives";

/*
 * Procedural campus, built to campus-scene v0.2 §5 and v0.3 §6 with the helpers of art-direction
 * §5.0.
 * Each exported builder returns the merged geometry of one draw call. Coordinates are absolute
 * world units from layout.ts (D9).
 */

/** Stable pseudo-random in [0, 1) for an index and a seed. */
const hash = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

type Parts = BufferGeometry[];
/**
 * Part maker that bakes the palette's light preset; no colour keeps the vertex colours. With a
 * `windows` seed, after dark a share of the panes painted `pal.glass` (0.33 × darkness, picked by
 * a hash of the pane's index, so a pane lit at dusk stays lit at night) glows `litDim` instead:
 * the landmark and the back campus (weather-time-visuals §1.3). The zones keep N9.
 */
const paint = (pal: Palette, windows?: number) => {
  let pane = 0;
  return (
    geometry: BufferGeometry,
    color?: PartStyle["color"],
    flags: Omit<PartStyle, "color"> = {},
  ) => {
    if (windows !== undefined && color === pal.glass) {
      pane += 1;
      if (hash(pane, windows) < 0.33 * pal.darkness) {
        return part(geometry, { ...flags, color: pal.litDim, emissive: true }, pal.light);
      }
    }
    return part(geometry, { color, ...flags }, pal.light);
  };
};

const PI = Math.PI;
const SIDES = [-1, 1] as const;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const grid = <T>(xs: readonly number[], ys: readonly number[], f: (x: number, y: number) => T) =>
  xs.flatMap((x) => ys.map((y) => f(x, y)));

// --- Trees (shared by the terrain contact discs and the instanced meshes) -------------------

export interface TreeInstance {
  x: number;
  z: number;
  scale: number;
  scaleY: number;
  yaw: number;
  brightness: number;
  kind: "round" | "cypress";
}

/** Each list brings its kind and size factor; park trees are small round trees (v0.3 §6.5). */
const TREE_LISTS = [
  { trees: ROUND_TREES, kind: "round", factor: 1 },
  { trees: CYPRESS_TREES, kind: "cypress", factor: 1 },
  { trees: PARK_TREES, kind: "round", factor: 0.55 },
] as const;

export const TREE_INSTANCES: readonly TreeInstance[] = TREE_LISTS.flatMap(
  ({ trees, kind, factor }) => trees.map((tree) => ({ ...tree, kind, factor })),
).map(({ x, z, kind, factor }, i) => {
  const scale = factor * (0.9 + 0.22 * hash(i, 0));
  return {
    x,
    z,
    scale,
    scaleY: scale * (0.95 + 0.2 * hash(i, 1)),
    yaw: 2 * PI * hash(i, 2),
    brightness: 0.9 + 0.18 * hash(i, 3),
    kind,
  };
});

/** Front trees stand on bare ground; park trees on the park lawn and paths (y 0.010–0.011). */
const FRONT_TREES = ROUND_TREES.length + CYPRESS_TREES.length;

export function treeMatrix(tree: TreeInstance): Matrix4 {
  return new Matrix4().compose(
    new Vector3(tree.x, 0, tree.z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), tree.yaw),
    new Vector3(tree.scale, tree.scaleY, tree.scale),
  );
}

// --- Terrain, paths, plaza, fountain, lake, lamps (G-terrain) -------------------------------

/** Flat quad on the ground from four corners in order, one colour. */
function groundQuad(
  pal: Palette,
  [a, b, c, d]: readonly [Vec2, Vec2, Vec2, Vec2],
  y: number,
  color: Color,
) {
  return paint(pal)(
    groundTriangles(
      [a, b, c, a, c, d].map((p) => ({ ...p, color })),
      y,
    ),
  );
}

function skirt(footprint: Box, pal: Palette, y = 0.006) {
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
  return paint(pal)(groundTriangles(vertices, y));
}

function contactDisc(pal: Palette, tree: TreeInstance, y: number) {
  const color = pal.contact;
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
  return paint(pal)(groundTriangles(vertices, y));
}

/** Flat fan from `centre` through consecutive `points` (n − 1 triangles), one colour. */
function fan(
  pal: Palette,
  centre: Vec2,
  points: readonly Vec2[],
  y: number,
  color: Color,
  flags: Omit<PartStyle, "color"> = {},
) {
  const vertices = points
    .slice(1)
    .flatMap((p, i) => [centre, points[i] ?? p, p].map((q) => ({ ...q, color })));
  return paint(pal)(groundTriangles(vertices, y), undefined, flags);
}

/** Closed track outline: 13 points round (xc, za) bulging to +z, 13 round (xc, zb) to −z (v0.3 §6.0). */
function oval(xc: number, za: number, zb: number, r: number): Vec2[] {
  return range(26).map((i) => {
    const a = (PI * (i % 13)) / 12 + (i < 13 ? 0 : PI);
    return { x: xc + r * Math.cos(a), z: (i < 13 ? za : zb) + r * Math.sin(a) };
  });
}

function lamp({ x, z }: Vec2, pal: Palette): Parts {
  const P = paint(pal);
  return [
    P(cyl(0.045, 0.055, 6, 0, 1.6, x, z), pal.band),
    P(box(x - 0.1, x + 0.1, 1.6, 1.8, z - 0.1, z + 0.1), pal.lit, { emissive: true }),
    P(cone(0.17, 4, 1.8, 1.9, x, z, true), pal.band),
  ];
}

/** Statue on a pedestal: life size on the lawn walks, `small` in the fountain basin. */
function statue(x: number, z: number, pal: Palette, small = false): Parts {
  const P = paint(pal);
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

const LAKE_STEPS = 16;
const shore = (i: number, k: number, grow = 0): Vec2 => {
  const t = (PI / 2) * (i / LAKE_STEPS);
  return {
    x: LAKE.x - (k * LAKE.rx + grow) * Math.cos(t),
    z: LAKE.z - (k * LAKE.rz + grow) * Math.sin(t),
  };
};

/** Band between two lake ellipses (scale k, plus `grow` units outwards). */
function lakeBand(
  pal: Palette,
  k0: number,
  g0: number,
  k1: number,
  g1: number,
  y: number,
  color: Color,
) {
  return range(LAKE_STEPS).map((i) =>
    groundQuad(
      pal,
      [shore(i, k0, g0), shore(i, k1, g1), shore(i + 1, k1, g1), shore(i + 1, k0, g0)],
      y,
      color,
    ),
  );
}

/** Width of the static foam ring just inside the shore (N8). */
const FOAM = 0.22;

function lake(pal: Palette): Parts {
  const water = (p: Vec2) => ({ ...p, color: pal.water });
  // The water stops where the foam starts: side by side at one height, so they never z-fight.
  const fan = range(LAKE_STEPS).flatMap((i) => [
    water(LAKE),
    water(shore(i, 1, -FOAM)),
    water(shore(i + 1, 1, -FOAM)),
  ]);
  return [
    paint(pal)(groundTriangles(fan, 0.008)),
    ...lakeBand(pal, 1, -FOAM, 1, 0, 0.008, pal.foam),
    ...lakeBand(pal, 1, 0, 1, 0.14, 0.009, pal.lm.trim),
  ];
}

/** Fountain plaza: concentric paving, curved steps, hedge and roses, tiered basin, statues. */
function fountain(pal: Palette): Parts {
  const P = paint(pal);
  const { x: px, z: pz } = PLAZA;
  const { wall, trim } = pal.lm;
  const arm = new CylinderGeometry(0.025, 0.03, 0.36, 5)
    .rotateZ(-0.35)
    .translate(px + 0.13, 1.88, pz);
  return [
    P(cyl(PLAZA_RADIUS, PLAZA_RADIUS, 48, 0, 0.04, px, pz), pal.plaza),
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
    P(circle(FOUNTAIN_WATER, 32, px, 0.22, pz), pal.water),
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
  const P = paint(pal);
  return ROSE_BEDS.flatMap(([x0, z0]) => {
    return [
      P(box(x0, x0 + 2.6, 0, 0.14, z0, z0 + 1.5), pal.hedge),
      P(rect(x0 + 0.12, x0 + 2.48, z0 + 0.12, z0 + 1.38, 0.142), pal.foliage),
      ...[0.38, 0.92].map((dz) =>
        P(rect(x0 + 0.35, x0 + 2.25, z0 + dz, z0 + dz + 0.2, 0.143), pal.bloom),
      ),
    ];
  });
}

/** Balustrade across the lawn in front of the plaza, one run on each side of the axis. */
function balustrades(pal: Palette): Parts {
  const P = paint(pal);
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
        pal,
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

/** Lanes to the back, the back park, courts, running track and open-air stage (v0.3 §6.1). */
function backGrounds(pal: Palette): Parts {
  const P = paint(pal);
  const track = { xc: 12.0, za: -13.6, zb: -18.6 };
  const trackCentre = { x: track.xc, z: (track.za + track.zb) / 2 };
  /** The track outline at radius r, closed (27 points, 26 segments). */
  const loop = (r: number) => {
    const points = oval(track.xc, track.za, track.zb, r);
    return [...points, points[0] ?? trackCentre];
  };
  const laneLine = (r: number) => {
    const inner = loop(r - 0.02);
    const outer = loop(r + 0.02);
    const at = (points: Vec2[], i: number) => points[i] ?? trackCentre;
    return range(26).map((i) =>
      groundQuad(
        pal,
        [at(inner, i), at(outer, i), at(outer, i + 1), at(inner, i + 1)],
        0.0115,
        pal.plaza,
      ),
    );
  };
  const sand = range(13).map((i) => ({
    x: track.xc + 1.45 * Math.cos((PI * i) / 12),
    z: track.za + 1.45 * Math.sin((PI * i) / 12),
  }));
  const stage = [
    { r0: 0.3, r1: 0.55, y: 0.02, color: pal.lm.trim },
    { r0: 0.55, r1: 0.75, y: 0.1, color: pal.ground },
    { r0: 0.75, r1: 0.95, y: 0.18, color: pal.lm.trim },
  ];
  const courts = [
    { x0: 0.5, x1: 2.4 },
    { x0: 2.7, x1: 4.6 },
  ];
  return [
    // E1, E2, E4, E5, E7 lanes; E6 forecourt of the domed hall. E1 runs on to x 13.1 so the
    // corner at the lane mouth is paved.
    ...PATHS.back.map(([x0, x1, z0, z1]) => P(rect(x0, x1, z0, z1, 0.012), pal.path)),
    P(rect(4.6, 8.6, -12.85, -11.25, 0.012), pal.asphalt),
    P(rect(-1.3, -0.5, BASE.minZ, -16.6, 0.012), pal.path),
    // K1, K2: park lawn and its paths.
    P(rect(-14.6, -1.6, -21.4, -16.4, 0.01), pal.park),
    groundQuad(
      pal,
      [
        { x: -14.6, z: -17.1 },
        { x: -14.3, z: -16.9 },
        { x: -1.8, z: -21.4 },
        { x: -2.1, z: -21.4 },
      ],
      0.011,
      pal.path,
    ),
    P(rect(-14.6, -1.6, -19.45, -19.25, 0.011), pal.path),
    // S1, S2: two courts on a hedge-green surround, with nets.
    P(rect(0.2, 4.9, -21.1, -18.0, 0.01), pal.hedge),
    ...courts.flatMap(({ x0, x1 }) => [
      P(rect(x0, x1, -20.8, -18.3, 0.012), pal.court),
      P(rect(x0, x1, -19.57, -19.53, 0.013), pal.plaza),
    ]),
    // S3-S7: running track, striped pitch, sand at the near end, two lane lines.
    fan(pal, trackCentre, loop(2.1), 0.01, pal.track),
    fan(pal, trackCentre, loop(1.45), 0.011, pal.foliage),
    ...[1, 3, 5].map((k) =>
      P(rect(10.7, 13.3, track.zb + 0.833 * k, track.zb + 0.833 * (k + 1), 0.012), pal.cypress),
    ),
    fan(pal, { x: track.xc, z: track.za }, sand, 0.013, pal.sand),
    ...[1.88, 1.66].flatMap(laneLine),
    // S8: open-air stage, three solid half-ring tiers stepping up from the ground, on the +x side.
    ...stage.map(({ r0, r1, y, color }) =>
      P(arcSlab(r0, r1, 0, PI, 0, y, { x: 9.4, z: -12.25 }), color),
    ),
  ];
}

/** Back buildings fade 15% towards white after shading (v0.3 §5.2). */
const HAZE = 0.15;

/** Annex A and its glass bridges, building G, H, the domed hall B, chiller, carports, stand (§6.4). */
function backCampus(pal: Palette): Parts {
  const P = paint(pal, 4);
  const { wall, trim, roof, accent } = pal.lm;
  const g = pal.glass;
  const h = { haze: HAZE };
  const ha = { ao: true, haze: HAZE };
  const vault = new CylinderGeometry(1.9, 1.9, 4.6, 10, 1, false, 0, PI)
    .rotateZ(PI / 2)
    .scale(1, 1.12 / 1.9, 1)
    .translate(6.6, 1.58, -15.6);
  const pediment = new ExtrudeGeometry(
    new Shape([new Vector2(5.3, 1.56), new Vector2(7.9, 1.56), new Vector2(6.6, 2.0)]),
    { depth: 0.72, bevelEnabled: false },
  ).translate(0, 0, -13.6);
  /** Carport roof height: 0.36 at its middle, tilted 0.043 rad so the west end is higher. */
  const carportY = (x: number) => 0.36 - Math.tan(0.043) * (x + 13.1);
  /** Building H's bays on all four walls (D19). */
  const hallBays = [
    ...range(6).flatMap((k) => [
      ["+z", -13.3, -14.1 + 0.7 * k] as const,
      ["-z", -16.0, -14.1 + 0.7 * k] as const,
    ]),
    ...range(4).flatMap((k) => [
      ["+x", -10.3, -15.65 + 0.7 * k] as const,
      ["-x", -14.5, -15.65 + 0.7 * k] as const,
    ]),
  ];
  const steps = [
    { x0: 14.2, y1: 0.25 },
    { x0: 14.38, y1: 0.5 },
    { x0: 14.56, y1: 0.75 },
  ];
  return [
    // A1, A2: annex A with a paved roof and two lawn beds; two glass bridges to building G.
    P(box(-3.8, 3.8, 0, 1.3, -11.8, -10.15), wall, ha),
    P(box(-3.86, 3.86, 1.3, 1.36, -11.86, -10.1), trim, h),
    P(rect(-3.7, 3.7, -11.75, -10.2, 1.362), pal.sand, h),
    ...[-3.4, 0.5].map((x0) => P(rect(x0, x0 + 2.9, -11.5, -10.45, 1.364), pal.ground)),
    ...[-2.25, 1.0].flatMap((x) => [
      P(box(x - 0.27, x + 0.27, 1.36, 1.66, -13.1, -9.95), pal.water),
      P(box(x - 0.3, x + 0.3, 1.66, 1.7, -13.1, -9.95), trim, h),
    ]),
    // Annex A had no window on any wall: from behind it read as a white box (D17).
    ...range(12).map((k) => P(quad("-z", -11.8, -3.3 + 0.6 * k, 0.7, 0.26, 0.32), g, h)),
    ...grid(SIDES, [-11.4, -10.55], (s, z) =>
      P(quad(s > 0 ? "+x" : "-x", s * 3.8, z, 0.7, 0.26, 0.32), g, h),
    ),
    // GS1-GS4: building G with a solar roof and a skylight box.
    P(box(-2.6, 2.6, 0, 1.8, -16.6, -13.1), wall, ha),
    P(box(-2.66, 2.66, 1.8, 1.86, -16.66, -13.04), trim, h),
    P(rect(-2.55, 2.55, -16.55, -13.15, 1.862), roof, h),
    ...[-2.4, 0.55].flatMap((x0) => [
      P(rect(x0, x0 + 1.85, -16.3, -13.4, 1.864), pal.solar),
      ...[1, 2, 3].map((k) => {
        const zk = -16.3 + 0.725 * k;
        return P(rect(x0, x0 + 1.85, zk - 0.02, zk + 0.02, 1.866), trim, h);
      }),
    ]),
    P(box(-0.4, 0.4, 1.86, 2.14, -15.8, -13.9), roof, h),
    // Windows on all four walls (D18).
    ...SIDES.flatMap((s) => [
      ...grid([0.45, 1.05, 1.5], range(9), (y, k) =>
        P(quad(s > 0 ? "+z" : "-z", s > 0 ? -13.1 : -16.6, -2.2 + 0.55 * k, y, 0.26, 0.32), g, h),
      ),
      ...grid([0.45, 1.05, 1.5], range(5), (y, k) =>
        P(quad(s > 0 ? "+x" : "-x", s * 2.6, -16.1 + 0.65 * k, y, 0.26, 0.32), g, h),
      ),
    ]),
    // H1, H2: building H, ten bays of a tall arched window over a short one.
    P(box(-14.5, -10.3, 0, 1.5, -16.0, -13.3), wall, ha),
    P(box(-14.56, -10.24, 1.5, 1.57, -16.06, -13.24), trim, h),
    P(rect(-14.45, -10.35, -15.95, -13.35, 1.572), roof, h),
    ...hallBays.flatMap(([face, plane, u]) => [
      P(quad(face, plane, u, 0.4, 0.26, 0.36), g, h),
      P(quad(face, plane, u, 1.0, 0.26, 0.5), g, h),
      P(arch(face, plane, u, 1.25, 0.13), g, h),
    ]),
    // B1-B8: domed hall with a barrel vault, a six-column gold-banded portico and a pediment.
    P(box(4.2, 9.0, 0, 1.5, -17.6, -13.6), wall, ha),
    P(box(4.14, 9.06, 1.5, 1.58, -17.66, -13.54), trim, h),
    P(vault, pal.vault, h),
    P(box(5.25, 7.95, 0, 0.18, -13.6, -12.85), trim, h),
    ...range(6).flatMap((k) => {
      const x = 5.5 + 0.44 * k;
      return [
        P(cyl(0.075, 0.085, 6, 0.18, 1.4, x, -13.05), wall, h),
        P(cyl(0.095, 0.095, 6, 0.74, 0.82, x, -13.05), accent),
        P(cyl(0.1, 0.1, 6, 1.3, 1.4, x, -13.05), accent),
      ];
    }),
    P(box(5.3, 7.9, 1.4, 1.56, -13.6, -12.88), trim, h),
    P(pediment, { top: pal.vault, side: trim }, h),
    ...[4.65, 8.55].flatMap((x) => [
      P(box(x - 0.42, x + 0.42, 0, 1.95, -13.8, -13.1), wall, h),
      P(box(x - 0.3, x + 0.3, 1.95, 2.25, -13.68, -13.22), wall, h),
      P(box(x - 0.46, x + 0.46, 1.95, 2.0, -13.84, -13.06), trim, h),
    ]),
    // Arched windows east, west and at the back (D20); the portico is the front.
    ...[
      ...range(5).flatMap((k) => [
        ["+x", 9.0, -17.0 + 0.72 * k] as const,
        ["-x", 4.2, -17.0 + 0.72 * k] as const,
      ]),
      ...range(6).map((k) => ["-z", -17.6, 4.6 + 0.8 * k] as const),
    ].flatMap(([face, plane, u]) => [
      P(quad(face, plane, u, 0.62, 0.3, 0.55), g, h),
      P(arch(face, plane, u, 0.9, 0.15), g, h),
    ]),
    // C1: chiller plant with six fans.
    P(box(-6.9, -4.0, 0, 0.62, -18.6, -17.0), trim, h),
    ...grid([-6.35, -5.45, -4.55], [-18.2, -17.4], (x, z) =>
      P(circle(0.24, 8, x, 0.625, z), pal.band),
    ),
    // C2: two rows of solar carports; posts stop just under the tilted roof.
    ...[-11.95, -12.65].flatMap((z) => [
      P(
        new PlaneGeometry(2.8, 0.6)
          .rotateX(-PI / 2)
          .rotateZ(-0.043)
          .translate(-13.1, 0.36, z),
        pal.solar,
      ),
      ...[-14.2, -12.0].map((x) => P(cyl(0.03, 0.03, 4, 0, carportY(x) - 0.005, x, z), pal.dark)),
    ]),
    // S9: three-step stand with a solar canopy on three posts.
    ...steps.map(({ x0, y1 }) => P(box(x0, 14.75, 0, y1, -18.0, -14.2), trim, h)),
    P(box(14.1, 14.8, 1.1, 1.16, -18.1, -14.1), pal.solar),
    ...[-17.9, -16.1, -14.3].map((z) => P(cyl(0.03, 0.03, 4, 0.75, 1.1, 14.7, z), wall)),
  ];
}

// --- Sun shadow overlay (N8, 2026-10-08) -----------------------------------------------------

/** A convex block that casts a shadow, as 3D points (its corners, or a roof's apex). */
export type Caster = readonly Vector3[];

/** Box from the ground up to `top`: the shadow of its lower part hides under the building. */
function block(x0: number, x1: number, z0: number, z1: number, top: number): Caster {
  return grid([x0, x1], [z0, z1], (x, z) => [new Vector3(x, 0, z), new Vector3(x, top, z)]).flat();
}

/** Main building, the three zone buildings and the back of campus; their shapes never change. */
const CASTERS: readonly Caster[] = [
  block(-9.7, 9.7, -9.7, -6.2, 2.5),
  block(-3.06, 3.06, -9.9, -5.24, 3.02),
  ...[-9.05, -3.7, 3.7, 9.05].map((c) => block(c - 0.7, c + 0.7, -7.4, -6.0, 3.48)),
  block(-12.3, -8.85, -5.9, -0.7, 2.1),
  block(9.0, 11.8, -3.8, -1.2, 1.53),
  // Back to z −6.0 (the tower stops at −5.88): closes the 0.2 sliver of sun between it and the
  // east pavilion, which read as a rendering crack at dusk.
  block(9.6, 11.6, -6.0, -3.8, 3.57),
  block(9.8, 11.4, -5.6, -4.0, 4.25),
  block(10.05, 11.15, -5.35, -4.25, 4.82),
  block(10.3, 10.9, -5.1, -4.5, 5.58),
  block(10.5, 10.7, -4.9, -4.7, 6.19),
  block(6.95, 11.05, 2.55, 5.25, 1.95),
  block(7.55, 10.45, 3.0, 4.8, 2.42),
  block(-3.8, 3.8, -11.8, -10.15, 1.36),
  block(-2.6, 2.6, -16.6, -13.1, 1.86),
  block(-14.5, -10.3, -16.0, -13.3, 1.57),
  block(4.2, 9.0, -17.6, -13.6, 1.58),
  block(4.3, 8.9, -17.5, -13.7, 2.7),
  block(-6.9, -4.0, -18.6, -17.0, 0.62),
  block(14.2, 14.75, -18.0, -14.2, 1.16),
];

/** The tower of each landmark archetype: tiers, lantern and needle; or the hip roof and clock. */
const TOWER: Record<LandmarkArchetype, readonly Caster[]> = {
  "spire-hall": [
    block(-1.95, 1.95, -9.1, -6.1, 3.96),
    block(-1.83, 1.83, -9.0, -6.2, 5.0),
    block(-0.81, 0.81, -8.41, -6.79, 6.28),
    block(-0.42, 0.42, -8.02, -7.18, 8.3),
    block(-0.06, 0.06, -7.66, -7.54, 10.1),
  ],
  "clock-tower": [
    [
      ...grid([-3.12, 3.12], [-10.02, -5.18], (x, z) => new Vector3(x, 3.02, z)),
      new Vector3(0, 4.3, -7.6),
    ],
    block(-0.85, 0.85, -6.5, -4.8, 5.9),
    [
      ...grid([-0.78, 0.78], [-6.43, -4.87], (x, z) => new Vector3(x, 5.9, z)),
      new Vector3(0, 8.1, -5.65),
    ],
  ],
};

/** A box hanging from `y0` to `y1`: its shadow leaves the light through the opening below. */
function lintel(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Caster {
  return grid([x0, x1], [z0, z1], (x, z) => [new Vector3(x, y0, z), new Vector3(x, y1, z)]).flat();
}

/** The front gate (QA r2): the arch gate's solid middle, attic and wings; or the pier gateway. */
const GATES = {
  arch: [
    block(-1.82, 1.82, GATE.back, 12.5, 2.8),
    block(-1.16, 1.16, 11.7, 12.2, 3.0),
    block(-2.8, -1.54, 11.55, GATE.face, 1.78),
    block(1.54, 2.8, 11.55, GATE.face, 1.78),
  ],
  pier: [
    block(-1.7, -1.2, 11.9, 12.4, 1.4),
    block(1.2, 1.7, 11.9, 12.4, 1.4),
    lintel(-1.7, 1.7, 12.0, 12.3, 1.4, 1.58),
  ],
} as const;

const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** Convex hull, counter-clockwise (Andrew's monotone chain). */
function hull(points: readonly Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const half = (list: Vec2[]) => {
    const out: Vec2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2] ?? p, out[out.length - 1] ?? p, p) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

/** Clips a convex polygon to the base (Sutherland-Hodgman), so no shadow hangs off the edge. */
function clipToBase(polygon: Vec2[]): Vec2[] {
  const edges = [
    { axis: "x", limit: BASE.minX, keep: 1 },
    { axis: "x", limit: BASE.maxX, keep: -1 },
    { axis: "z", limit: BASE.minZ, keep: 1 },
    { axis: "z", limit: BASE.maxZ, keep: -1 },
  ] as const;
  let out = polygon;
  for (const { axis, limit, keep } of edges) {
    const inside = (p: Vec2) => (p[axis] - limit) * keep >= 0;
    const next: Vec2[] = [];
    out.forEach((p, i) => {
      const q = out[(i + 1) % out.length] ?? p;
      if (inside(p)) next.push(p);
      if (inside(p) !== inside(q)) {
        const t = (limit - p[axis]) / (q[axis] - p[axis]);
        next.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
      }
    });
    out = next;
  }
  return out;
}

/** Every building block that casts a sun shadow for this landmark (trees come on top). */
export const shadowCasters = (archetype: LandmarkArchetype, colonnades: boolean): Caster[] => [
  ...CASTERS,
  ...TOWER[archetype],
  ...GATES[colonnades ? "arch" : "pier"],
];

/** Every tree's crown, placed as the instanced meshes place it (QA r2). */
function crownCasters(): Caster[] {
  const crowns = { round: roundCrown(), cypress: cypressCrown() };
  const casters = TREE_INSTANCES.map((tree) => {
    const position = crowns[tree.kind].getAttribute("position");
    const matrix = treeMatrix(tree);
    return Array.from({ length: position.count }, (_, i) =>
      new Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix),
    );
  });
  for (const crown of Object.values(crowns)) crown.dispose();
  return casters;
}

/**
 * The bulky CC0 props' casters (dressing.ts `shade`): a box, or an octagon for a crown or canopy.
 * Static like the trees': if props.json fails, the shade stays, like the collision boxes.
 */
function propCasters(): Caster[] {
  return DRESSING.flatMap(({ shade, at }) =>
    shade
      ? at.map(([x, z]): Caster => {
          const [hx, hz] = shade.half;
          const [y0, y1] = shade.y;
          if (!shade.round) return lintel(x - hx, x + hx, z - hz, z + hz, y0, y1);
          return range(8).flatMap((i) =>
            [y0, y1].map(
              (y) =>
                new Vector3(x + hx * Math.cos((i * PI) / 4), y, z + hz * Math.sin((i * PI) / 4)),
            ),
          );
        })
      : [],
  );
}

/**
 * Trees whose crown centre a building hides from the sun (QA r3). Lambert trees take no shadow,
 * so CampusScene multiplies these by `pal.shadow`, the factor the ground under them gets. A
 * point at height h is in a caster's shadow when it lies inside the caster's part above h, cast
 * along the sun onto the plane y = h. Another tree's crown never darkens a tree.
 */
export function treesInShade(
  pal: Palette,
  archetype: LandmarkArchetype,
  colonnades: boolean,
): ReadonlySet<TreeInstance> {
  const { sun } = pal.light;
  if (!pal.sunShade) return new Set();
  const casters = shadowCasters(archetype, colonnades);
  return new Set(
    TREE_INSTANCES.filter((tree) => {
      // The round crown's middle, the cypress's widest part.
      const h = (tree.kind === "round" ? 1.55 : 0.6) * tree.scaleY;
      return casters.some((caster) => {
        if (!caster.some((p) => p.y > h)) return false;
        const outline = hull(
          caster.map((p) => {
            const rise = Math.max(p.y - h, 0);
            return { x: p.x - (sun.x / sun.y) * rise, z: p.z - (sun.z / sun.y) * rise };
          }),
        );
        return outline.every((a, i) => cross(a, outline[(i + 1) % outline.length] ?? a, tree) >= 0);
      });
    }),
  );
}

/** Shadow overlay height: 0.0005 over the highest ground layer (sand, lane lines, 0.0135). */
export const SHADOW_Y = 0.014;

/**
 * Every caster's shadow (buildings, gate, tree crowns, bulky props) cast along the sun onto the ground (hull
 * of the projected points, clipped to the base), one colour: the multiply factor `pal.shadow`.
 * CampusScene draws it over all ground layers with multiply blending, so grass, paths, plaza and
 * lake all darken, and with a stencil test, so ground under two overlapping shadow polygons
 * darkens once. One draw call.
 */
export function buildShadows(
  pal: Palette,
  archetype: LandmarkArchetype,
  colonnades: boolean,
): BufferGeometry {
  const { sun } = pal.light;
  // Overcast: no sun, no shadow (the empty geometry draws nothing).
  if (!pal.sunShade) return groundTriangles([], SHADOW_Y);
  const onGround = (p: Vector3): Vec2 => ({
    x: p.x - (sun.x / sun.y) * p.y,
    z: p.z - (sun.z / sun.y) * p.y,
  });
  const vertices = [...shadowCasters(archetype, colonnades), ...crownCasters(), ...propCasters()]
    .map((caster) => clipToBase(hull(caster.map(onGround))))
    .filter((outline) => outline.length >= 3)
    .flatMap((outline) => {
      const first = outline[0] ?? { x: 0, z: 0 };
      return outline
        .slice(1, -1)
        .flatMap((p, i) =>
          [first, p, outline[i + 2] ?? p].map((q) => ({ ...q, color: pal.shadow })),
        );
    });
  return groundTriangles(vertices, SHADOW_Y);
}

/** Height of the speakers' ground discs: over every path layer, under the shadow overlay. */
export const SPEAKER_DISC_Y = 0.0135;
export const SPEAKER_DISC_SEGMENTS = 16;

/**
 * A baked disc under each person (floor × 0.8, like `contact`), in place of a blob mesh. After
 * dark it is a pool of warm light 2.2 times as wide, the person standing in it (§1.4).
 */
function speakerDiscs(pal: Palette): Parts {
  const pool = pal.darkness >= 0.5;
  const top = shade(new Vector3(0, 1, 0), pal.light);
  const floor = {
    lan: pal.ground,
    registrar: pal.path,
    guard: pal.path,
    examiner: pal.asphalt,
    operator: pal.ground,
  };
  return SPEAKERS.map(({ id, spot }) => {
    const r = (id === "lan" ? 0.4 : 0.36) * (pool ? 2.2 : 1);
    const rim = range(SPEAKER_DISC_SEGMENTS + 1).map((i) => {
      const a = (i / SPEAKER_DISC_SEGMENTS) * 2 * PI;
      return { x: spot.x + Math.cos(a) * r, z: spot.z + Math.sin(a) * r };
    });
    return pool
      ? fan(pal, spot, rim, SPEAKER_DISC_Y, floor[id].clone().multiply(top).add(pal.glow), {
          emissive: true,
        })
      : fan(pal, spot, rim, SPEAKER_DISC_Y, floor[id].clone().multiplyScalar(0.8));
  });
}

export function buildTerrain(pal: Palette, colonnades: boolean): BufferGeometry {
  const P = paint(pal);
  const { minX, maxX, minZ, maxZ } = BASE;
  const lamps: Vec2[] = [
    // East lane to the back (v0.3 E3).
    { x: 13.4, z: -3.0 },
    { x: 13.4, z: -7.0 },
    ...SIDES.flatMap((s) => [
      { x: s * 3.55, z: -3.7 },
      arcPoint(s * 0.3 * PI, 4.6),
      arcPoint(s * 0.75 * PI, 4.6),
    ]),
    // Without colonnades the hedge arcs get lamps instead.
    ...(colonnades ? [] : SIDES.flatMap((s) => [0.37, 0.66].map((k) => arcPoint(s * k * PI, 3.4)))),
    ...DRESSING_LAMPS,
  ];
  const statues = [
    ...grid([-3.05, 3.05], [-1.35, -0.45, 0.45, 1.35], (x, z) => ({ x, z })),
    ...grid([-3.3, 3.3], [-2.05, -5.5], (x, z) => ({ x, z })),
  ];
  return merge([
    P(box(minX, maxX, -0.6, 0, minZ, maxZ), { top: pal.ground, side: pal.soil }),
    P(box(minX - 0.25, maxX + 0.25, -0.8, -0.6, minZ - 0.25, maxZ + 0.25), pal.plaza),
    ...PATHS.low.map(([x0, x1, z0, z1]) => P(rect(x0, x1, z0, z1, 0.011), pal.path)),
    ...PATHS.front.map(([x0, x1, z0, z1]) => P(rect(x0, x1, z0, z1, 0.012), pal.path)),
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
    // Back skirts sit just above the park lawn (0.010) and under the lanes (0.012).
    ...[BACK.annex, BACK.solarHall, BACK.westHall, BACK.hall, BACK.chiller].map((f) =>
      skirt(f, pal, 0.0105),
    ),
    ...TREE_INSTANCES.map((tree, i) => contactDisc(pal, tree, i < FRONT_TREES ? 0.006 : 0.0125)),
    ...speakerDiscs(pal),
    ...backGrounds(pal),
    ...backCampus(pal),
  ]);
}

// --- Landmark: shared U-shaped main building, tower archetype, colonnades (G-landmark) -------

/** Base, porch floor and steps; the stepped tower base; two wings; four pavilions (§5.2). */
function mainBuilding(pal: Palette): Parts {
  const P = paint(pal, 1);
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
    // The strip over each wing roof (D3: west too), and the back above annex A, which hides it
    // up to y 1.36 (D3).
    ...SIDES.flatMap((s) =>
      range(6).map((k) =>
        P(quad(s > 0 ? "+x" : "-x", s * 3.0, -9.6 + 0.4 * k, 2.57, 0.2, 0.36), g),
      ),
    ),
    ...grid(
      range(14).map((k) => -2.6 + 0.4 * k),
      [1.92, 2.57],
      (x, y) => P(quad("-z", -9.9, x, y, 0.2, 0.36), g),
    ),
  ];
  for (const s of SIDES) {
    const [x0, x1] = s < 0 ? [-9.7, -3.0] : [3.0, 9.7];
    parts.push(
      P(box(x0, x1, 0.3, 2.25, -9.7, -6.2), wall, ao),
      P(box(x0 - 0.05, x1 + 0.05, 2.25, 2.37, -9.75, -6.15), trim),
      P(rect(x0 + 0.12, x1 - 0.12, -9.63, -6.27, 2.372), roof),
      P(box(x0 - 0.05, x1 + 0.05, 2.37, 2.5, -6.27, -6.15), wall),
      // Front and back alike (D1): string courses and nine bays.
      ...[0.92, 1.57].flatMap((y) => [
        P(box(x0, x1, y, y + 0.04, -6.2, -6.16), trim),
        P(box(x0, x1, y, y + 0.04, -9.74, -9.7), trim),
      ]),
      ...range(9).flatMap((i) => {
        const x = s * (4.6 + 0.42 * i);
        return (
          [
            ["+z", -6.2],
            ["-z", -9.7],
          ] as const
        ).flatMap(([face, plane]) => [
          P(quad(face, plane, x, 1.27, 0.16, 0.4), g),
          P(quad(face, plane, x, 1.92, 0.16, 0.4), g),
          P(quad(face, plane, x, 0.55, 0.16, 0.34), g),
          P(arch(face, plane, x, 0.72, 0.08), g),
        ]);
      }),
      // The gable end of each wing: east, and west (D2).
      ...grid(range(5), [0.62, 1.27, 1.92], (i, y) =>
        P(quad(s > 0 ? "+x" : "-x", s * 9.7, -9.4 + 0.42 * i, y, 0.16, 0.4), g),
      ),
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
      // The kiosk's window on all four sides (D6).
      ...(
        [
          ["+z", -6.44, c],
          ["-z", -6.96, c],
          ["+x", c + 0.26, -6.7],
          ["-x", c - 0.26, -6.7],
        ] as const
      ).flatMap(([face, plane, u]) => [
        P(quad(face, plane, u, 3.25, 0.14, 0.2), g),
        P(arch(face, plane, u, 3.35, 0.07), g),
      ]),
      ...grid([c - 0.28, c + 0.28], floors, (x, y) => P(quad("+z", -6.0, x, y, 0.18, 0.38), g)),
      // The back shows only above the wing roof (D5).
      ...[c - 0.28, c + 0.28].map((x) => P(quad("-z", -7.4, x, 2.61, 0.18, 0.38), g)),
      // The outer side: east on the east wing, west on the west wing (D4).
      ...grid([-7.0, -6.4], floors, (z, y) =>
        P(quad(c > 0 ? "+x" : "-x", c + Math.sign(c) * 0.7, z, y, 0.18, 0.38), g),
      ),
    );
  }
  return parts;
}

/** Stepped tower with a lantern, cup, needle spire and sun star (§5.3). */
function spireHall(pal: Palette): Parts {
  const P = paint(pal, 2);
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
    // Parterre round the tower base roof, front and back, east and west (v0.3 §6.3, D8), and a
    // lawn on wing E.
    ...[
      [-3.0, -1.9],
      [-1.6, -0.45],
      [0.45, 1.6],
      [1.9, 3.0],
    ].flatMap(([x0 = 0, x1 = 0]) => [
      P(rect(x0, x1, -6.0, -5.3, 3.024), pal.ground),
      P(rect(x0, x1, -9.9, -9.2, 3.024), pal.ground),
    ]),
    ...[
      [-9.9, -8.1],
      [-7.1, -6.2],
    ].flatMap(([z0 = 0, z1 = 0]) => [
      P(rect(2.05, 3.0, z0, z1, 3.024), pal.ground),
      P(rect(-3.0, -2.05, z0, z1, 3.024), pal.ground),
    ]),
    // Half rose beds on the middle of each strip, curving in from the roof edge.
    ...[
      { x: 0, z: -5.3, from: 0 },
      { x: 3.0, z: -7.6, from: PI / 2 },
      { x: 0, z: -9.9, from: PI },
      { x: -3.0, z: -7.6, from: -PI / 2 },
    ].map(({ x, z, from }) =>
      P(new CircleGeometry(0.42, 8, from, PI).rotateX(-PI / 2).translate(x, 3.026, z), pal.bloom),
    ),
    ...[
      [4.6, 6.2],
      [6.5, 8.1],
    ].map(([x0 = 0, x1 = 0]) => P(rect(x0, x1, -9.35, -6.5, 2.374), pal.ground)),
    P(box(-1.65, 1.65, 1.3, 1.46, -5.3, -4.22), trim),
    P(quad("+z", -5.3, 0, 0.75, 1.0, 0.9), g),
    // Tier 2; tiers 2 to 4 have windows on all four sides (D7).
    P(box(-1.95, 1.95, 3.02, 3.8, -9.1, -6.1), wall),
    P(box(-2.03, 2.03, 3.8, 3.96, -9.18, -6.02), trim),
    ...SIDES.flatMap((s) => [
      ...range(9).map((k) =>
        P(quad(s > 0 ? "+z" : "-z", s > 0 ? -6.1 : -9.1, -1.6 + 0.4 * k, 3.41, 0.2, 0.4), g),
      ),
      ...range(7).map((k) =>
        P(quad(s > 0 ? "+x" : "-x", s * 1.95, -8.8 + 0.4 * k, 3.41, 0.2, 0.4), g),
      ),
    ]),
    // Tier 3, roof garden and corner kiosks.
    P(box(-1.83, 1.83, 3.96, 4.9, -9.0, -6.2), wall),
    P(box(-1.9, 1.9, 4.9, 5.0, -9.07, -6.13), trim),
    ...SIDES.flatMap((s) => [
      ...grid(range(9), [4.2, 4.62], (k, y) =>
        P(quad(s > 0 ? "+z" : "-z", s > 0 ? -6.2 : -9.0, -1.4 + 0.35 * k, y, 0.18, 0.28), g),
      ),
      ...grid(range(7), [4.2, 4.62], (k, y) =>
        P(quad(s > 0 ? "+x" : "-x", s * 1.83, -8.7 + 0.37 * k, y, 0.18, 0.28), g),
      ),
    ]),
    P(rect(-1.75, 1.75, -8.95, -6.25, 5.003), pal.lm.roof),
    P(rect(-1.75, 1.75, -6.5, -6.25, 5.004), pal.hedge),
    ...grid([-1.55, 1.55], [-8.75, -6.45], (kx, kz) => [
      P(box(kx - 0.17, kx + 0.17, 5.0, 5.42, kz - 0.17, kz + 0.17), wall),
      P(cone(0.26, 4, 5.42, 5.6, kx, kz, true), trim),
    ]).flat(),
    // Tier 4 with tall arched openings.
    P(box(-0.81, 0.81, 5.0, 6.2, -8.41, -6.79), wall),
    ...(
      [
        ["+z", -6.79, 0],
        ["-z", -8.41, 0],
        ["+x", 0.81, cz],
        ["-x", -0.81, cz],
      ] as const
    ).flatMap(([face, plane, u]) => [
      P(quad(face, plane, u, 5.5, 0.34, 0.62), g),
      P(arch(face, plane, u, 5.81, 0.17), g),
    ]),
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
  face: Face,
  plane: number,
  u: number,
  v: number,
  width: number,
  length: number,
  angle: number,
) {
  const geometry = new PlaneGeometry(width, length).translate(0, length / 2, 0).rotateZ(-angle);
  // One more 0.01 out than the dial, on whichever side of the wall "out" is.
  return onFace(geometry, face, plane + outward(face), u, v);
}

/** Town hall: hip roof on the shared tower base and a clock tower in front (§5.4). */
function clockTower(pal: Palette): Parts {
  const P = paint(pal, 3);
  const { wall, trim, roof, accent } = pal.lm;
  const g = pal.glass;
  const e = { emissive: true };
  const hipRoof = new ConeGeometry(1, 1.28, 4)
    .rotateY(PI / 4)
    .scale(3.12 * Math.SQRT2, 1, 2.42 * Math.SQRT2)
    .translate(0, 3.02 + 0.64, -7.6);
  const v = 5.31;
  // A dial on every side of the clock box (D9); each still reads 4:30 (orbit-camera §5.3).
  const faces = [
    ["+z", -4.9, 0],
    ["+x", 0.75, -5.65],
    ["-z", -6.4, 0],
    ["-x", -0.75, -5.65],
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
      P(quad("-x", -0.85, -5.65, y, 0.3, h), g),
    ]),
  ];
}

/** Two curved double colonnades around the plaza, each closed by a square pier (§5.5). */
function colonnade(pal: Palette): Parts {
  const P = paint(pal);
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
  const P = paint(pal);
  return SIDES.map((s) => P(arcSlab(3.25, 3.55, s * 0.36 * PI, s * 0.68 * PI, 0, 0.3), pal.hedge));
}

/** Three-arch gate with paired columns and plain gold bands, and a stone-and-iron fence (§6.2). */
function archGate(pal: Palette): Parts {
  const P = paint(pal);
  const { wall, trim, accent } = pal.lm;
  const fz = GATE.face;
  const iron = pal.iron;
  const ao = { ao: true };
  const span = (s: number, a: number, b: number) => [
    Math.min(s * a, s * b),
    Math.max(s * a, s * b),
  ];
  const fenceRuns = [
    [-14.55, -2.66],
    [2.66, 6.4],
  ];
  const fencePiers = [...range(12).map((k) => -14.55 + k), ...range(4).map((k) => 3.4 + k)];
  return [
    P(box(-1.54, 1.54, 0, 2.62, 11.5, fz), wall, ao),
    P(box(-1.82, 1.82, 2.62, 2.8, GATE.back, 12.5), trim),
    P(quad("+z", fz, 0, 2.57, 3.08, 0.05), accent),
    P(box(-1.16, 1.16, 2.8, 3.0, 11.7, 12.2), wall),
    P(quad("+z", fz, 0, 0.63, 1.29, 1.26), iron),
    P(arch("+z", fz, 0, 1.26, 0.645), iron),
    P(quad("+z", fz, 0, 2.1, 3.08, 0.08), accent),
    P(box(-0.14, 0.14, 1.93, 2.2, fz, fz + 0.05), accent),
    // The arches and the gold band seen from the campus side (D10): from 135° to 225° the gate
    // read as a solid wall.
    P(quad("-z", 11.5, 0, 0.63, 1.29, 1.26), iron),
    P(arch("-z", 11.5, 0, 1.26, 0.645), iron),
    P(quad("-z", 11.5, 0, 2.1, 3.08, 0.08), accent),
    ...[-1.28, -0.86, 0.86, 1.28].flatMap((x) => [
      P(box(x - 0.12, x + 0.12, 0, 0.3, fz, BASE.maxZ), trim),
      P(box(x - 0.125, x + 0.125, 0.22, 0.27, fz, BASE.maxZ + 0.005), accent),
      P(cyl(0.08, 0.09, 8, 0.3, 1.98, x, 12.51), wall),
      P(box(x - 0.12, x + 0.12, 1.98, 2.06, fz, BASE.maxZ), trim),
    ]),
    ...SIDES.flatMap((s) => {
      const [x0 = 0, x1 = 0] = span(s, 1.54, 2.66);
      const [c0 = 0, c1 = 0] = span(s, 1.54, 2.8);
      return [
        P(box(x0, x1, 0, 1.66, 11.6, 12.36), wall, ao),
        P(box(c0, c1, 1.66, 1.78, 11.55, fz), trim),
        P(quad("+z", 12.36, s * 2.1, 0.405, 0.67, 0.81), iron),
        P(arch("+z", 12.36, s * 2.1, 0.81, 0.335), iron),
        P(quad("-z", 11.6, s * 2.1, 0.405, 0.67, 0.81), iron),
        P(arch("-z", 11.6, s * 2.1, 0.81, 0.335), iron),
      ];
    }),
    ...fenceRuns.flatMap(([x0 = 0, x1 = 0]) => [
      P(box(x0, x1, 0, 0.06, 12.38, 12.52), wall),
      P(box(x0, x1, 0.06, 0.26, 12.44, 12.46), iron),
    ]),
    ...fencePiers.map((x) => P(box(x - 0.07, x + 0.07, 0, 0.32, 12.36, 12.54), wall)),
  ];
}

/** Town gateway: two open piers under a roof-coloured lintel, and a clipped hedge fence (§6.2). */
function pierGate(pal: Palette): Parts {
  const P = paint(pal);
  const { wall, trim, roof } = pal.lm;
  return [
    ...SIDES.flatMap((s) => {
      const [x0, x1] = s < 0 ? [-1.65, -1.25] : [1.25, 1.65];
      return [
        P(box(x0, x1, 0, 1.3, 11.95, 12.35), wall, { ao: true }),
        P(box(x0 - 0.05, x1 + 0.05, 1.3, 1.4, 11.9, 12.4), trim),
      ];
    }),
    P(box(-1.7, 1.7, 1.4, 1.58, 12.0, 12.3), roof),
    ...[
      [-14.55, -1.7],
      [1.7, 6.4],
    ].map(([x0 = 0, x1 = 0]) => P(box(x0, x1, 0, 0.26, 12.36, 12.56), pal.hedge)),
  ];
}

export function buildLandmark(pal: Palette, archetype: LandmarkArchetype, colonnades: boolean) {
  return merge([
    ...mainBuilding(pal),
    ...(archetype === "spire-hall" ? spireHall(pal) : clockTower(pal)),
    ...(colonnades ? [...colonnade(pal), ...archGate(pal)] : [...hedgeArcs(pal), ...pierGate(pal)]),
  ]);
}

// --- Zone buildings (G-library, G-watchtower, G-market) --------------------------------------

/** Building colours for a look: "coming soon" desaturates everything in the group. */
function siteColours(pal: Palette, own: BuildingPalette, look: SiteLook) {
  const tone = (c: Color) => (look === "coming_soon" ? desaturate(c) : c);
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
    /** Lit for a starred zone (N9); otherwise glass like every other window. */
    window: look === "lit" ? pal.lit : tone(pal.glass),
    goods: [tone(pal.player), tone(pal.npc), tone(pal.lm.accent)] as const,
  };
}

/**
 * Two lit lamps flanking an open zone's door (QA r2, 2026-10-08): the welcome the camera always
 * sees, since the watchtower and market doors face away from it (art §1.2 rule 7).
 */
function entranceLamps(pal: Palette, id: ZoneLocation, look: SiteLook): Parts {
  if (look === "coming_soon") return [];
  return entranceLampSpots(id).flatMap((spot) => lamp(spot, pal));
}

/**
 * Where the two entrance lamps of a zone stand: 0.6 either side of its walk, `out` along it from
 * the door. The library's door faces the camera, so its lamps stand 2.8 out, past the librarian:
 * at 0 the near lamp stood against the lit door on screen and the far one behind the "!" badge
 * (QA r3). The other doors face away from the camera.
 */
export function entranceLampSpots(id: ZoneLocation): Vec2[] {
  const { door, facing } = siteFor(id);
  const out = id === "library" ? 2.8 : 0;
  return SIDES.map((s) => ({
    x: door.x + out * Math.sin(facing) + s * 0.6 * Math.cos(facing),
    z: door.z + out * Math.cos(facing) - s * 0.6 * Math.sin(facing),
  }));
}

/** The library's front and back walls, which carry the tall windows. */
const TALL_FACES = [
  ["+z", -0.8],
  ["-z", -5.8],
] as const;

/**
 * Two-storey hall: gold-banded portico, arched windows, roof garden (§5.6). Open: the door is
 * lit. Lit (a level has a star, N9): the windows light up and show the shelves of books.
 */
export function buildLibrary(pal: Palette, look: SiteLook) {
  const P = paint(pal);
  const c = siteColours(pal, pal.lib, look);
  const open = look !== "coming_soon";
  const door = open ? pal.lit : c.glass;
  const lit = { emissive: look === "lit" };
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
    P(quad("+x", -9.4, -2.8, 0.7, 0.6, 0.9), door, { emissive: open }),
    P(arch("+x", -9.4, -2.8, 1.15, 0.3), door, { emissive: open }),
    P(box(-9.4, -8.6, 1.42, 1.48, -3.4, -2.2), c.roof),
    // East bays beside the door; the west wall has a bay where the door would be (D11).
    ...[
      ...[-4.8, -4.0, -1.6].map((z) => ["+x", -9.4, z] as const),
      ...[-4.8, -4.0, -2.8, -1.6].map((z) => ["-x", -12.2, z] as const),
    ].flatMap(([face, plane, z]) => [
      P(quad(face, plane, z, 0.65, 0.3, 0.55), c.window, lit),
      P(quad(face, plane, z, 1.4, 0.3, 0.45), c.window, lit),
      P(arch(face, plane, z, 1.625, 0.15), c.window, lit),
    ]),
    // Tall windows on the front and the back (D11).
    ...TALL_FACES.flatMap(([face, plane]) =>
      tall.flatMap((x) => [
        P(quad(face, plane, x, 0.95, 0.44, 1.25), c.window, lit),
        P(arch(face, plane, x, 1.575, 0.22), c.window, lit),
      ]),
    ),
    ...entranceLamps(pal, "library", look),
  ];
  if (look === "lit") {
    // Coloured book spines behind each tall window, read as shelves through the glass.
    const spines = [pal.lib.roof, pal.lm.accent, pal.mk.roof, pal.wt.roof, pal.lib.trim];
    const rows = [
      { base: 0.42, heights: [0.5, 0.44, 0.55, 0.46, 0.52] },
      { base: 1.0, heights: [0.42, 0.46, 0.39, 0.48, 0.44] },
    ];
    // Just past the glass (0.002 and 0.003), on whichever side of the wall is out.
    for (const [face, plane] of TALL_FACES) {
      for (const x of tall) {
        rows.forEach((row, r) => {
          row.heights.forEach((h, k) => {
            const spine = new PlaneGeometry(0.07, h).translate(0, 0, 0.002);
            onFace(spine, face, plane, x - 0.164 + 0.082 * k, row.base + h / 2);
            parts.push(P(spine, spines[(k + 2 * r) % 5] ?? pal.lib.roof, { emissive: true }));
          });
        });
        const shelf = new PlaneGeometry(0.44, 0.03).translate(0, 0, 0.003);
        parts.push(P(onFace(shelf, face, plane, x, 0.99), pal.lib.trim, { emissive: true }));
      }
    }
  }
  if (!open) {
    // Scaffolding on the front and, mirrored through the hall, the back (D12): every view but
    // exactly 90 and 270 degrees then shows one (art §1.2 rule 4).
    for (const [p0, p1, b0, b1] of [
      [-0.715, -0.645, -0.75, -0.5],
      [-5.955, -5.885, -6.1, -5.85],
    ] as const) {
      parts.push(
        ...[-11.9, -10.8, -9.7].map((x) =>
          P(box(x - 0.035, x + 0.035, 0.25, 2.15, p0, p1), c.trunk),
        ),
        ...[0.85, 1.55].map((y) => P(box(-12.2, -9.4, y, y + 0.06, b0, b1), c.trunk)),
      );
    }
  }
  return merge(parts);
}

/** A wing pavilion enlarged into a four-tier tower, with a lobby in front (§5.7). */
export function buildWatchtower(pal: Palette, look: SiteLook) {
  const P = paint(pal);
  const c = siteColours(pal, pal.wt, look);
  const open = look !== "coming_soon";
  const ao = { ao: true };
  const slot = { emissive: look === "lit" };
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
    // The lamp slot under the cap, on all four sides (D13).
    ...(
      [
        ["+z", -4.5, 10.6],
        ["-z", -5.1, 10.6],
        ["+x", 10.9, -4.8],
        ["-x", 10.3, -4.8],
      ] as const
    ).flatMap(([face, plane, u]) => [
      P(quad(face, plane, u, 5.08, 0.16, 0.34), c.window, slot),
      P(arch(face, plane, u, 5.25, 0.08), c.window, slot),
    ]),
    P(cone(0.42, 4, 5.58, 6.05, 10.6, -4.8, true), c.roof),
    P(ico(0.07, 0, 10.6, 6.12, -4.8), c.accent),
    ...grid([10.2, 11.0], [1.95, 2.75], (x, y) => P(quad("+z", -3.8, x, y, 0.2, 0.42), c.glass)),
    // Tower windows on the east and, mirrored, the west and the back (D13).
    ...SIDES.flatMap((s) =>
      grid([-5.2, -4.4], [0.65, 1.45, 2.25, 3.05], (z, y) =>
        P(quad(s > 0 ? "+x" : "-x", s > 0 ? 11.6 : 9.6, z, y, 0.2, 0.42), c.glass),
      ),
    ),
    ...grid([10.2, 11.0], [0.65, 1.45, 2.25, 3.05], (x, y) =>
      P(quad("-z", -5.8, x, y, 0.2, 0.42), c.glass),
    ),
    ...[9.6, 10.4, 11.2].map((x) => P(quad("+z", -1.2, x, 0.75, 0.3, 0.5), c.glass)),
    ...[-3.2, -2.4, -1.6].map((z) => P(quad("+x", 11.8, z, 0.75, 0.3, 0.5), c.glass)),
    // The real entrance faces the plaza (D13): lit while the zone is open, like the library's.
    P(quad("-x", 9.0, -2.8, 0.7, 0.6, 0.9), open ? pal.lit : c.glass, { emissive: open }),
    ...[-3.45, -2.15].map((z) => P(quad("-x", 9.0, z, 0.75, 0.3, 0.5), c.glass)),
    ...entranceLamps(pal, "watchtower", look),
    // Scaffolding on the tower's front and, mirrored through it (z -4.8), its back (D14).
    ...(open
      ? []
      : (
          [
            [-3.715, -3.645, -3.75, -3.5],
            [-5.955, -5.885, -6.1, -5.85],
          ] as const
        ).flatMap(([p0, p1, b0, b1]) => [
          ...[9.7, 10.6, 11.5].map((x) =>
            P(box(x - 0.035, x + 0.035, 1.53, 3.55, p0, p1), c.trunk),
          ),
          ...[2.1, 2.9].map((y) => P(box(9.6, 11.6, y, y + 0.06, b0, b1), c.trunk)),
        ])),
  ]);
}

/** Open market hall by the lake: white columns, flat roof, awnings, three stalls (§5.8). */
export function buildMarket(pal: Palette, look: SiteLook) {
  const P = paint(pal);
  const c = siteColours(pal, pal.mk, look);
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
    // North awning, the south one turned round (D15): seen from behind, the fair keeps its red.
    P(new PlaneGeometry(3.9, 0.646).rotateX(-PI / 2 - tilt).translate(9.0, 1.5, 2.25), c.roof),
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
    ...entranceLamps(pal, "market", look),
    // Lit (a level has a star, N9): lanterns under the outer edge of the south and east awnings.
    ...(look === "lit"
      ? [
          ...stalls.map((x) => box(x - 0.08, x + 0.08, 1.12, 1.28, 5.7, 5.86)),
          ...[3.3, 4.5].map((z) => box(11.55, 11.71, 1.12, 1.28, z - 0.08, z + 0.08)),
        ].map((lantern) => P(lantern, pal.lit, { emissive: true }))
      : []),
    // Scaffolding on the east and, mirrored through the hall (x 9.0), across the west entrance
    // (D16): "not open yet", though not an obstacle.
    ...(look !== "coming_soon"
      ? []
      : (
          [
            [11.06, 11.13, 11.05, 11.3],
            [6.87, 6.94, 6.7, 6.95],
          ] as const
        ).flatMap(([p0, p1, b0, b1]) => [
          ...[2.8, 3.9, 5.0].map((z) => P(box(p0, p1, 0, 2.3, z - 0.035, z + 0.035), c.trunk)),
          ...[0.9, 1.9].map((y) => P(box(b0, b1, y, y + 0.06, 2.7, 5.1), c.trunk)),
        ])),
  ]);
}

// --- Figures and trees (MeshLambertMaterial, vertex colours without baked light) -------------

const L = (geometry: BufferGeometry, color: Color) => part(geometry, { color }, null);

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

/**
 * The four hub NPCs as plain statues in one draw call, facing their rest yaw: shown until the
 * baked cast arrives, and kept if it fails. Outfits come from the theme (`campus.npcs`).
 */
export function buildNpcs(pal: Palette, looks: CampusTheme["npcs"]) {
  return merge(
    NPCS.flatMap(({ id, spot, yaw }) => {
      const look = looks[id];
      const at = (geometry: BufferGeometry) =>
        geometry.rotateY(yaw).translate(spot.x, 0.045, spot.z);
      return [
        L(at(cyl(0.14, 0.13, 8, 0, 0.46)), new Color(look.bottom)),
        L(at(cyl(0.19, 0.21, 8, 0.44, 1.02)), new Color(look.top)),
        L(at(ico(0.16, 1, 0, 1.18, 0)), pal.plaza),
        L(at(cyl(0.165, 0.165, 8, 1.26, 1.36)), new Color(look.accent)),
      ];
    }),
  );
}

/** Crowns of the two tree kinds; each also casts its tree's sun shadow. */
function roundCrown() {
  return ico(0.8, 1, 0, 0, 0).scale(1, 0.85, 1).translate(0, 1.55, 0);
}

function cypressCrown() {
  const profile: [number, number][] = [
    [0, 0.1],
    [0.17, 0.13],
    [0.23, 0.4],
    [0.225, 0.8],
    [0.15, 1.2],
    [0.05, 1.45],
    [0, 1.55],
  ];
  return lathe(profile, 8, 0, 0);
}

/** Broad crown, a little wider than tall (§5.9). */
export function buildRoundTree(pal: Palette) {
  return merge([L(cyl(0.08, 0.12, 6, 0, 0.95), pal.trunk), L(roundCrown(), pal.foliage)]);
}

/** Slender cypress, about 3.4 times taller than wide and well below the wing cornice (§5.9). */
export function buildCypress(pal: Palette) {
  return merge([L(cyl(0.04, 0.05, 5, 0, 0.12), pal.trunk), L(cypressCrown(), pal.cypress)]);
}

/** Segments of the always-present helpers drawn besides the built groups (art §3, §5.10). */
export const BLOB_SEGMENTS = 20;
export const RING_SEGMENTS = 40;
