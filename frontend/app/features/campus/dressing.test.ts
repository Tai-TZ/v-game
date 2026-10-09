import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { toScreen } from "./camera";
import { DRESSING, DRESSING_BLOCKS, DRESSING_LAMPS, PROP_COLOURS, type Dressing } from "./dressing";
import {
  arcPoint,
  BACK_SPOT,
  BASE,
  CYPRESS_TREES,
  LAKE,
  NPC_SPOT,
  NPC_TALK_SPOT,
  OBSTACLES,
  PARK_TREES,
  PATHS,
  PLAZA,
  ROUND_TREES,
  routeTo,
  SITES,
  SPAWN,
  WORLD_BOUNDS,
  type Box,
  type Vec2,
} from "./layout";
import { isBlocked } from "./movement";
import { entranceLampSpots } from "./scene/campus";
import { LABEL_ANCHORS } from "./scene/labels";

/*
 * Placement checks of the campus dressing (placement plan §1, ported from its place.ts): every
 * prop stands clear of what the campus already has, of the people and of the labels, stays inside
 * the orbit envelope, and the blocking ones keep every walkable point and goal reachable.
 */

const json = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "public", "models", "props.json"), "utf8"),
) as {
  // Not scene/props.ts's PropsJson: that module stays in the scene chunk (props.test.ts).
  q: number;
  props: Record<string, { position: number[]; mats: string[] }>;
};

/**
 * Reach of one placement from its spot (`r`, any height), its reach within 0.3 of its foot
 * (`foot`: what stands on the ground; a sign's arrow may overhang a path) and its top `h`.
 */
function extent(row: Dressing) {
  const data = json.props[row.prop];
  if (!data) throw new Error(`no prop ${row.prop}`);
  const [sx, sy, sz] =
    typeof row.scale === "number" ? [row.scale, row.scale, row.scale] : row.scale;
  let r = 0;
  let foot = 0;
  let top = 0;
  for (let i = 0; i < data.position.length; i += 3) {
    const [x = 0, y = 0, z = 0] = data.position.slice(i, i + 3).map((v) => v / json.q);
    const reach = Math.max(Math.abs(x) * sx, Math.abs(z) * sz);
    r = Math.max(r, reach);
    if (y * sy < 0.3) foot = Math.max(foot, reach);
    top = Math.max(top, y * sy);
  }
  return { r, foot, h: (row.y ?? 0) + top };
}

interface Placed {
  name: string;
  kind: Dressing["kind"] | "lamp";
  x: number;
  z: number;
  r: number;
  foot: number;
  h: number;
  row: object;
}
const LAMP = { r: 0.18, foot: 0.18, h: 1.9 };
const lampRow = {};
const placed: Placed[] = [
  ...DRESSING.flatMap((row) => {
    const { r, foot, h } = extent(row);
    return row.at.map(([x, z]) => ({
      name: `${row.prop} (${x}, ${z})`,
      kind: row.kind,
      x,
      z,
      r,
      foot,
      h,
      row,
    }));
  }),
  ...DRESSING_LAMPS.map(({ x, z }) => ({
    name: `lamp (${x}, ${z})`,
    kind: "lamp" as const,
    x,
    z,
    ...LAMP,
    row: lampRow,
  })),
];
const land = placed.filter((p) => p.kind !== "water" && p.kind !== "pier");

const d = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const inLake = (x: number, z: number, grow = 0) =>
  ((x - LAKE.x) / (LAKE.rx + grow)) ** 2 + ((z - LAKE.z) / (LAKE.rz + grow)) ** 2 < 1;

