import type { Box, Vec2 } from "./layout";

/*
 * Where the CC0 props of public/models/props.json stand (dressing placement plan §2, 2026-10-09).
 * Data only, no three.js: layout.ts reads the blocking boxes, scene/useDressing.ts builds the mesh,
 * dressing.test.ts checks every spot against the layout. Literal numbers only, so layout.ts can
 * import this module without a cycle.
 */

/** Scene palette colours a prop may take (scene/palette.ts); each one derives from the manifest. */
export type ColourSlot =
  | "foliage"
  | "hedge"
  | "cypress"
  | "trunk"
  | "dark"
  | "bloom"
  | "band"
  | "sand"
  | "lm.wall"
  | "lm.trim"
  | "mk.roof"
  | "mk.wall"
  | "lib.roof";

/**
 * Material name → colour slot, per prop. Shrubs take the hedge green: the plan's rose-pink
 * `bloom` read as pink candy floss (owner, 2026-10-09). The parasol's palette swatches: canopy →
 * market roof, pole → dark, table frame and foot → trunk, table top → landmark trim; a white pole
 * under the red cap read as a toadstool (review r1).
 */
export const PROP_COLOURS: Readonly<Record<string, Readonly<Record<string, ColourSlot>>>> = {
  "bush-large": { grass: "hedge" },
  bush: { grass: "hedge" },
  pot: { wood: "lm.trim", woodBarkDark: "band" },
  "lily-large": { leafsGreen: "foliage", leafsDark: "hedge", colorRed: "bloom" },
  "lily-small": { leafsGreen: "foliage", leafsDark: "hedge" },
  reed: { leafsGreen: "cypress" },
  stone: { stone: "band" },
  bamboo: { grass: "cypress" },
  "dirt-row": { dirt: "trunk", dirtDark: "dark" },
  greens: { grass: "foliage" },
  palm: { leafsGreen: "foliage", woodBark: "trunk" },
  "palm-short": { leafsGreen: "foliage", woodBark: "trunk" },
  "parasol-table": {
    "colormap:339c75": "mk.roof",
    "colormap:20896b": "mk.roof",
    "colormap:5ac487": "mk.roof",
    "colormap:3d3f4b": "dark",
    "colormap:505463": "dark",
    "colormap:eaeaf2": "lm.trim",
    "colormap:646981": "trunk",
    "colormap:777c93": "trunk",
  },
  bench: { Wood: "trunk" },
  "food-stall": { Wood: "trunk", RoofTiles_Red: "mk.roof", Beige: "mk.wall" },
  dock: { Wood: "trunk", Wood_Light: "sand" },
  boat: { DarkWood: "dark", Wood: "trunk" },
  gazebo: { RoofTiles_Red: "lib.roof", Wood: "lm.wall" },
  "notice-board": { Yellow: "lm.wall", Brown: "trunk" },
  "arrow-sign": { Wood: "lm.wall", Main_Dark: "trunk" },
};

/** Turn (degrees) taking a prop's own front to +z; the food stall's counter faces its +x. */
export const PROP_YAW0: Readonly<Record<string, number>> = { "food-stall": -90 };

/** x, z and the facing in degrees: 0 faces +z, 90 faces +x (like `Site.facing`). */
type At = readonly [x: number, z: number, yaw?: number];

export interface Dressing {
  /** Key in props.json. */
  prop: string;
  /** Uniform, or [along x, height, along z] before the turn. */
  scale: number | readonly [number, number, number];
  /** Foot height; 0 when left out. */
  y?: number;
  /** Half sizes of the OBSTACLES box each copy adds; left out, the player walks past. */
  block?: readonly [halfX: number, halfZ: number];
  /**
   * What the placement checks hold it to: `ground` clear of everything; `stacked` on another
   * prop's spot; `fence` in the strip inside the front fence; `shore` on the lake's rim; `water`
   * wholly in the lake; `pier` from the shore into it.
   */
  kind: "ground" | "stacked" | "fence" | "shore" | "water" | "pier";
  at: readonly At[];
}

const row = (z: number, xs: readonly number[]): At[] => xs.map((x) => [x, z]);

