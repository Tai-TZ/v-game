import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { renderHook } from "@testing-library/react";
import {
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
  type BufferGeometry,
  type Color,
  type Material,
} from "three";
import { describe, expect, it } from "vitest";

import {
  parseThemeIndex,
  parseThemeManifest,
  type LandmarkArchetype,
  type ThemeManifest,
} from "~/features/theme/schema";

import {
  cameraCentre,
  CONTENT,
  desiredCentre,
  HUD_CORNER,
  toScreen,
  viewFor,
  type Screen,
} from "../camera";
import { OBSTACLES, routeTo, siteFor, SITES, SPAWN, WORLD_BOUNDS, type Vec2 } from "../layout";
import { step } from "../movement";
import { TREE_INSTANCES, treeMatrix } from "./campus";
import { desaturate, palette, shade } from "./palette";
import { triangleCount } from "./primitives";
import { sceneBudget, useCampusGeometry, type CampusGeometry } from "./useCampusGeometry";
import { clickGoal } from "./useHubFrame";

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
    // Measured 13 draw calls; 19,248 triangles (spire-hall) / 16,186 (clock-tower) with the
    // statuses built here (open, coming soon, coming soon), 120 fewer with all three open. The
    // cap is the larger plus about 20% (campus-scene v0.3 §8).
    it("stays well inside 40 draw calls and 60k triangles", () => {
      const { result, unmount } = build(manifest);
      const budget = sceneBudget(result.current);
      expect(budget.drawCalls).toBeLessThanOrEqual(16);
      expect(budget.triangles).toBeLessThanOrEqual(23_000);
      unmount();
    });

    it("keeps the landmark and terrain inside all four edges of the camera framing", () => {
      const { result, unmount } = build(manifest);
      for (const geometry of [result.current.landmark, result.current.terrain]) {
        // One expect per geometry: one per vertex timed out under load.
        const outside = screenVertices(geometry).filter(
          ({ sx, sy }) =>
            sx < CONTENT.minX || sx > CONTENT.maxX || sy < CONTENT.minY || sy > CONTENT.maxY,
        );
        expect(outside).toEqual([]);
      }
      unmount();
    });

    it("leaves both top HUD corners clear at 1280×800 (v0.3 §4.5)", () => {
      const { result, unmount } = build(manifest);
      const view = viewFor(1280, 800);
      expect(view.mode).toBe("overview");
      const centre = cameraCentre(desiredCentre({ sx: 0, sy: 0 }, { sx: 0, sy: 0 }, view), view);
      const inCorner = ({ sx, sy }: Screen) => {
        const px = view.width / 2 + (sx - centre.sx) * view.zoom;
        const py = view.height / 2 - (sy - centre.sy) * view.zoom;
        return (
          py < HUD_CORNER.height && (px < HUD_CORNER.width || px > view.width - HUD_CORNER.width)
        );
      };
      const g = result.current;
      for (const geometry of [g.terrain, g.landmark, g.library, g.watchtower, g.market]) {
        expect(screenVertices(geometry).filter(inCorner)).toEqual([]);
      }
      expect(crowns.filter(inCorner)).toEqual([]);
      unmount();
    });

    it("keeps the screen behind the spire clear of raised terrain and tree crowns", () => {
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