/** The v0.4 cast's spots and talk spots (npc-cast v0.4 §4), with the librarian's. */
const v = (x: number, z: number): Vec2 => ({ x, z });
const NPCS = [NPC_SPOT, v(1.25, -3.0), v(3.4, 10.85), v(8.0, -12.4), v(-5.45, -15.95)];
const TALKS = [NPC_TALK_SPOT, v(1.25, -2.2), v(2.6, 10.85), v(8.0, -11.6), v(-5.45, -15.15)];
/** Paved ground: layout's PATHS plus the domed hall's asphalt and the park path (backGrounds). */
const PAVED = [
  ...PATHS.front,
  ...PATHS.low,
  ...PATHS.back,
  [4.6, 8.6, -12.85, -11.25],
  [-1.3, -0.5, BASE.minZ, -16.6],
] as const;
/** Lamps and statues buildTerrain already stands (with colonnades off: the hedge-arc lamps). */
const STANDING: Vec2[] = [
  { x: 13.4, z: -3 },
  { x: 13.4, z: -7 },
  ...[-1, 1].flatMap((s) => [
    { x: s * 3.55, z: -3.7 },
    arcPoint(s * 0.3 * Math.PI, 4.6),
    arcPoint(s * 0.75 * Math.PI, 4.6),
    arcPoint(s * 0.37 * Math.PI, 3.4),
    arcPoint(s * 0.66 * Math.PI, 3.4),
  ]),
  ...[-3.05, 3.05].flatMap((x) => [-1.35, -0.45, 0.45, 1.35].map((z) => ({ x, z }))),
  ...[-3.3, 3.3].flatMap((x) => [-2.05, -5.5].map((z) => ({ x, z }))),
  ...SITES.flatMap(({ id }) => entranceLampSpots(id)),
];
const existing = OBSTACLES.filter((box) => !DRESSING_BLOCKS.includes(box));

describe("dressing data", () => {
  it("places every baked prop but the cliff and names a theme colour slot for each material", () => {
    // The wall rocks (cliff) read as concrete kerbs and are no longer placed (review r1).
    const placedIds = new Set(DRESSING.map((row) => row.prop));
    expect(Object.keys(json.props).filter((id) => !placedIds.has(id))).toEqual(["cliff"]);
    expect([...placedIds].filter((id) => !json.props[id])).toEqual([]);
    for (const id of placedIds) {
      const mats = json.props[id]?.mats ?? [];
      expect(Object.keys(PROP_COLOURS[id] ?? {}).sort(), id).toEqual([...mats].sort());
    }
  });

  it("paints no shrub with the rose-pink bloom (owner, 2026-10-09)", () => {
    for (const id of ["bush", "bush-large"]) expect(PROP_COLOURS[id]?.grass).toBe("hedge");
  });

  it("adds one OBSTACLES box per blocking prop, at the prop", () => {
    const blocking = DRESSING.flatMap((row) =>
      row.block
        ? row.at.map(([x, z]) => ({ x, z, halfX: row.block?.[0], halfZ: row.block?.[1] }))
        : [],
    );
    expect(blocking).toHaveLength(10);
    expect(DRESSING_BLOCKS).toEqual(blocking);
    for (const box of DRESSING_BLOCKS) expect(OBSTACLES).toContain(box);
  });
});

