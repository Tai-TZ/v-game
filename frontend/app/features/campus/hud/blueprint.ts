import type { CampusTheme } from "~/features/theme/schema";

import { cameraCentre, desiredCentre, ORBIT_FRAME, PIVOT, toScreen, viewFor } from "../camera";
import {
  arrivalPose,
  BACK,
  BASE,
  CYPRESS_TREES,
  FOUNTAIN_RADIUS,
  FOUNTAIN_WATER,
  LAKE,
  NPC_SPOT,
  PARK_TREES,
  parseArrival,
  PATHS,
  PLAZA,
  PLAZA_RADIUS,
  ROSE_BEDS,
  ROUND_TREES,
  siteFor,
  SPAWN,
  type Box,
  type Vec2,
} from "../layout";

/*
 * The scene loader's diorama ("sa bàn", art §8.4): a pale isometric drawing of the campus in
 * SVG, one user unit per world unit, projected like the 3D camera (camera.ts) at HOME_YAW, so the
 * first 3D frame lands exactly on it: every entry to /play starts the view at home (store
 * resetView, routes/play clientLoader). Pure data, no three.js.
 */

export type Role =
  | "plate"
  | "board"
  | "soil"
  | "grass"
  | "path"
  | "water"
  | "foliage"
  | "trunk"
  | "wall"
  | "trim"
  | "lmroof"
  | "lib"
  | "wt"
  | "mk"
  | "fig"
  | "head"
  | "hair";

export interface Shape {
  tag: "polygon" | "ellipse" | "circle" | "line" | "path";
  cls: string;
  attrs: Record<string, string>;
}

export interface Piece {
  kind: "base" | "tile" | "flat" | "tree" | "bldg" | "fig";
  /** Diorama progress (sceneLoad `progress`) at which the piece is built. */
  at: number;
  shapes: Shape[];
  /** Ground footprint [x0, x1, z0, z1] of a standing piece, for the painter's order. */
  fp?: readonly [number, number, number, number];
}

/** [x0, x1, y0, y1, z0, z1]. */
type Box6 = readonly [number, number, number, number, number, number];
/** A box, or a pyramid from the box's base (y0) to its apex (y1) when `roof`. */
export interface Mass {
  role: Role;
  box: Box6;
  roof?: boolean;
}

const m = (role: Role, ...box: Box6): Mass => ({ role, box });
const roof = (role: Role, ...box: Box6): Mass => ({ role, box, roof: true });
const fromFootprint = (role: Role, f: Box, y0: number, y1: number): Mass =>
  m(role, f.x - f.halfX, f.x + f.halfX, y0, y1, f.z - f.halfZ, f.z + f.halfZ);

/**
 * Mirrors scene/campus.ts (which imports three.js): heights and tower massing. Coarse boxes
 * and pyramids, one stack per visible mass, listed bottom to top; colonnades, lamps and
 * statues are left out. The bbox test guards buildings; the ground's paths are not mirrored
 * but shared with the scene through layout.ts.
 */
