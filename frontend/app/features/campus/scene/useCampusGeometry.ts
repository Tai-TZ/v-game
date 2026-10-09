import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";

import type { CampusTheme } from "~/features/theme/schema";

import type { SiteLook } from "../sites";
import type { Bake, Phase } from "../sky";
import {
  BLOB_SEGMENTS,
  buildAo,
  buildCypress,
  buildLan,
  buildLandmark,
  buildLibrary,
  buildMarket,
  buildNpcs,
  buildPlayer,
  buildRoundTree,
  buildShadows,
  buildTerrain,
  buildWatchtower,
  RING_SEGMENTS,
  TREE_INSTANCES,
  treesInShade,
  type TreeInstance,
} from "./campus";
import { CAST_ROLES, type CastJson } from "./cast";
import { palette, type Palette } from "./palette";
import { triangleCount } from "./primitives";

export interface CampusGeometry {
  /** The look's colours: the phase's preset under the weather, baked into the static groups. */
  palette: Palette;
  /** The theme's own colours, for what rebuilds only with the theme (figures, trees). */
  base: Palette;
  /** Static groups: one merged geometry, one draw call each. */
  terrain: BufferGeometry;
  landmark: BufferGeometry;
  library: BufferGeometry;
  watchtower: BufferGeometry;
  market: BufferGeometry;
  /** Sun-shadow overlay (N8): one draw call, multiplied over the ground; not a click target. */
  shadow: BufferGeometry;
  /** Contact darkening (art §2.4): one draw call, multiplied over the ground; not a click target. */
  ao: BufferGeometry;
  /** Trees standing in a building's shadow, darkened per instance (QA r3). */
  shadedTrees: ReadonlySet<TreeInstance>;
  /** Instanced (one draw call per kind). */
  roundTree: BufferGeometry;
  cypress: BufferGeometry;
  /**
   * Statues shown until the baked cast arrives (and kept if it fails); the player geometry is
   * drawn twice (body + x-ray silhouette), the four NPCs are one merged mesh.
   */
  player: BufferGeometry;
  lan: BufferGeometry;
  npcs: BufferGeometry;
}

/** Disposes a geometry when it is replaced (theme or status change) or on unmount. */
function useDisposable(geometry: BufferGeometry): BufferGeometry {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * Builds the campus for the active theme, phase and baked weather. Groups rebuild only when their
 * inputs change: the static groups with the theme, the phase or the weather's bake (the light is
 * baked; rain ↔ storm and cloud ↔ fog share one bake), a zone's look for its own building (art
 * §6.2); the figures and the trees with the theme only, so a walk never snaps (campus v0.4 W0.6).
 */
export function useCampusGeometry(
  campus: CampusTheme,
  phase: Phase,
  bake: Bake,
  library: SiteLook,
  watchtower: SiteLook,
  market: SiteLook,
): CampusGeometry {
  const pal = useMemo(() => palette(campus, phase, bake), [campus, phase, bake]);
  const base = useMemo(() => palette(campus), [campus]);
  const { archetype, colonnades } = campus.landmark;
  return {
    palette: pal,
    base,
    terrain: useDisposable(useMemo(() => buildTerrain(pal, colonnades), [pal, colonnades])),
    shadow: useDisposable(
      useMemo(() => buildShadows(pal, archetype, colonnades), [pal, archetype, colonnades]),
    ),
    ao: useDisposable(useMemo(() => buildAo(pal, colonnades), [pal, colonnades])),
    shadedTrees: useMemo(
      () => treesInShade(pal, archetype, colonnades),
      [pal, archetype, colonnades],
    ),
    landmark: useDisposable(
      useMemo(() => buildLandmark(pal, archetype, colonnades), [pal, archetype, colonnades]),
    ),
    library: useDisposable(useMemo(() => buildLibrary(pal, library), [pal, library])),
    watchtower: useDisposable(useMemo(() => buildWatchtower(pal, watchtower), [pal, watchtower])),
    market: useDisposable(useMemo(() => buildMarket(pal, market), [pal, market])),
    // Plain colours, no baked light: the three.js lights shade them, so a new look keeps them.
    roundTree: useDisposable(useMemo(() => buildRoundTree(base), [base])),
    cypress: useDisposable(useMemo(() => buildCypress(base), [base])),
    player: useDisposable(useMemo(() => buildPlayer(base), [base])),
    lan: useDisposable(useMemo(() => buildLan(base), [base])),
    npcs: useDisposable(useMemo(() => buildNpcs(base, campus.npcs), [base, campus.npcs])),
  };
}

const ROUND_TREES = TREE_INSTANCES.filter((tree) => tree.kind === "round").length;
const CYPRESSES = TREE_INSTANCES.length - ROUND_TREES;

/** Triangles of the baked figures: the player's twice (body + x-ray), everyone else's once. */
export const castTriangles = (cast: CastJson) =>
  CAST_ROLES.reduce(
    (sum, role) => sum + (cast.roles[role].index.length / 3) * (role === "player" ? 2 : 1),
    0,
  );

/**
 * Draw calls and triangles of the hub scene as CampusScene renders it: 5 static groups, the
 * sun-shadow and contact overlays, 2 instanced tree meshes, the people, the player's ground
 * blob and the interaction ring; and the props (useDressing) once they have arrived. The people
 * are the statues (player + x-ray, librarian, the four NPCs merged) until `cast` arrives, then
 * one skinned mesh each plus the player's x-ray.
 */
export function sceneBudget(
  g: CampusGeometry,
  cast: CastJson | null = null,
  dressing: BufferGeometry | null = null,
): { drawCalls: number; triangles: number } {
  const statics = [g.terrain, g.landmark, g.library, g.watchtower, g.market, g.shadow, g.ao];
  if (dressing) statics.push(dressing);
  const people = cast
    ? { drawCalls: CAST_ROLES.length + 1, triangles: castTriangles(cast) }
    : {
        drawCalls: 4,
        triangles: triangleCount(g.player) * 2 + triangleCount(g.lan) + triangleCount(g.npcs),
      };
  const triangles =
    statics.reduce((sum, geometry) => sum + triangleCount(geometry), 0) +
    triangleCount(g.roundTree) * ROUND_TREES +
    triangleCount(g.cypress) * CYPRESSES +
    people.triangles +
    BLOB_SEGMENTS +
    RING_SEGMENTS * 2;
  return { drawCalls: statics.length + 2 + people.drawCalls + 1 + 1, triangles };
}
