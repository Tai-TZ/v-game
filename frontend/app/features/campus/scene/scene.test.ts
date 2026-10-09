import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { renderHook } from "@testing-library/react";
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
  type BufferGeometry,
  type Material,
  type Matrix4,
} from "three";
import { describe, expect, it } from "vitest";

import { STARS_SAVED } from "~/features/progress/progress";
import {
  parseThemeIndex,
  parseThemeManifest,
  TimeOfDaySchema,
  type LandmarkArchetype,
  type ThemeManifest,
  type TimeOfDay,
} from "~/features/theme/schema";

import {
  cameraOffset,
  HOME_YAW,
  HUD_CORNER,
  ORBIT_FRAME,
  PIVOT,
  toScreen,
  VIEW_CONTROLS,
  viewFor,
  type Screen,
} from "../camera";
import {
  BASE,
  LANDMARK,
  NPC_SPOT,
  NPCS,
  OBSTACLES,
  routeTo,
  siteFor,
  SITES,
  SPAWN,
  SPEAKERS,
  towardFor,
  WORLD_BOUNDS,
  type Vec2,
} from "../layout";
import { DRESSING } from "../dressing";
import { step } from "../movement";
import { siteInfo, siteLook, siteLooks, type SiteLook } from "../sites";
import {
  buildLandmark,
  buildLibrary,
  buildMarket,
  buildTerrain,
  buildWatchtower,
  entranceLampSpots,
  SHADOW_Y,
  shadowCasters,
  SPEAKER_DISC_SEGMENTS,
  SPEAKER_DISC_Y,
  TREE_INSTANCES,
  treeMatrix,
} from "./campus";
import { parseCast } from "./cast";
import { LABEL_ANCHORS } from "./labels";
import { desaturate, light, palette, shade, type Palette } from "./palette";
import { triangleCount, type Face } from "./primitives";
import type { PropsJson } from "./props";
import { sceneBudget, useCampusGeometry, type CampusGeometry } from "./useCampusGeometry";
import { buildDressing } from "./useDressing";
import { clickGoal, pickNpc } from "./useHubFrame";

const THEMES_DIR = path.resolve(process.cwd(), "public", "themes");
const CAST = parseCast(
  JSON.parse(readFileSync(path.resolve(process.cwd(), "public", "models", "cast.json"), "utf8")),
);
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const themeIds = parseThemeIndex(readJson(path.join(THEMES_DIR, "index.json"))).map((t) => t.id);
const manifests: ThemeManifest[] = themeIds.map((id) =>
  parseThemeManifest(readJson(path.join(THEMES_DIR, id, "manifest.json"))),
);

const props = readJson(path.resolve(process.cwd(), "public", "models", "props.json")) as PropsJson;
/** Props tall or wide enough to cast a sun shadow like the trees (art §2.2). */
const CASTING_PROPS = [
  "gazebo",
  "food-stall",
  "notice-board",
  "palm",
  "palm-short",
  "parasol-table",
];

function build(manifest: ThemeManifest, time: TimeOfDay = "day", lit = false) {
  const looks: [SiteLook, SiteLook, SiteLook] = lit
    ? ["lit", "lit", "lit"]
    : ["open", "coming_soon", "coming_soon"];
  return renderHook(({ campus }) => useCampusGeometry(campus, time, ...looks), {
    initialProps: { campus: manifest.campus },
  });
}

const TIMES: readonly TimeOfDay[] = ["day", "dusk"];
/**
 * Heights of raised items under 0.03 that stand over the sun-shadow overlay on purpose, like the
 * plaza and the steps above it (art §2.4 item 4): a solid slab, not a ground decal.
 */
const RAISED = [0.02 /* open-air stage, lowest tier */];
const UP = new Vector3(0, 1, 0);
const LEFT = new Vector3(0, 0, 1); // +z: the left face on screen, towards the sun
const RIGHT = new Vector3(1, 0, 0); // +x: the right face on screen, in shade
const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** Vertices of a baked geometry whose colour is exactly `color` (emissive parts keep it). */
function verticesColoured(geometry: BufferGeometry, color: Color): number {
  const attribute = geometry.getAttribute("color");
  let count = 0;
  for (let i = 0; i < attribute.count; i += 1) {
    const same =
      Math.abs(attribute.getX(i) - color.r) < 1e-6 &&
      Math.abs(attribute.getY(i) - color.g) < 1e-6 &&
      Math.abs(attribute.getZ(i) - color.b) < 1e-6;
    if (same) count += 1;
  }
  return count;
}

/** True when a ground point lies inside a triangle of a ground geometry (non-indexed). */
function inShadow(geometry: BufferGeometry, p: Vec2): boolean {
  const position = geometry.getAttribute("position");
  const corner = (i: number) => ({ x: position.getX(i), z: position.getZ(i) });
  const side = (a: Vec2, b: Vec2) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
  for (let i = 0; i + 2 < position.count; i += 3) {
    const [a, b, c] = [corner(i), corner(i + 1), corner(i + 2)];
    const sides = [side(a, b), side(b, c), side(c, a)];
    if (sides.every((d) => d >= 0) || sides.every((d) => d <= 0)) return true;
  }
  return false;
}

/** Every triangle of a non-indexed geometry: outward normal (from the winding), centre, colour. */
function triangles(geometry: BufferGeometry) {
  const position = geometry.getAttribute("position");
  const colour = geometry.getAttribute("color");
  return Array.from({ length: position.count / 3 }, (_, t) => {
    const [a, b, c] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(position, 3 * t + k));
    if (!a || !b || !c) throw new Error("short triangle");
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const centre = a.clone().add(b).add(c).divideScalar(3);
    return { normal, centre, colour: new Color().fromBufferAttribute(colour, 3 * t) };
  });
}
type Triangle = ReturnType<typeof triangles>[number];

/** The wall a triangle faces by its horizontal normal; null for flat ones (roofs, ground). */
function sideOf(n: Vector3): Face | null {
  if (Math.max(Math.abs(n.x), Math.abs(n.z)) < 0.1) return null;
  if (Math.abs(n.x) > Math.abs(n.z)) return n.x > 0 ? "+x" : "-x";
  return n.z > 0 ? "+z" : "-z";
}

/** Triangles passing `keep`, counted by the wall they face. */
function countBySide(geometry: BufferGeometry, keep: (t: Triangle) => boolean) {
  const count: Record<Face, number> = { "+x": 0, "-x": 0, "+z": 0, "-z": 0 };
  for (const t of triangles(geometry)) {
    const side = sideOf(t.normal);
    if (side && keep(t)) count[side] += 1;
  }
  return count;
}