export const MIRROR = {
  /** mainBuilding(): wings and pavilions. Plinths fold into the walls. */
  main: [
    [m("wall", -9.75, -3.0, 0, 2.37, -9.75, -6.15)],
    [m("wall", 3.0, 9.75, 0, 2.37, -9.75, -6.15)],
    ...[-9.05, -3.7, 3.7, 9.05].map((c) => [
      m("wall", c - 0.7, c + 0.7, 0, 2.95, -7.4, -6.0),
      m("trim", c - 0.76, c + 0.76, 2.95, 3.03, -7.46, -5.94),
      m("wall", c - 0.31, c + 0.31, 3.03, 3.48, -7.01, -6.39),
    ]),
  ],
  /** The stepped tower base and the porch; the landmark archetype stands on them. */
  tower: [
    m("wall", -3.0, 3.0, 0, 2.9, -9.9, -5.3),
    m("trim", -3.12, 3.12, 2.9, 3.02, -10.02, -5.18),
    m("trim", -1.7, 1.7, 0, 0.3, -5.15, -3.55),
  ],
  "clock-tower": [
    roof("lmroof", -3.12, 3.12, 3.02, 4.3, -10.02, -5.18),
    m("wall", -0.85, 0.85, 0.3, 4.6, -6.5, -4.8),
    m("trim", -0.95, 0.95, 4.6, 4.72, -6.6, -4.7),
    m("wall", -0.75, 0.75, 4.72, 5.9, -6.4, -4.9),
    roof("lmroof", -0.78, 0.78, 5.9, 7.6, -6.43, -4.87),
    roof("lmroof", -0.1, 0.1, 7.6, 8.2, -5.75, -5.55),
  ],
  "spire-hall": [
    m("wall", -1.95, 1.95, 3.02, 3.8, -9.1, -6.1),
    m("trim", -2.03, 2.03, 3.8, 3.96, -9.18, -6.02),
    m("wall", -1.83, 1.83, 3.96, 4.9, -9.0, -6.2),
    m("trim", -1.9, 1.9, 4.9, 5.0, -9.07, -6.13),
    m("wall", -0.81, 0.81, 5.0, 6.2, -8.41, -6.79),
    m("trim", -0.88, 0.88, 6.2, 6.28, -8.48, -6.72),
    m("wall", -0.56, 0.56, 6.28, 7.65, -8.16, -7.04),
    roof("wall", -0.3, 0.3, 7.65, 10.28, -7.9, -7.3),
  ],
  /** Spire hall only: the porch canopy on four columns. */
  canopy: m("trim", -1.65, 1.65, 1.3, 1.46, -5.3, -4.22),
  /** archGate() (with colonnades) and pierGate(); fences left out. */
  archGate: [
    [m("wall", -2.8, -1.54, 0, 1.78, 11.55, 12.42)],
    [m("wall", 1.54, 2.8, 0, 1.78, 11.55, 12.42)],
    [
      m("wall", -1.54, 1.54, 0, 2.62, 11.5, 12.42),
      m("trim", -1.82, 1.82, 2.62, 2.8, 11.44, 12.5),
      m("wall", -1.16, 1.16, 2.8, 3.0, 11.7, 12.2),
    ],
  ],
  pierGate: [
    [m("wall", -1.7, -1.2, 0, 1.4, 11.9, 12.4)],
    [m("wall", 1.2, 1.7, 0, 1.4, 11.9, 12.4)],
    [m("lmroof", -1.7, 1.7, 1.4, 1.58, 12.0, 12.3)],
  ],
  library: [
    fromFootprint("trim", siteFor("library").footprint, 0, 0.25),
    m("wall", -12.2, -9.4, 0.25, 1.85, -5.8, -0.8),
    m("trim", -9.45, -8.85, 1.85, 2.02, -5.85, -0.75),
    m("trim", -12.3, -8.85, 2.02, 2.1, -5.9, -0.7),
    m("foliage", -11.78, -9.42, 2.1, 2.41, -5.28, -1.32),
    m("lib", -9.4, -8.6, 1.42, 1.48, -3.4, -2.2),
  ],
  watchtower: [
    fromFootprint("trim", siteFor("watchtower").footprint, 0, 0.25),
    m("wall", 9.52, 11.68, 0.25, 3.57, -5.88, -3.72),
    m("wall", 9.75, 11.45, 3.57, 4.25, -5.65, -3.95),
    m("wall", 10.0, 11.2, 4.25, 4.82, -5.4, -4.2),
    m("wt", 10.24, 10.96, 4.82, 5.58, -5.16, -4.44),
    roof("wt", 10.3, 10.9, 5.58, 6.19, -5.1, -4.5),
    m("wall", 8.95, 11.85, 0.25, 1.53, -3.85, -1.15),
  ],
  market: [
    fromFootprint("trim", siteFor("market").footprint, 0, 0.2),
    m("mk", 6.55, 7.0, 1.45, 1.51, 3.3, 4.5),
    m("wall", 7.3, 10.7, 0.2, 1.75, 2.9, 4.9),
    m("trim", 6.95, 11.05, 1.75, 1.95, 2.55, 5.25),
    m("wall", 7.55, 10.45, 1.95, 2.42, 3.0, 4.8),
  ],
  /** Awnings: north and south (x 7.05–10.95), east (z 2.65–5.15), sloping 0.38 rad outwards. */
  awnings: {
    y: [1.62, 1.38],
    north: [7.05, 10.95, 1.95, 2.55],
    south: [7.05, 10.95, 5.25, 5.85],
    east: [11.05, 11.65, 2.65, 5.15],
  },
  /** backCampus() roof heights over the BACK footprints; the domed hall's vault as a box. */
  back: [
    [BACK.annex, 1.36],
    [BACK.solarHall, 1.86],
    [BACK.westHall, 1.57],
    [BACK.hall, 1.58],
    [BACK.chiller, 0.62],
    [BACK.carports, 0.42],
    [BACK.stand, 1.16],
  ] as const,
  vault: m("wall", 4.3, 8.9, 1.58, 2.7, -17.5, -13.7),
} as const;