describe("dressing placement (placement plan §1)", () => {
  it("keeps every footprint on the slab, the hedge row inside the fence strip, water props in the lake", () => {
    const bad: string[] = [];
    for (const p of land) {
      const off =
        p.x - p.r < BASE.minX ||
        p.x + p.r > BASE.maxX ||
        p.z - p.r < BASE.minZ ||
        p.z + p.r > BASE.maxZ;
      if (off) bad.push(`${p.name}: off the slab`);
      if (p.kind === "fence" && (p.z + p.r > 12.36 || Math.abs(p.x) - p.r < 2.85))
        bad.push(`${p.name}: on the fence or gate`);
      if (p.kind !== "shore" && inLake(p.x, p.z, 0.14 + p.r)) bad.push(`${p.name}: in the lake`);
    }
    for (const p of placed.filter((q) => q.kind === "water")) {
      const rim = [
        [0, 0],
        [p.r, 0],
        [-p.r, 0],
        [0, p.r],
        [0, -p.r],
      ] as const;
      if (!rim.every(([dx, dz]) => inLake(p.x + dx, p.z + dz)))
        bad.push(`${p.name}: not in the lake`);
    }
    expect(bad).toEqual([]);
  });

  it("overlaps no building, path, plaza, tree, lamp or statue", () => {
    const bad: string[] = [];
    for (const p of land) {
      for (const o of existing) {
        const trunk = ROUND_TREES.some((t) => t.x === o.x && t.z === o.z);
        if (
          !trunk &&
          Math.abs(o.x - p.x) < o.halfX + 0.9 * p.r &&
          Math.abs(o.z - p.z) < o.halfZ + 0.9 * p.r
        )
          bad.push(`${p.name}: on the obstacle at (${o.x.toFixed(2)}, ${o.z.toFixed(2)})`);
      }
      const k = 0.8 * p.foot;
      if (
        PAVED.some(
          ([x0, x1, z0, z1]) => p.x + k > x0 && p.x - k < x1 && p.z + k > z0 && p.z - k < z1,
        )
      )
        bad.push(`${p.name}: on a path`);
      if (d(p, PLAZA) < 4.72 + p.foot) bad.push(`${p.name}: on the plaza`);
      for (const t of ROUND_TREES)
        if (d(p, t) < (p.h > 0.85 ? 0.85 : 0.15) + p.r)
          bad.push(`${p.name}: in the crown at (${t.x}, ${t.z})`);
      for (const t of [...CYPRESS_TREES, ...PARK_TREES])
        if (d(p, t) < 0.25 + p.r) bad.push(`${p.name}: on the tree at (${t.x}, ${t.z})`);
      for (const s of STANDING)
        if (d(p, s) < 0.3 + p.r) bad.push(`${p.name}: on the lamp or statue at (${s.x}, ${s.z})`);
    }
    expect(bad).toEqual([]);
  });

  it("keeps clear of the doors, the people, SPAWN and the back-of-campus spot", () => {
    const bad: string[] = [];
    for (const p of placed) {
      for (const s of SITES) if (d(p, s.door) < 1.2) bad.push(`${p.name}: by the ${s.id} door`);
      for (const n of NPCS) if (d(p, n) < 0.6 + p.r) bad.push(`${p.name}: on an NPC spot`);
      for (const n of TALKS) if (d(p, n) < 0.45 + p.r) bad.push(`${p.name}: on a talk spot`);
      for (const q of [SPAWN, BACK_SPOT])
        if (d(p, q) < 1 + p.r) bad.push(`${p.name}: on SPAWN or BACK_SPOT`);
    }
    expect(bad).toEqual([]);
  });

  it("lets no two props stand in each other (stacked ones share their base's spot)", () => {
    const bad: string[] = [];
    placed.forEach((a, i) => {
      for (const b of placed.slice(i + 1)) {
        if (a.row === b.row || a.kind === "stacked" || b.kind === "stacked") continue;
        const afloat = (p: Placed) => p.kind === "water" || p.kind === "pier";
        const water = afloat(a) && afloat(b); // the boat is moored along the pier
        if (d(a, b) < (a.r + b.r) * (water ? 0.6 : 0.85)) bad.push(`${a.name} × ${b.name}`);
      }
    });
    expect(bad).toEqual([]);
  });

  it("stays inside the ellipse the slab corners sweep, so no yaw puts a prop under a HUD corner", () => {
    // The orbit's frame and its HUD corners (the two top ones and the 158 × 70 view controls,
    // orbit-camera §1.3) are clear of the ellipse the slab's ground corners sweep. A point at
    // ground distance r from the slab's centre and height h projects inside it at every yaw
    // when r + √2·h stays within the slab's half diagonal.
    const centre = { x: 0, z: (BASE.minZ + BASE.maxZ) / 2 };
    const reach = Math.hypot(BASE.maxX, BASE.maxZ - centre.z);
    const worst = Math.min(
      ...placed.map((p) => reach - (d(p, centre) + p.r + Math.SQRT2 * Math.max(0, p.h))),
    );
    expect(worst).toBeGreaterThan(0);
  });

  it("hides no person and no door in the home view", () => {
    const tan = Math.tan(Math.asin(1 / Math.sqrt(3))); // the camera's elevation, 35.26°
    const bad: string[] = [];
    for (const t of [...NPCS, ...SITES.map((s) => s.door)])
      for (const y0 of [0.3, 0.9])
        for (const p of placed) {
          if (p.h < 0.3) continue;
          // The ray from (t, y0) to the camera runs along (1, 1)/√2 on the ground.
          const s = (p.x - t.x + (p.z - t.z)) / Math.SQRT2;
          const off = Math.abs(p.x - t.x - (p.z - t.z)) / Math.SQRT2;
          if (s > 0 && off < 0.8 * p.r && y0 + s * tan < p.h)
            bad.push(`${p.name} hides (${t.x}, ${t.z})`);
        }
    expect(bad).toEqual([]);
  });

  it("keeps out of every DOM label's patch in the home view", () => {
    const bad: string[] = [];
    for (const [id, [lx, ly, lz]] of Object.entries(LABEL_ANCHORS)) {
      const label = toScreen(lx, ly, lz);
      for (const p of placed) {
        // Centred on its anchor and standing on it: about 5.8 × 1.0 world units.
        const foot = toScreen(p.x, 0, p.z);
        const top = foot.sy + Math.sqrt(2 / 3) * p.h;
        if (
          Math.abs(foot.sx - label.sx) < 2.9 + 0.7 * p.r &&
          top > label.sy &&
          foot.sy < label.sy + 1
        )
          bad.push(`${p.name} in the ${id} label`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("walking round the dressing", () => {
  /** Free points of a 0.1 grid over WORLD_BOUNDS, and how many a flood fill from SPAWN reaches. */
  function reach(obstacles: readonly Box[]) {
    const h = 0.1;
    const nx = Math.round((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / h) + 1;
    const nz = Math.round((WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / h) + 1;
    const free = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i += 1)
      for (let k = 0; k < nz; k += 1) {
        const p = { x: WORLD_BOUNDS.minX + i * h, z: WORLD_BOUNDS.minZ + k * h };
        free[i * nz + k] = isBlocked(p, obstacles, WORLD_BOUNDS) ? 0 : 1;
      }
    const start =
      Math.round((SPAWN.x - WORLD_BOUNDS.minX) / h) * nz +
      Math.round((SPAWN.z - WORLD_BOUNDS.minZ) / h);
    const seen = new Uint8Array(free.length);
    const stack = [start];
    seen[start] = 1;
    let reached = 0;
    for (let c = stack.pop(); c !== undefined; c = stack.pop()) {
      reached += 1;
      const i = Math.floor(c / nz);
      const k = c % nz;
      for (const [a, b] of [
        [i + 1, k],
        [i - 1, k],
        [i, k + 1],
        [i, k - 1],
      ] as const) {
        const n = a * nz + b;
        if (a >= 0 && b >= 0 && a < nx && b < nz && free[n] && !seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    return { free: free.reduce((sum, v) => sum + v, 0), reached };
  }

  it("cuts off no walkable point: the blocking props only take the ground under them", () => {
    const before = reach(existing);
    const after = reach(OBSTACLES);
    expect(after.reached).toBe(after.free);
    expect(before.free - after.free).toBeGreaterThan(0);
    expect(before.free - after.free).toBeLessThan(2500);
  });

  it("still routes from SPAWN to the three doors, every talk spot and the back of campus", () => {
    for (const goal of [...SITES.map((s) => s.door), ...TALKS, BACK_SPOT]) {
      const route = routeTo(SPAWN, goal);
      expect(route.at(-1), `${goal.x}, ${goal.z}`).toEqual(goal);
      // Every leg is walkable: no waypoint inside a blocking prop.
      for (const w of route)
        expect(isBlocked(w, DRESSING_BLOCKS, WORLD_BOUNDS), `${w.x}, ${w.z}`).toBe(false);
    }
  });
});