const sameColour = (a: Color, b: Color) =>
  Math.abs(a.r - b.r) < 1e-4 && Math.abs(a.g - b.g) < 1e-4 && Math.abs(a.b - b.b) < 1e-4;

/**
 * The four isometric diagonals (orbit-camera §1.1): the camera sits along h(yaw) = (sin yaw,
 * cos yaw) from its look-at point, so 45° is home (+x, +z) and each step of 90° turns the model
 * a quarter round. No browser: a wall is seen when its normal points towards the camera.
 */
const ISO_YAWS = [45, 135, 225, 315] as const;
const towardCamera = (yaw: number) => {
  const r = (yaw * Math.PI) / 180;
  return new Vector3(Math.sin(r), 0, Math.cos(r));
};
const WALLS: Record<Face, Vector3> = {
  "+x": new Vector3(1, 0, 0),
  "-x": new Vector3(-1, 0, 0),
  "+z": new Vector3(0, 0, 1),
  "-z": new Vector3(0, 0, -1),
};

/** Screen position of every vertex, with its world height. */
function screenVertices(geometry: BufferGeometry): (Screen & { y: number })[] {
  const position = geometry.getAttribute("position");
  return Array.from({ length: position.count }, (_, i) => {
    const y = position.getY(i);
    return { ...toScreen(position.getX(i), y, position.getZ(i)), y };
  });
}

/**
 * Screen window round the lantern, needle and star of the spire (v0.3 §4.5): nothing raised in
 * the terrain and no tree crown may stand behind them.
 */
const CROWN_WINDOW = { minX: 4.4, maxX: 6.35, minY: 8.1, maxY: 11.9 } as const;
const outsideCrown = (b: { minX: number; maxX: number; minY: number; maxY: number }) =>
  b.maxX < CROWN_WINDOW.minX ||
  b.minX > CROWN_WINDOW.maxX ||
  b.maxY < CROWN_WINDOW.minY ||
  b.minY > CROWN_WINDOW.maxY;

const crowns = TREE_INSTANCES.map((tree) => ({
  ...toScreen(tree.x, 1.55 * tree.scaleY, tree.z),
  half: 0.8 * tree.scale,
}));

/**
 * Points inside the tall parts of each landmark (star or clock-tower top, lantern or clock roof,
 * tower body) and the watchtower's top: the camera ray through each must stop on the building
 * (v0.3 §2.5, QA r3), not on the open back-campus ground behind it.
 */
const TALL: Record<LandmarkArchetype, [number, number, number][]> = {
  "spire-hall": [
    [0, 10, -7.6],
    [0, 7, -7.6],
    [0, 5.5, -7.6],
  ],
  "clock-tower": [
    [0, 8.08, -5.65],
    [0, 7, -5.65],
    [0, 4, -5.65],
  ],
};
const WATCHTOWER_TOP: [number, number, number] = [10.6, 5.2, -4.8];
/** On the market's south and east awnings, which hang outside its footprint (QA r4). */
const AWNINGS: [number, number, number][] = [
  [8.43, 1.41, 5.78],
  [9.0, 1.5, 5.55],
  [11.35, 1.5, 3.9],
];
/** The isometric camera's view direction: every click ray is parallel to it. */
const VIEW = new Vector3(-1, -1, -1).normalize();
/** The view direction of a camera turned to `yaw` (camera.ts cameraOffset, reversed). */
const viewDirection = (yaw: number) => new Vector3(...cameraOffset(yaw)).normalize().negate();
const DIAGONALS = [45, 135, 225, 315].map((d) => (d * Math.PI) / 180);
const deg = (d: number) => (d * Math.PI) / 180;

/**
 * Every vertex the overview frames, as (x − PIVOT.x, y, z − PIVOT.z): the static groups and the
 * trees placed by treeMatrix (orbit-camera §1.3).
 */
function framedPoints(g: CampusGeometry, extra: BufferGeometry[] = []): Float64Array {
  const points: number[] = [];
  const v = new Vector3();
  const add = (geometry: BufferGeometry, matrix?: Matrix4) => {
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i);
      if (matrix) v.applyMatrix4(matrix);
      points.push(v.x - PIVOT.x, v.y, v.z - PIVOT.z);
    }
  };
  for (const geometry of [g.terrain, g.landmark, g.library, g.watchtower, g.market, ...extra]) {
    add(geometry);
  }
  for (const tree of TREE_INSTANCES) {
    add(tree.kind === "round" ? g.roundTree : g.cypress, treeMatrix(tree));
  }
  return Float64Array.from(points);
}

/** Calls `visit(sx, sy)` with each point's screen position relative to PIVOT at `yaw`. */
function eachAroundPivot(
  points: Float64Array,
  yaw: number,
  visit: (sx: number, sy: number) => void,
) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const sinE = 1 / Math.sqrt(3);
  const cosE = Math.sqrt(2 / 3);
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    const z = points[i + 2] ?? 0;
    visit(x * c - z * s, y * cosE - (x * s + z * c) * sinE);
  }
}

/** Walks a route like the frame loop: step() at 60 Hz, next waypoint on targetDone. */
function walkRoute(from: Vec2, route: readonly Vec2[]): Vec2 {
  let position = from;
  for (const target of route) {
    for (let i = 0; i < 4000; i += 1) {
      const result = step(position, { keys: [], target }, 1 / 60, OBSTACLES, WORLD_BOUNDS);
      position = result.position;
      if (result.targetDone) break;
    }
  }
  return position;
}

/** The click targets as CampusScene groups them: zone buildings tagged, instanced trees included. */
function statics(g: CampusGeometry, material: Material): Group {
  const group = new Group().add(new Mesh(g.terrain, material), new Mesh(g.landmark, material));
  for (const { id } of SITES) {
    const mesh = new Mesh(g[id], material);
    mesh.userData.site = id;
    group.add(mesh);
  }
  for (const [geometry, kind] of [
    [g.roundTree, "round"],
    [g.cypress, "cypress"],
  ] as const) {
    const trees = TREE_INSTANCES.filter((tree) => tree.kind === kind);
    const mesh = new InstancedMesh(geometry, material, trees.length);
    trees.forEach((tree, i) => mesh.setMatrixAt(i, treeMatrix(tree)));
    group.add(mesh);
  }
  return group;
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
  g.npcs,
  g.lan,
];