// --- Projection and shapes ------------------------------------------------------------------

const S2 = Math.SQRT2;
const S6 = Math.sqrt(6);
const n3 = (n: number) => String(Math.round(n * 1000) / 1000);
const X = (x: number, _y: number, z: number) => (x - z) / S2;
/** SVG y grows downwards: −sy of camera.ts' toScreen. */
const Y = (x: number, y: number, z: number) => (x - 2 * y + z) / S6;
type P3 = readonly [number, number, number];
const pt = ([x, y, z]: P3) => `${n3(X(x, y, z))},${n3(Y(x, y, z))}`;

const poly = (cls: string, points: readonly P3[], extra: Record<string, string> = {}): Shape => ({
  tag: "polygon",
  cls,
  attrs: { points: points.map(pt).join(" "), ...extra },
});

/** The faces the camera sees: +z (left on screen), +x (right), top (art §2.3 shading). */
function boxShapes(role: Role, [x0, x1, y0, y1, z0, z1]: Box6): Shape[] {
  const r = `bp-${role}`;
  return [
    poly(`f-left ${r}`, [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ]),
    poly(`f-right ${r}`, [
      [x1, y0, z0],
      [x1, y0, z1],
      [x1, y1, z1],
      [x1, y1, z0],
    ]),
    poly(`f-top ${r}`, [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ]),
  ];
}

/** All four slopes, back ones first: a low hip roof shows its back slopes too. */
function pyramidShapes(role: Role, [x0, x1, yb, yt, z0, z1]: Box6): Shape[] {
  const r = `bp-${role}`;
  const apex: P3 = [(x0 + x1) / 2, yt, (z0 + z1) / 2];
  return [
    poly(`f-top ${r}`, [[x1, yb, z0], [x0, yb, z0], apex]),
    poly(`f-top ${r}`, [[x0, yb, z0], [x0, yb, z1], apex]),
    poly(`f-left ${r}`, [[x0, yb, z1], [x1, yb, z1], apex]),
    poly(`f-right ${r}`, [[x1, yb, z0], [x1, yb, z1], apex]),
  ];
}

const massShapes = (mass: Mass) =>
  mass.roof ? pyramidShapes(mass.role, mass.box) : boxShapes(mass.role, mass.box);

const rect = (x0: number, x1: number, z0: number, z1: number) =>
  [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ] as const;

const flat = (
  role: Role,
  xz: readonly (readonly [number, number])[],
  y: number,
  extra?: Record<string, string>,
): Shape =>
  poly(
    `f-top bp-${role}`,
    xz.map(([x, z]) => [x, y, z]),
    extra,
  );

/** A circle on the ground: an ellipse r wide and r/√3 tall on screen. */
const disc = (role: Role, x: number, z: number, r: number, y: number): Shape => ({
  tag: "ellipse",
  cls: `f-top bp-${role}`,
  attrs: { cx: n3(X(x, y, z)), cy: n3(Y(x, y, z)), rx: n3(r), ry: n3(r / Math.sqrt(3)) },
});

type TreeKind = "round" | "cypress" | "park";
/** Crown centre height and radius (buildRoundTree, buildCypress; park trees are 0.55×). */
const CROWN: Record<TreeKind, readonly [number, number]> = {
  round: [1.55, 0.8],
  cypress: [0.83, 0.23],
  park: [0.85, 0.44],
};

function treeShapes({ x, z }: Vec2, kind: TreeKind): Shape[] {
  const [h, r] = CROWN[kind];
  const cx = n3(X(x, h, z));
  const cy = n3(Y(x, h, z));
  const trunk: Shape = {
    tag: "line",
    cls: "stroke bp-trunk",
    attrs: { x1: n3(X(x, 0, z)), y1: n3(Y(x, 0, z)), x2: cx, y2: cy },
  };
  const crown: Shape =
    kind === "cypress"
      ? { tag: "ellipse", cls: "f-top bp-foliage", attrs: { cx, cy, rx: n3(r), ry: "0.68" } }
      : { tag: "circle", cls: "f-top bp-foliage", attrs: { cx, cy, r: n3(r) } };
  return [trunk, crown];
}