export const DRESSING: readonly Dressing[] = [
  // A: front left by the gate, the rose garden and the lawn beside the plaza.
  {
    prop: "bush-large",
    scale: 2.2,
    kind: "fence",
    at: row(11.85, [-13.6, -12.4, -11.2, -9.4, -8.2, -5.6, -4.4, -3.3, 3.8, 5.7]),
  },
  {
    prop: "bench",
    scale: 2,
    kind: "ground",
    at: [
      [-11, 9.95, 180],
      [-8.4, 9.95, 180],
    ],
  },
  { prop: "arrow-sign", scale: 0.6, kind: "ground", at: [[-2.4, 10]] },
  {
    prop: "pot",
    scale: 1.5,
    kind: "ground",
    at: [
      [-5.4, 4.4],
      [-5.4, 8],
    ],
  },
  {
    prop: "bush",
    scale: 1.6,
    y: 0.28,
    kind: "stacked",
    at: [
      [-5.4, 4.4],
      [-5.4, 8],
    ],
  },
  // B: the market's food stall and café, the lake.
  { prop: "food-stall", scale: 1.3, block: [0.78, 0.38], kind: "ground", at: [[8.3, 6.5]] },
  {
    prop: "parasol-table",
    // Taller than the plan's 2.5, so the canopy clears the table.
    scale: [2.3, 2.9, 2.3],
    block: [0.4, 0.4],
    kind: "ground",
    at: [
      [6, 7.3],
      [6.5, 9, 30],
      [7.4, 8.15, 60],
    ],
  },
  { prop: "bench", scale: 2, kind: "ground", at: [[12.9, 4.9, 14]] },
  // Deck about 0.15 over the water (y 0.008); the posts sink into the opaque slab.
  { prop: "dock", scale: 2.2, y: -0.75, kind: "pier", at: [[11.24, 7.64, 36]] },
  { prop: "boat", scale: 0.12, kind: "water", at: [[12.44, 7.78, 36]] },
  {
    prop: "lily-large",
    scale: 2,
    y: 0.012,
    kind: "water",
    at: [
      [10.2, 10.6],
      [12.4, 10.4, 140],
      [13.3, 8.9, 250],
    ],
  },
  {
    prop: "lily-small",
    scale: 2,
    y: 0.012,
    kind: "water",
    at: [
      [11, 11.2],
      [9.4, 11.6, 90],
      [13.8, 10.4, 200],
    ],
  },
  {
    prop: "reed",
    scale: 2,
    kind: "water",
    // Three clumps on the rim.
    at: [
      [7.11, 11.59],
      [7.5, 11.31],
      [7.28, 10.93],
      [8.19, 9.18],
      [8.69, 9.05],
      [8.66, 8.62],
      [13.05, 6.31],
      [13.5, 6.51],
      [13.85, 6.19],
    ],
  },
  {
    prop: "stone",
    scale: 1.4,
    kind: "shore",
    at: [
      [6.79, 10.18],
      [8.98, 7.43],
      [11.86, 5.89],
      [14.5, 5.4],
      [6.5, 12],
    ],
  },
  // C: the library's lawn, the west edge, the beds behind the library.
  { prop: "gazebo", scale: 1.3, block: [0.7, 0.84], kind: "ground", at: [[-10.4, 1.8]] },
  { prop: "bush", scale: 1.6, kind: "ground", at: row(0.15, [-12, -11.1, -10.2, -9.3]) },
  { prop: "notice-board", scale: 0.8, kind: "ground", at: [[-8, -1.1, 90]] },
  {
    prop: "bamboo",
    scale: 2.6,
    block: [0.35, 0.35],
    kind: "ground",
    at: [
      [-14.2, -0.3],
      [-14.2, 2.8, 70],
    ],
  },
  {
    prop: "dirt-row",
    scale: 1.5,
    kind: "ground",
    at: [
      [-11, -6.9],
      [-11, -8],
    ],
  },
  {
    prop: "greens",
    scale: 1.1,
    kind: "stacked",
    at: [
      [-11.5, -6.9],
      [-10.5, -6.9, 90],
      [-11, -8, 45],
    ],
  },
  {
    prop: "bush",
    scale: 1.6,
    kind: "ground",
    at: [
      [-14.1, -9.8],
      [-12.9, -10.7],
    ],
  },
  // D: behind the east wing, by the running track.
  {
    prop: "palm",
    scale: 1.5,
    block: [0.3, 0.3],
    kind: "ground",
    at: [
      [13.95, -9],
      [14, -11.6, 120],
    ],
  },
  { prop: "palm-short", scale: 1.6, block: [0.3, 0.3], kind: "ground", at: [[11.1, -7.1, 40]] },
  { prop: "bench", scale: 2, kind: "ground", at: [[9.65, -15.5, 90]] },
  {
    prop: "bush",
    scale: 1.6,
    kind: "ground",
    at: [
      [11.9, -6.3],
      [10.3, -9.8],
    ],
  },
];

/** One box per copy of a blocking prop; layout.ts adds them to OBSTACLES. */
export const DRESSING_BLOCKS: readonly Box[] = DRESSING.flatMap(({ block, at }) =>
  block ? at.map(([x, z]) => ({ x, z, halfX: block[0], halfZ: block[1] })) : [],
);

/** Six more of the campus lamp (buildTerrain), on the new seating and the gate strip. */
export const DRESSING_LAMPS: readonly Vec2[] = [
  { x: -10.4, z: 11.5 },
  { x: -6.8, z: 11.5 },
  { x: 5, z: 11.5 },
  { x: 11.6, z: 5.6 },
  { x: -8.5, z: 0.6 },
  { x: 13.4, z: -10.4 },
];