describe("theme manifests", () => {
  it("parse with the schema and declare both landmark archetypes", () => {
    expect(manifests.length).toBeGreaterThanOrEqual(2);
    const archetypes = new Set(manifests.map((m) => m.campus.landmark.archetype));
    expect(archetypes).toEqual(new Set(["spire-hall", "clock-tower"]));
  });
});

describe.each(manifests.map((m) => [m.id, m] as const))(
  "baked lighting (art §2.3), theme %s",
  (_id, manifest) => {
    const { lights } = manifest.campus;

    it("keeps top faces at the manifest colour by day; left warm near 0.8, right cool near 0.6", () => {
      const day = light(lights.day);
      const top = shade(UP, day);
      expect([top.r, top.g, top.b]).toEqual([1, 1, 1]);
      const left = shade(LEFT, day);
      const right = shade(RIGHT, day);
      expect(luminance(left)).toBeCloseTo(0.8, 2);
      expect(luminance(right)).toBeCloseTo(0.6, 2);
      // Warm enough to see by day (QA r2): v0.3's grey sides moved only about 2 levels.
      expect(left.r - left.b).toBeGreaterThan(0.1);
      expect(right.b - right.r).toBeGreaterThan(0.08);
    });

    it("dims and warms the hour at dusk; without rim, matches the two-light formula", () => {
      const dusk = light(lights.dusk);
      const top = shade(UP, dusk);
      // The one exception to "top faces show the exact manifest colour" (art §10, dusk).
      expect(luminance(top)).toBeLessThan(0.9);
      expect(top.r).toBeGreaterThan(top.b);
      expect(luminance(shade(RIGHT, dusk))).toBeLessThan(0.5);
      // The two-light formula written out again here (not three.js's own Lambert path, art
      // §2.3), at a normal no rim reaches (facing the camera).
      const n = new Vector3(1, 1, 1).normalize();
      const sun = Math.max(0, n.dot(dusk.sun));
      const lambert = dusk.ground.clone().lerp(dusk.sky, 0.5 + 0.5 * n.y);
      lambert.add(dusk.sunColor.clone().multiplyScalar(sun));
      const baked = shade(n, dusk);
      expect(baked.r).toBeCloseTo(Math.min(1, lambert.r), 6);
      expect(baked.b).toBeCloseTo(Math.min(1, lambert.b), 6);
    });

    it("adds sun rim light only on faces seen edge-on that face the sun", () => {
      const day = light(lights.day);
      const noRim = light({ ...lights.day, rim: 0 });
      const edgeOn = new Vector3(-1, 0, 1).normalize(); // a column's left silhouette
      expect(luminance(shade(edgeOn, day))).toBeGreaterThan(luminance(shade(edgeOn, noRim)));
      const awayFromSun = new Vector3(1, 0, -1).normalize();
      expect(shade(awayFromSun, day).equals(shade(awayFromSun, noRim))).toBe(true);
    });
  },
);

describe.each(manifests.map((m) => [m.id, m] as const))(
  "baked lighting from every side (orbit-camera §6.2), theme %s",
  (_id, manifest) => {
    // Every preset the schema knows, so a new hour (dawn, night) joins the loop by itself.
    it.each(TimeOfDaySchema.options)(
      "keeps the two walls seen from each iso diagonal apart at %s",
      (time) => {
        const l = light(manifest.campus.lights[time]);
        const top = luminance(shade(UP, l));
        for (const yaw of ISO_YAWS) {
          const seen = Object.values(WALLS).filter((n) => n.dot(towardCamera(yaw)) > 0);
          expect(seen).toHaveLength(2);
          const [a = 0, b = 0] = seen.map((n) => luminance(shade(n, l)));
          // Relative to the top face, so dark presets are not asked for daylight contrast.
          expect(Math.abs(a - b), `${yaw}° at ${time}`).toBeGreaterThanOrEqual(0.08 * top);
        }
      },
    );

    it("leaves every face the home view sees as it was (north walls only)", () => {
      const day = light(manifest.campus.lights.day);
      const noNorth = (n: Vector3) => {
        const sun = Math.max(0, n.dot(day.sun));
        const view = new Vector3(1, 1, 1).normalize();
        const direct = sun * (1 + day.rim * (1 - Math.max(0, n.dot(view))) ** 2);
        const k = day.ground.clone().lerp(day.sky, 0.5 + 0.5 * n.y);
        k.add(day.sunColor.clone().multiplyScalar(direct));
        return new Color(Math.min(1, k.r), Math.min(1, k.g), Math.min(1, k.b));
      };
      for (const n of [UP, LEFT, RIGHT, new Vector3(1, 1, 0).normalize()]) {
        expect(sameColour(shade(n, day), noNorth(n)), n.toArray().join()).toBe(true);
      }
      const north = WALLS["-z"];
      expect(luminance(shade(north, day))).toBeLessThan(luminance(noNorth(north)) - 0.05);
    });
  },
);

describe("derived colours", () => {
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

  it.each(manifests.map((m) => [m.id, m] as const))(
    "keeps lit parts apart from the faces behind them at both hours, theme %s (QA r6)",
    (_id, manifest) => {
      // CIE76 ΔE on sRGB-in-linear colours. By day the lit tan reads at 23 to 33; at dusk the
      // sunlit +z walls baked to 12 (the watchtower's top slot vanished) and the market floor
      // behind the lanterns to 9 to 20 (pale boxes, not lights).
      const lab = (c: Color) => {
        const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
        const x = f((0.4124 * c.r + 0.3576 * c.g + 0.1805 * c.b) / 0.95047);
        const y = f(luminance(c));
        const z = f((0.0193 * c.r + 0.1192 * c.g + 0.9505 * c.b) / 1.08883);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)] as const;
      };
      const deltaE = (a: Color, b: Color) => {
        const [p, q] = [lab(a), lab(b)];
        return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      };
      for (const time of TIMES) {
        const pal = palette(manifest.campus, time);
        const baked = (n: Vector3, c: Color) => c.clone().multiply(shade(n, pal.light));
        const behind = {
          ...Object.fromEntries(
            (["lib", "wt", "mk"] as const).flatMap((id) => [
              [`${id} wall +z`, baked(LEFT, pal[id].wall)],
              [`${id} wall +x`, baked(RIGHT, pal[id].wall)],
            ]),
          ),
          "market floor": baked(UP, pal.mk.trim),
        };
        for (const [face, colour] of Object.entries(behind)) {
          expect(deltaE(pal.lit, colour), `${face} at ${time}`).toBeGreaterThanOrEqual(20);
        }
      }
    },
  );
});