/** A standing figure as a maquette statue: skirt or legs, body, head (art §5.8, §5.9). */
function figureShapes({ x, z }: Vec2, lan: boolean): Shape[] {
  const bx = X(x, 0, z);
  const by = Y(x, 0, z);
  const k = 2 / S6;
  const band = (w0: number, w1: number, y0: number, y1: number, cls: string): Shape => ({
    tag: "polygon",
    cls,
    attrs: {
      points: [
        [bx - w0, by - k * y0],
        [bx + w0, by - k * y0],
        [bx + w1, by - k * y1],
        [bx - w1, by - k * y1],
      ]
        .map(([px = 0, py = 0]) => `${n3(px)},${n3(py)}`)
        .join(" "),
    },
  });
  const head = (cy: number, r: number, role: Role, dx = 0): Shape => ({
    tag: "circle",
    cls: `f-top bp-${role}`,
    attrs: { cx: n3(bx + dx), cy: n3(by - k * cy), r: n3(r) },
  });
  return lan
    ? [
        band(0.31, 0.17, 0, 0.62, "f-left bp-fig"),
        band(0.24, 0.18, 0.56, 1.08, "f-top bp-fig"),
        head(1.24, 0.16, "head"),
        head(1.37, 0.085, "hair", 0.06),
      ]
    : [
        band(0.15, 0.13, 0, 0.42, "f-left bp-fig"),
        band(0.23, 0.19, 0.42, 0.92, "f-top bp-fig"),
        head(1.1, 0.17, "head"),
      ];
}

const footprint = (masses: readonly Mass[]) => {
  const [x0, x1, , , z0, z1] = masses[0]?.box ?? [0, 0, 0, 0, 0, 0];
  return [x0, x1, z0, z1] as const;
};

// --- Pieces ---------------------------------------------------------------------------------

export interface Stack {
  /** Diorama progress that builds it. */
  at: number;
  /** Drawn in order, bottom to top; the first one's footprint orders the stack. */
  masses: readonly Mass[];
  /** The market's sloped awnings ride along (awningShapes). */
  awnings?: boolean;
}

/** Every building of the active landmark pack, with its threshold (also read by tests). */
export function buildingStacks(landmark: CampusTheme["landmark"]): Stack[] {
  const spire = landmark.archetype === "spire-hall";
  const gate = landmark.colonnades ? MIRROR.archGate : MIRROR.pierGate;
  return [
    ...MIRROR.main.map((masses) => ({ at: 0.86, masses })),
    {
      at: 0.86,
      masses: [...MIRROR.tower, ...(spire ? [MIRROR.canopy] : []), ...MIRROR[landmark.archetype]],
    },
    ...MIRROR.back.map(([f, top], i) => ({
      at: 0.87 + 0.005 * Math.floor(i / 2),
      masses: [fromFootprint("wall", f, 0, top), ...(f === BACK.hall ? [MIRROR.vault] : [])],
    })),
    { at: 0.89, masses: MIRROR.library },
    { at: 0.9, masses: MIRROR.watchtower },
    { at: 0.91, masses: MIRROR.market, awnings: true },
    ...gate.map((masses) => ({ at: 0.92, masses })),
  ];
}

/** The north awning hangs behind the hall, so it is painted before the hall's masses. */
function northAwning(): Shape {
  const { y, north } = MIRROR.awnings;
  const [yIn, yOut] = y;
  const [x0, x1, z0, z1] = north;
  return poly("f-top bp-mk", [
    [x0, yOut, z0],
    [x1, yOut, z0],
    [x1, yIn, z1],
    [x0, yIn, z1],
  ]);
}

function awningShapes(): Shape[] {
  const { y, south, east } = MIRROR.awnings;
  const [yIn, yOut] = y;
  const [sx0, sx1, sz0, sz1] = south;
  const [ex0, ex1, ez0, ez1] = east;
  return [
    poly("f-top bp-mk", [
      [sx0, yIn, sz0],
      [sx1, yIn, sz0],
      [sx1, yOut, sz1],
      [sx0, yOut, sz1],
    ]),
    poly("f-top bp-mk", [
      [ex0, yIn, ez0],
      [ex1, yOut, ez0],
      [ex1, yOut, ez1],
      [ex0, yIn, ez1],
    ]),
  ];
}