describe("zone building looks (N9)", () => {
  it("follow the zone status, then the stars", () => {
    expect(siteLook("coming_soon", true)).toBe("coming_soon");
    expect(siteLook("open", false)).toBe("open");
    expect(siteLook("open", true)).toBe("lit");
  });

  const zone = (location: "library" | "market", id: string, status: "open" | "coming_soon") => ({
    id,
    location,
    status,
    name: id,
    summary: "",
    concepts: [],
    level_count: 1,
  });
  const sites = siteInfo([
    zone("library", "thu-vien", "open"),
    zone("market", "cho", "coming_soon"),
  ]);

  it("read the stars under each zone's id, and never light a zone that is not open", () => {
    const stars = { "thu-vien": { "grounded-citation": 1 as const }, cho: { routing: 3 as const } };
    expect(siteLooks(sites, stars, true)).toEqual({
      library: "lit",
      watchtower: "coming_soon",
      market: "coming_soon",
    });
    // Stars stored under the location instead of the zone id do not count.
    expect(siteLooks(sites, { library: { "grounded-citation": 1 } }, true).library).toBe("open");
  });

  it("keep every open zone lit while nothing saves stars yet (QA r2)", () => {
    // No star can be earned until the workbench calls recordStars: dark windows would be a loss.
    expect(siteLooks(sites, {}, false)).toEqual({
      library: "lit",
      watchtower: "coming_soon",
      market: "coming_soon",
    });
    expect(siteLooks(sites, {})).toEqual(siteLooks(sites, {}, STARS_SAVED));
  });

  it("light every open zone's entrance, and more of it once starred (art §1.2 rules 3, 4)", () => {
    const manifest = manifests[0];
    if (!manifest) throw new Error("Need a theme.");
    const builders = { library: buildLibrary, watchtower: buildWatchtower, market: buildMarket };
    for (const time of TIMES) {
      const pal: Palette = palette(manifest.campus, time);
      for (const [id, buildSite] of Object.entries(builders)) {
        const [comingSoon, open, lit] = (["coming_soon", "open", "lit"] as const).map(
          (look: SiteLook) => {
            const geometry = buildSite(pal, look);
            const count = verticesColoured(geometry, pal.lit);
            geometry.dispose();
            return count;
          },
        );
        // Lit parts skip the bake, so they keep the full colour at both hours.
        const at = `${id} at ${time}`;
        expect(comingSoon, at).toBe(0);
        // Two entrance lamps (a 12-triangle box each); the library also lights its door, a quad
        // and a half-disc of 8 triangles (QA r2), and the watchtower its door on the west, a quad
        // (orbit-camera D13). The market hall has no door.
        expect(open, at).toBe({ library: 102, watchtower: 78, market: 72 }[id]);
        expect(lit, at).toBeGreaterThan(open ?? 0);
        if (id === "library") expect(lit, at).toBeGreaterThan((open ?? 0) + 100); // 13 windows
      }
    }
  });

  it("keeps the library's lamps clear of its lit door and the librarian's badge (QA r3)", () => {
    // The lit door is the sign that a zone is open; lamps in the same tan read as part of it.
    const manifest = manifests[0];
    if (!manifest) throw new Error("Need a theme.");
    const pal = palette(manifest.campus, "day");
    const library = buildLibrary(pal, "open");
    const position = library.getAttribute("position");
    const colour = library.getAttribute("color");
    const view = viewFor(1280, 800);
    const box = (points: Screen[]) => ({
      minX: Math.min(...points.map((p) => p.sx)),
      maxX: Math.max(...points.map((p) => p.sx)),
      minY: Math.min(...points.map((p) => p.sy)),
      maxY: Math.max(...points.map((p) => p.sy)),
    });
    const vertices = (keep: (v: Vector3, i: number) => boolean) => {
      const out: Screen[] = [];
      for (let i = 0; i < position.count; i += 1) {
        const v = new Vector3().fromBufferAttribute(position, i);
        if (keep(v, i)) out.push(toScreen(v.x, v.y, v.z));
      }
      return out;
    };
    // The door and its arch: the lit parts on the façade plane.
    const door = box(vertices((v, i) => v.x < -9.3 && Math.abs(colour.getX(i) - pal.lit.r) < 1e-6));
    // The "!" badge: 28 px square (size-7) standing on its anchor.
    const [ax, ay, az] = LABEL_ANCHORS.lan;
    const anchor = toScreen(ax, ay, az);
    const half = 14 / view.zoom;
    const badge = {
      minX: anchor.sx - half,
      maxX: anchor.sx + half,
      minY: anchor.sy,
      maxY: anchor.sy + 2 * half,
    };
    type Box = typeof door;
    const gapPx = (a: Box, b: Box) =>
      Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minY - b.maxY, b.minY - a.maxY) * view.zoom;
    const spots = entranceLampSpots("library");
    expect(spots).toHaveLength(2);
    for (const spot of spots) {
      const lamp = box(
        vertices((v) => Math.abs(v.x - spot.x) < 0.2 && Math.abs(v.z - spot.z) < 0.2),
      );
      const at = `lamp (${spot.x}, ${spot.z})`;
      expect(gapPx(lamp, door), at).toBeGreaterThanOrEqual(8);
      expect(gapPx(lamp, badge), at).toBeGreaterThanOrEqual(8);
    }
    library.dispose();
  });
});

/** The two walls each "coming soon" scaffold stands outside: axis and wall planes (D12, D14, D16). */
const SCAFFOLD_WALLS = {
  library: ["z", -5.8, -0.8],
  watchtower: ["z", -5.8, -3.8],
  market: ["x", 7.0, 11.0],
} as const;

describe.each(manifests.map((m) => [m.id, m] as const))(
  "four dressed sides (orbit-camera §5.2), theme %s",
  (_id, manifest) => {
    // A magenta lake makes ~glass the one colour whose green stays under half its red and blue,
    // through the bake, the "coming soon" grey and the haze of the back buildings.
    const campus = { ...manifest.campus, water: "#ff00ff" };
    const pal = palette(campus, "day");
    const { archetype, colonnades } = campus.landmark;
    const baked = (c: Color, n: Vector3) => c.clone().multiply(shade(n, pal.light));

    it("glazes the back and west walls like the front and east (D1-D8, D11, D13, D17-D20)", () => {
      const groups = {
        landmark: buildLandmark(pal, archetype, colonnades),
        library: buildLibrary(pal, "coming_soon"),
        watchtower: buildWatchtower(pal, "coming_soon"),
        terrain: buildTerrain(pal, colonnades),
      };
      for (const [name, geometry] of Object.entries(groups)) {
        const glass = countBySide(geometry, ({ colour: c }) => c.g < 0.5 * Math.min(c.r, c.b));
        expect(glass["+x"] + glass["+z"], name).toBeGreaterThan(0);
        expect(glass["-x"], `${name} -x`).toBeGreaterThanOrEqual(0.5 * glass["+x"]);
        expect(glass["-z"], `${name} -z`).toBeGreaterThanOrEqual(0.5 * glass["+z"]);
        geometry.dispose();
      }
    });

    it("dresses the backs of the clock, the gate and the market (D9, D10, D15)", () => {
      const landmark = buildLandmark(pal, archetype, colonnades);
      if (archetype === "clock-tower") {
        // Emissive faces keep the plaza colour exactly: one per wall of the clock box.
        const faces = countBySide(landmark, (t) => sameColour(t.colour, pal.plaza));
        for (const side of Object.keys(WALLS) as Face[]) {
          expect(faces[side], `clock ${side}`).toBeGreaterThan(0);
        }
      }
      if (colonnades) {
        // Iron arches on the back of the gate (z 11.5), apart from the fence behind it.
        const iron = countBySide(
          landmark,
          (t) => t.centre.z < 12 && sameColour(t.colour, baked(pal.iron, t.normal)),
        );
        expect(iron["-z"]).toBeGreaterThanOrEqual(10);
      }
      landmark.dispose();
      const market = buildMarket(pal, "open");
      const northAwning = triangles(market).filter(
        (t) =>
          t.normal.y > 0.5 &&
          t.normal.z < -0.1 &&
          sameColour(t.colour, baked(pal.mk.roof, t.normal)),
      );
      expect(northAwning.length).toBeGreaterThanOrEqual(2);
      market.dispose();
    });

    it("scaffolds every coming-soon zone on two opposite walls (art §1.2 rule 4)", () => {
      const builders = { library: buildLibrary, watchtower: buildWatchtower, market: buildMarket };
      const key = (v: Vector3) =>
        v
          .toArray()
          .map((n) => n.toFixed(4))
          .join();
      for (const [id, buildSite] of Object.entries(builders)) {
        const [axis, low, high] = SCAFFOLD_WALLS[id as keyof typeof builders];
        const open = buildSite(pal, "open");
        const soon = buildSite(pal, "coming_soon");
        // Trunk-coloured parts that are not scaffolding (the market's stalls) stand in both.
        const kept = new Set(
          triangles(open)
            .filter((t) => sameColour(t.colour, baked(pal.trunk, t.normal)))
            .map((t) => key(t.centre)),
        );
        const scaffold = triangles(soon).filter(
          (t) =>
            sameColour(t.colour, baked(desaturate(pal.trunk), t.normal)) &&
            !kept.has(key(t.centre)),
        );
        expect(
          scaffold.some((t) => t.centre[axis] > high),
          `${id} beyond ${high}`,
        ).toBe(true);
        expect(
          scaffold.some((t) => t.centre[axis] < low),
          `${id} beyond ${low}`,
        ).toBe(true);
        open.dispose();
        soon.dispose();
      }
    });
  },
);