/** Where the player stands on entry: in front of the door named by `?at=`, else the spawn. */
export function entryFocus(search: string): Vec2 {
  const site = parseArrival(new URLSearchParams(search).get("at"));
  return site ? arrivalPose(site).position : SPAWN;
}

/** The first 3D frame's visible rectangle as an SVG viewBox "x y w h" in world units. */
export function blueprintViewBox(width: number, height: number, focus: Vec2): string {
  const view = viewFor(width, height);
  const f = toScreen(focus.x, 0, focus.z);
  const c = cameraCentre(desiredCentre(f, f, view), view);
  const w = width / view.zoom;
  const h = height / view.zoom;
  return [c.sx - w / 2, -c.sy - h / 2, w, h].map(n3).join(" ");
}

const { minX, maxX, minZ, maxZ } = BASE;

/** Base: white plate and soil block with the blank board on top, there from the start. */
const baseShapes = (): Shape[] => [
  ...boxShapes("plate", [minX - 0.25, maxX + 0.25, -0.8, -0.6, minZ - 0.25, maxZ + 0.25]),
  ...boxShapes("soil", [minX, maxX, -0.6, 0, minZ, maxZ]).slice(0, 2),
  flat("board", rect(minX, maxX, minZ, maxZ), 0, { "data-bp": "board" }),
];

/** 8 × 9 grass tiles on the board, as [x0, z0] corners of 0.05-inset rectangles. */
const TILE_W = (maxX - minX) / 8;
const TILE_D = (maxZ - minZ) / 9;
const tileRects = () =>
  Array.from({ length: 72 }, (_, k) => {
    const x0 = minX + Math.floor(k / 9) * TILE_W;
    const z0 = minZ + (k % 9) * TILE_D;
    return { x0, z0, xz: rect(x0 + 0.05, x0 + TILE_W - 0.05, z0 + 0.05, z0 + TILE_D - 0.05) };
  });

/** The overview's frame (camera.ts ORBIT_FRAME round PIVOT) as a viewBox, for the pre-rendered board. */
const PIVOT_SCREEN = toScreen(PIVOT.x, 0, PIVOT.z);
export const SHELL_VIEWBOX = [
  PIVOT_SCREEN.sx - ORBIT_FRAME.half,
  -(PIVOT_SCREEN.sy + ORBIT_FRAME.top),
  2 * ORBIT_FRAME.half,
  ORBIT_FRAME.top - ORBIT_FRAME.bottom,
]
  .map(n3)
  .join(" ");

/**
 * The empty board for the pre-rendered shell: the base, and the tiles as one ghost path that
 * draws exactly like the live diorama's unbuilt tiles (no JS, a small HTML payload).
 */
export function shellBoard(): Piece[] {
  const grid = tileRects()
    .map(({ xz }) => `M${xz.map(([x, z]) => pt([x, 0.004, z])).join(" ")}Z`)
    .join("");
  return [
    { kind: "base", at: 0, shapes: baseShapes() },
    { kind: "tile", at: 1, shapes: [{ tag: "path", cls: "f-top bp-grass", attrs: { d: grid } }] },
  ];
}