describe.each(manifests.map((m) => [m.id, m] as const))(
  "scene budget, theme %s",
  (_id, manifest) => {
    // Measured 14 draw calls (v0.3's 13 plus the sun-shadow overlay). Triangles with the looks
    // built here (open, coming soon, coming soon): 19,248 (spire-hall) / 16,186 (clock-tower) in
    // v0.3; N8/N9 drop the unstarred library's shelves (-88) and add foam and the sun-shadow
    // overlay (campus-scene v0.3 §13.4 has the measured totals). v0.4 dresses all four sides
    // (orbit-camera §5.2) inside the same groups: by day 20,097 -> 21,413 (spire-hall) and
    // 17,020 -> 18,268 (clock-tower); 21,585 with every zone lit.
    // The CC0 props (dressing plan §3) add one draw call and 7,818 triangles (7,914 planned,
    // less the 384 of the dropped wall rocks, plus the parasols' 288 back faces), the six new
    // lamps 264 in the terrain and their sun shade 56 in the overlay.
    // v0.4 people (npc-cast v0.4, integration spec §6): five baked ground discs replace the
    // librarian's blob (draw calls stay 14 with the statues: +1 merged NPC statues, -1 blob),
    // then the baked cast swaps the four statue meshes for seven skinned ones (+3; the six
    // figures are 5,235 triangles with the player's x-ray, cast.test.ts).
    // Together, measured: 14 draw calls with the statues, 15 once the props arrive, 18 with the
    // cast too (main's 15 + the cast's 3 extra meshes). Triangles with props and cast, both
    // themes, both hours, every zone lit at most: 34,422 (spire-hall by day; clock-tower 31,277).
    // The cast's 5,235 beat its ~1,020 estimate (npc-cast v0.4 §11), hence caps of 18 draw calls
    // and 34,500 triangles (the measured peak rounded up): under 60% of the brief's 60k and far
    // inside the 60 FPS rule's < 80 draw calls (art §6.1).
    it.each(TIMES)("stays well inside 40 draw calls and 60k triangles at %s", (time) => {
      if (!CAST) throw new Error("cast.json does not parse");
      for (const lit of [false, true]) {
        const { result, unmount } = build(manifest, time, lit);
        const g = result.current;
        expect(sceneBudget(g).drawCalls).toBe(14); // statues, until the props and the cast arrive
        const dressing = buildDressing(props, g.palette);
        const statues = sceneBudget(g, null, dressing);
        const cast = sceneBudget(g, CAST, dressing);
        expect(statues.drawCalls).toBe(15);
        expect(sceneBudget(g, CAST).drawCalls).toBe(17);
        expect(cast.drawCalls).toBe(18);
        expect(statues.triangles).toBeLessThan(cast.triangles);
        expect(cast.triangles).toBeLessThanOrEqual(34_500);
        dressing.dispose();
        unmount();
      }
    });

    it("stands the four NPC statues at their spots, 1.36 tall, and bakes a disc under everyone", () => {
      const { result, unmount } = build(manifest);
      const { npcs, terrain } = result.current;
      expect(triangleCount(npcs)).toBe(4 * (32 + 32 + 80 + 32));
      npcs.computeBoundingBox();
      expect(npcs.boundingBox?.max.y).toBeCloseTo(0.045 + 1.36, 6);
      const position = terrain.getAttribute("position");
      const discs = new Map<string, number>();
      for (let i = 0; i + 2 < position.count; i += 3) {
        const ys = [0, 1, 2].map((k) => position.getY(i + k));
        if (ys.some((y) => Math.abs(y - SPEAKER_DISC_Y) > 1e-6)) continue;
        const a = new Vector3().fromBufferAttribute(position, i);
        const b = new Vector3().fromBufferAttribute(position, i + 1);
        const c = new Vector3().fromBufferAttribute(position, i + 2);
        expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);
        const who = SPEAKERS.find(({ spot }) => Math.hypot(a.x - spot.x, a.z - spot.z) <= 0.4001);
        if (!who) throw new Error(`disc vertex (${a.x}, ${a.z}) under nobody`);
        discs.set(who.id, (discs.get(who.id) ?? 0) + 1);
      }
      expect(discs).toEqual(new Map(SPEAKERS.map(({ id }) => [id, SPEAKER_DISC_SEGMENTS])));
      unmount();
    });

    it.each(TIMES)("casts sun shadows on the base only, longer at dusk (%s)", (time) => {
      const { result, unmount } = build(manifest, time);
      const position = result.current.shadow.getAttribute("position");
      let reach = -Infinity;
      const off: string[] = [];
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i);
        const z = position.getZ(i);
        const inside =
          x >= BASE.minX - 1e-4 &&
          x <= BASE.maxX + 1e-4 &&
          z >= BASE.minZ - 1e-4 &&
          z <= BASE.maxZ + 1e-4;
        if (!inside) off.push(`(${x}, ${z})`);
        reach = Math.max(reach, x);
      }
      expect(off).toEqual([]);
      // The watchtower's shadow passes its east wall (x 11.8) by day, and the base edge at dusk.
      expect(reach).toBeGreaterThan(time === "day" ? 12 : BASE.maxX - 1e-3);
      unmount();
    });

    it.each(TIMES)("shades the ground behind every tree crown and the gate (%s, QA r2)", (time) => {
      const { result, unmount } = build(manifest, time);
      const { sun } = result.current.palette.light;
      const cast = (label: string, x: number, y: number, z: number) => ({
        label,
        x: x - (sun.x / sun.y) * y,
        z: z - (sun.z / sun.y) * y,
      });
      const points = [
        // Crown centres: the round crown's middle, the cypress's widest part.
        ...TREE_INSTANCES.map((tree) =>
          cast(
            `tree (${tree.x}, ${tree.z})`,
            tree.x,
            (tree.kind === "round" ? 1.55 : 0.6) * tree.scaleY,
            tree.z,
          ),
        ),
        // Inside the arch gate's middle block, or the pier gate's lintel.
        cast("gate", 0, 1.5, 12.15),
      ].filter((p) => p.x > BASE.minX && p.x < BASE.maxX && p.z > BASE.minZ && p.z < BASE.maxZ);
      expect(points.length).toBeGreaterThan(20);
      const unshaded = points.filter((p) => !inShadow(result.current.shadow, p));
      expect(unshaded.map((p) => p.label)).toEqual([]);
      unmount();
    });

    it.each(TIMES)("shades the ground behind the bulky props (%s, review r1)", (time) => {
      // Without it the gazebo, stall, board, palms and parasols looked pasted on beside the
      // trees. Oracle: the point 0.9 up each copy's baked height, cast along the sun.
      const { result, unmount } = build(manifest, time);
      const { sun } = result.current.palette.light;
      const unshaded = DRESSING.filter((row) => CASTING_PROPS.includes(row.prop)).flatMap((row) => {
        const data = props.props[row.prop];
        if (!data) throw new Error(`no ${row.prop}`);
        const sy = typeof row.scale === "number" ? row.scale : row.scale[1];
        let top = 0;
        for (let i = 1; i < data.position.length; i += 3)
          top = Math.max(top, (data.position[i] ?? 0) / props.q);
        const y = (row.y ?? 0) + 0.9 * top * sy;
        return (
          row.at
            .map(([x, z]) => ({
              label: `${row.prop} (${x}, ${z})`,
              x: x - (sun.x / sun.y) * y,
              z: z - (sun.z / sun.y) * y,
            }))
            // A palm's shade at dusk falls off the base, which clips it.
            .filter((p) => p.x > BASE.minX && p.x < BASE.maxX && p.z > BASE.minZ && p.z < BASE.maxZ)
            .filter((p) => !inShadow(result.current.shadow, p))
            .map((p) => p.label)
        );
      });
      expect(unshaded).toEqual([]);
      unmount();
    });

    it.each(TIMES)("darkens exactly the trees a building shades (%s, QA r3)", (time) => {
      // Lambert trees take no shadow, so the scene darkens those whose crown centre a building
      // hides from the sun. Oracle: rays from the crown centre (and 0.3 to each side) towards
      // the sun, against the built campus without trees. A tree whose five rays disagree stands
      // on a shadow edge and is left out; the casters are simplified hulls.
      const { result, unmount } = build(manifest, time);
      const g = result.current;
      const material = new MeshBasicMaterial({ side: DoubleSide });
      const meshes = [g.terrain, g.landmark, g.library, g.watchtower, g.market].map(
        (geometry) => new Mesh(geometry, material),
      );
      const ray = new Raycaster();
      const sun = g.palette.light.sun.clone().normalize();
      const offsets = [
        [0, 0],
        [0.3, 0],
        [-0.3, 0],
        [0, 0.3],
        [0, -0.3],
      ] as const;
      const wrong: string[] = [];
      let hidden = 0;
      for (const tree of TREE_INSTANCES) {
        const y = (tree.kind === "round" ? 1.55 : 0.6) * tree.scaleY;
        const hits = offsets.map(([dx, dz]) => {
          ray.set(new Vector3(tree.x + dx, y, tree.z + dz), sun);
          return ray.intersectObjects(meshes, false).length > 0;
        });
        const shaded = g.shadedTrees.has(tree);
        if (hits.every(Boolean)) hidden += 1;
        if ((hits.every(Boolean) && !shaded) || (!hits.some(Boolean) && shaded)) {
          wrong.push(`${tree.kind} (${tree.x}, ${tree.z}) ${shaded ? "shaded" : "sunlit"}`);
        }
      }
      expect(wrong).toEqual([]);
      if (time === "dusk") expect(hidden).toBeGreaterThan(0);
      material.dispose();
      unmount();
    });

    it("lays the shadow overlay over every ground layer (QA r2)", () => {
      // A ground decal at or above SHADOW_Y would bring back light stripes across the shadows.
      // Raised items under 0.03 that are meant to cover the overlay are listed by height.
      const { result, unmount } = build(manifest);
      const position = result.current.terrain.getAttribute("position");
      const over = new Map<number, string>();
      for (let i = 0; i + 2 < position.count; i += 3) {
        const y = position.getY(i);
        const flat = position.getY(i + 1) === y && position.getY(i + 2) === y;
        const raised = RAISED.some((h) => Math.abs(h - y) < 1e-6);
        if (flat && y >= SHADOW_Y && y < 0.03 && !raised) {
          over.set(y, `y ${y} at (${position.getX(i)}, ${position.getZ(i)})`);
        }
      }
      expect([...over.values()]).toEqual([]);
      unmount();
    });

    it("casts shadows only from blocks the built campus has", () => {
      // The casters are simplified copies of the builders' boxes. Every caster corner must sit
      // within 0.25 (x, z) of a real vertex, and its top within 0.05 of a real vertex inside its
      // extent, so a building moved or resized without its caster fails here.
      const { result, unmount } = build(manifest);
      const g = result.current;
      const vertices: Vector3[] = [];
      for (const geometry of [g.terrain, g.landmark, g.library, g.watchtower, g.market]) {
        const position = geometry.getAttribute("position");
        for (let i = 0; i < position.count; i += 1) {
          if (position.getY(i) > 0.3) vertices.push(new Vector3().fromBufferAttribute(position, i));
        }
      }
      const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;
      const { archetype, colonnades } = manifest.campus.landmark;
      const loose = shadowCasters(archetype, colonnades).flatMap((caster) => {
        const top = Math.max(...caster.map((p) => p.y));
        const xs = caster.map((p) => p.x);
        const zs = caster.map((p) => p.z);
        const inside = (v: Vector3) =>
          v.x >= Math.min(...xs) - 0.25 &&
          v.x <= Math.max(...xs) + 0.25 &&
          v.z >= Math.min(...zs) - 0.25 &&
          v.z <= Math.max(...zs) + 0.25;
        const label = `caster at (${xs[0]}, ${zs[0]}) top ${top}`;
        const cornersMatch = caster.every((p) =>
          vertices.some((v) => near(v.x, p.x, 0.25) && near(v.z, p.z, 0.25)),
        );
        const topMatches = vertices.some((v) => inside(v) && near(v.y, top, 0.05));
        return cornersMatch && topMatches ? [] : [label];
      });
      expect(loose).toEqual([]);
      unmount();
    });

    it("keeps every building, tree and the base inside ORBIT_FRAME at every yaw (orbit §1.3)", () => {
      const { result, unmount } = build(manifest);
      const points = framedPoints(result.current);
      const outside: string[] = [];
      for (let d = 0; d < 360; d += 1) {
        let [left, right, low, high] = [Infinity, -Infinity, Infinity, -Infinity];
        eachAroundPivot(points, deg(d), (sx, sy) => {
          left = Math.min(left, sx);
          right = Math.max(right, sx);
          low = Math.min(low, sy);
          high = Math.max(high, sy);
        });
        if (-left > ORBIT_FRAME.half || right > ORBIT_FRAME.half) outside.push(`${d}°: x`);
        if (high > ORBIT_FRAME.top || low < ORBIT_FRAME.bottom) outside.push(`${d}°: y`);
      }
      expect(outside).toEqual([]);
      unmount();
    });

    it("leaves both top HUD corners and the view buttons sky in overview at every yaw", () => {
      const { result, unmount } = build(manifest);
      const dressing = buildDressing(props, result.current.palette);
      // The props and the four standing NPCs (their statues are as tall as the baked figures).
      const points = framedPoints(result.current, [dressing, result.current.npcs]);
      dressing.dispose();
      const views = [
        [1280, 800],
        [1366, 657],
        [1280, 720],
      ].map(([width = 0, height = 0]) => viewFor(width, height));
      // A 1° sweep can miss up to 2.4 px of a 0.1° one, so ask for 3 px under the corners.
      const GAP = 3;
      for (const view of views) expect(view.mode).toBe("overview");
      // The overview centre sits 0.24 below PIVOT (camera.ts desiredCentre).
      const middle = (ORBIT_FRAME.top + ORBIT_FRAME.bottom) / 2;
      const hits = new Set<string>();
      for (let d = 0; d < 360; d += 1) {
        eachAroundPivot(points, deg(d), (sx, sy) => {
          for (const view of views) {
            const px = view.width / 2 + sx * view.zoom;
            const py = view.height / 2 - (sy - middle) * view.zoom;
            const corner =
              py < HUD_CORNER.height + GAP &&
              (px < HUD_CORNER.width || px > view.width - HUD_CORNER.width);
            const buttons =
              px > view.width - VIEW_CONTROLS.width && py > view.height - VIEW_CONTROLS.height;
            if (corner || buttons) hits.add(`${view.width}×${view.height} at ${d}°`);
          }
        });
      }
      expect([...hits]).toEqual([]);
      unmount();
      // A 1° sweep over every vertex, props and NPCs included, for three viewports: slow but exhaustive.
    }, 20_000);

    // Composed for the home view only: from other angles the needle may stand before anything.
    it("keeps the screen behind the spire clear of raised terrain and tree crowns at home", () => {
      const { result, unmount } = build(manifest);
      const vertices = screenVertices(result.current.terrain);
      const hits = [];
      for (let i = 0; i + 2 < vertices.length; i += 3) {
        const tri = vertices.slice(i, i + 3);
        if (!tri.some((v) => v.y > 0.05)) continue;
        const sxs = tri.map((v) => v.sx);
        const sys = tri.map((v) => v.sy);
        const bounds = {
          minX: Math.min(...sxs),
          maxX: Math.max(...sxs),
          minY: Math.min(...sys),
          maxY: Math.max(...sys),
        };
        if (!outsideCrown(bounds)) hits.push(bounds);
      }
      expect(hits).toEqual([]);
      const crownHits = crowns.filter(
        ({ sx, sy, half }) =>
          !outsideCrown({ minX: sx - half, maxX: sx + half, minY: sy - half, maxY: sy + half }),
      );
      expect(crownHits).toEqual([]);
      unmount();
    });

    it("walks a click high on the main building or the watchtower to the face the camera sees", () => {
      const { result, unmount } = build(manifest);
      const material = new MeshBasicMaterial();
      const group = statics(result.current, material);
      const raycaster = new Raycaster();
      for (const [x, y, z] of [...TALL[manifest.campus.landmark.archetype], WATCHTOWER_TOP]) {
        const at = `(${x}, ${y}, ${z})`;
        raycaster.set(new Vector3(x, y, z).addScaledVector(VIEW, -40), VIEW);
        const goal = clickGoal(raycaster, group);
        expect(goal, at).not.toBeNull();
        if (!goal) continue;
        const route = routeTo(SPAWN, goal);
        for (const waypoint of route.slice(0, -1)) expect(waypoint.z, at).toBeGreaterThan(-6);
        expect(walkRoute(SPAWN, route).z, at).toBeGreaterThan(-6);
      }
      material.dispose();
      unmount();
    });

    it.each(DIAGONALS)(
      "walks a click high on the main building to the side seen from %f rad",
      (yaw) => {
        const { result, unmount } = build(manifest);
        const material = new MeshBasicMaterial();
        const group = statics(result.current, material);
        const raycaster = new Raycaster();
        const direction = viewDirection(yaw);
        const toward = towardFor(yaw);
        for (const [x, y, z] of TALL[manifest.campus.landmark.archetype]) {
          const at = `(${x}, ${y}, ${z})`;
          raycaster.set(new Vector3(x, y, z).addScaledVector(direction, -40), direction);
          const goal = clickGoal(raycaster, group);
          expect(goal, at).not.toBeNull();
          if (!goal) continue;
          const stop = walkRoute(SPAWN, routeTo(SPAWN, goal, toward));
          const { centre } = LANDMARK;
          const side = (stop.x - centre.x) * Math.sin(yaw) + (stop.z - centre.z) * Math.cos(yaw);
          expect(side, at).toBeGreaterThan(0);
        }
        // The watchtower is a zone: a click on it still walks to its door.
        const [x, y, z] = WATCHTOWER_TOP;
        raycaster.set(new Vector3(x, y, z).addScaledVector(direction, -40), direction);
        expect(clickGoal(raycaster, group)).toEqual(siteFor("watchtower").door);
        material.dispose();
        unmount();
      },
    );

    it("gives a click on the librarian to whatever the ray meets first (pickNpc, orbit §2.6)", () => {
      const { result, unmount } = build(manifest);
      const material = new MeshBasicMaterial();
      const group = statics(result.current, material);
      const raycaster = new Raycaster();
      const speakers = [{ id: "lan", spot: NPC_SPOT }] as const;
      const aim = (yaw: number, x: number, y: number, z: number) => {
        const direction = viewDirection(yaw);
        raycaster.set(new Vector3(x, y, z).addScaledVector(direction, -40), direction);
      };
      // From the west the library's porch beam stands in front of her left side.
      aim(deg(270), NPC_SPOT.x - 0.44, 0.7, NPC_SPOT.z);
      expect(pickNpc(raycaster, group, speakers)).toBeNull();
      expect(clickGoal(raycaster, group)).toEqual(siteFor("library").door);
      aim(deg(270), NPC_SPOT.x, 0.7, NPC_SPOT.z);
      expect(pickNpc(raycaster, group, speakers)).toBe("lan");
      // Her head counts too (the v0.3 plane at 0.7 missed it).
      aim(HOME_YAW, NPC_SPOT.x, 1.4, NPC_SPOT.z);
      expect(pickNpc(raycaster, group, speakers)).toBe("lan");
      // Every NPC stands in clear view from home (npc-cast v0.4 §4), feet to head.
      for (const { id, spot } of NPCS) {
        for (const y of [0.2, 0.7, 1.3]) {
          aim(HOME_YAW, spot.x, y, spot.z);
          expect(pickNpc(raycaster, group, SPEAKERS), `${id} at ${y}`).toBe(id);
        }
      }
      // A click just over the tallest head (statues 1.46, figures 1.31) is not theirs: aim
      // over the box's far top corner, the highest point the box shows on screen.
      const away = viewDirection(HOME_YAW);
      for (const { id, spot } of SPEAKERS) {
        const [x, z] = [spot.x + 0.35 * Math.sign(away.x), spot.z + 0.35 * Math.sign(away.z)];
        aim(HOME_YAW, x, 1.55, z);
        expect(pickNpc(raycaster, group, SPEAKERS), `over ${id}`).not.toBe(id);
      }
      // From behind the main building the registrar is hidden: the click is the building's.
      const registrar = NPCS.find(({ id }) => id === "registrar")?.spot ?? SPAWN;
      aim(deg(180), registrar.x, 0.7, registrar.z);
      expect(pickNpc(raycaster, group, SPEAKERS)).toBeNull();
      material.dispose();
      unmount();
    });

    it("walks a click on the market's awnings to the market door (QA r4)", () => {
      const { result, unmount } = build(manifest);
      const material = new MeshBasicMaterial();
      const group = statics(result.current, material);
      const raycaster = new Raycaster();
      for (const [x, y, z] of AWNINGS) {
        raycaster.set(new Vector3(x, y, z).addScaledVector(VIEW, -40), VIEW);
        expect(clickGoal(raycaster, group), `(${x}, ${y}, ${z})`).toEqual(siteFor("market").door);
      }
      material.dispose();
      unmount();
    });

    it("builds the three-arch gate only for themes with colonnades", () => {
      const { result, unmount } = build(manifest);
      // Gate and fence stand in front of the loop road (z > 11.4); the arch gate's attic
      // reaches y 3.0, the town's pier gateway only 1.58.
      const position = result.current.landmark.getAttribute("position");
      let gateTop = 0;
      for (let i = 0; i < position.count; i += 1) {
        if (position.getZ(i) > 11.4) gateTop = Math.max(gateTop, position.getY(i));
      }
      expect(gateTop).toBeCloseTo(manifest.campus.landmark.colonnades ? 3.0 : 1.58);
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
      ({ market, time }) => useCampusGeometry(first.campus, time, "open", "coming_soon", market),
      { initialProps: { market: "coming_soon" as SiteLook, time: "day" as TimeOfDay } },
    );
    const before = result.current;
    rerender({ market: "open", time: "day" });
    const opened = result.current;
    expect(opened.market).not.toBe(before.market);
    // An opened zone drops its scaffolding (posts and boards east of the hall, under its awning).
    const scaffolded = (geometry: BufferGeometry) => {
      const position = geometry.getAttribute("position");
      for (let i = 0; i < position.count; i += 1) {
        if (position.getX(i) > 11.06 && position.getY(i) < 1.3) return true;
      }
      return false;
    };
    expect(scaffolded(before.market)).toBe(true);
    expect(scaffolded(opened.market)).toBe(false);
    expect(opened.library).toBe(before.library);
    expect(opened.terrain).toBe(before.terrain);
    // A new hour re-bakes every group.
    rerender({ market: "open", time: "dusk" });
    expect(result.current.terrain).not.toBe(opened.terrain);
    expect(result.current.library).not.toBe(opened.library);
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