/** Every piece of the diorama in painter's order, each with the progress that builds it. */
export function blueprintPieces(landmark: CampusTheme["landmark"], player: Vec2): Piece[] {
  const pieces: Piece[] = [];
  const add = (kind: Piece["kind"], at: number, shapes: Shape[], fp?: Piece["fp"]) =>
    pieces.push(fp ? { kind, at, shapes, fp } : { kind, at, shapes });

  add("base", 0, baseShapes());

  // Grass tiles, built as a wave from the far corner towards the viewer.
  const tiles = tileRects().map(({ x0, z0, xz }) => ({
    key: x0 + z0 + 0.01 * x0,
    shape: flat("grass", xz, 0.004),
  }));
  tiles
    .sort((a, b) => a.key - b.key)
    .forEach(({ shape }, i, all) => add("tile", 0.02 + (0.5 * i) / (all.length - 1), [shape]));

  // Ground details complete exactly on the chunk signal (stage 1 never passes 0.54).
  const lake: [number, number][] = [[LAKE.x, LAKE.z]];
  for (let k = 0; k <= 12; k += 1) {
    const t = ((k / 12) * Math.PI) / 2;
    lake.push([LAKE.x - LAKE.rx * Math.cos(t), LAKE.z - LAKE.rz * Math.sin(t)]);
  }
  const paths = [...PATHS.front, ...PATHS.low, ...PATHS.back].map(([x0, x1, z0, z1]) =>
    flat("path", rect(x0, x1, z0, z1), 0.012),
  );
  const flats: Shape[][] = [
    [flat("water", lake, 0.008)],
    paths.slice(0, 3),
    paths.slice(3, 6),
    [
      ...paths.slice(6, 8),
      ...ROSE_BEDS.map(([x0, z0]) => flat("foliage", rect(x0, x0 + 2.6, z0, z0 + 1.5), 0.14)),
    ],
    paths.slice(8),
    [disc("path", PLAZA.x, PLAZA.z, PLAZA_RADIUS, 0.04)],
    [
      disc("foliage", PLAZA.x, PLAZA.z, FOUNTAIN_RADIUS, 0.14),
      disc("water", PLAZA.x, PLAZA.z, FOUNTAIN_WATER, 0.22),
    ],
  ];
  flats.forEach((shapes, i) => add("flat", 0.55 + (0.05 * i) / (flats.length - 1), shapes));

  // Trees in the same wave order; they finish while the scene builds.
  const trees = [
    ...ROUND_TREES.map((t) => [t, "round"] as const),
    ...CYPRESS_TREES.map((t) => [t, "cypress"] as const),
    ...PARK_TREES.map((t) => [t, "park"] as const),
  ].sort(([a], [b]) => a.x + a.z - (b.x + b.z));
  trees.forEach(([t, kind], i) =>
    add("tree", 0.61 + (0.19 * i) / (trees.length - 1), treeShapes(t, kind), [
      t.x - 0.3,
      t.x + 0.3,
      t.z - 0.3,
      t.z + 0.3,
    ]),
  );

  for (const { at, masses, awnings } of buildingStacks(landmark)) {
    const shapes = masses.flatMap(massShapes);
    add(
      "bldg",
      at,
      awnings ? [northAwning(), ...shapes, ...awningShapes()] : shapes,
      footprint(masses),
    );
  }

  const spot = (p: Vec2) => [p.x - 0.3, p.x + 0.3, p.z - 0.3, p.z + 0.3] as const;
  add("fig", 0.93, figureShapes(NPC_SPOT, true), spot(NPC_SPOT));
  add("fig", 0.935, figureShapes(player, false), spot(player));
  return drawOrder(pieces);
}

/**
 * Painter's order: flat pieces first, then standing ones topologically (A before B when A is
 * behind B on x or z and they overlap on screen), ties in list order.
 */
export function drawOrder(pieces: readonly Piece[]): Piece[] {
  const flats = pieces.filter((p) => !p.fp);
  const stand = pieces.filter((p) => p.fp);
  const span = (f: Piece["fp"] = [0, 0, 0, 0]) => [(f[0] - f[3]) / S2, (f[1] - f[2]) / S2];
  const behind = (a: Piece["fp"] = [0, 0, 0, 0], b: Piece["fp"] = [0, 0, 0, 0]) =>
    a[1] <= b[0] + 1e-6 || a[3] <= b[2] + 1e-6;
  const after = stand.map((): number[] => []);
  const deg = stand.map(() => 0);
  stand.forEach((a, i) =>
    stand.forEach((b, j) => {
      if (i >= j) return;
      const [a0 = 0, a1 = 0] = span(a.fp);
      const [b0 = 0, b1 = 0] = span(b.fp);
      if (a1 <= b0 || b1 <= a0) return; // apart on screen
      if (behind(a.fp, b.fp)) {
        after[i]?.push(j);
        deg[j] = (deg[j] ?? 0) + 1;
      } else if (behind(b.fp, a.fp)) {
        after[j]?.push(i);
        deg[i] = (deg[i] ?? 0) + 1;
      }
    }),
  );
  const done: Piece[] = [];
  const ready = stand.map((_, i) => i).filter((i) => deg[i] === 0);
  while (ready.length > 0) {
    ready.sort((p, q) => p - q);
    const i = ready.shift() ?? 0;
    const piece = stand[i];
    if (piece) done.push(piece);
    for (const j of after[i] ?? []) {
      deg[j] = (deg[j] ?? 0) - 1;
      if (deg[j] === 0) ready.push(j);
    }
  }
  return [...flats, ...done];
}
