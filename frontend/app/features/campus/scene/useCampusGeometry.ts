import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";

import type { CampusTheme, TimeOfDay } from "~/features/theme/schema";

import type { SiteLook } from "../sites";
import {
  BLOB_SEGMENTS,
  buildCypress,
  buildLan,
  buildLandmark,
  buildLibrary,
  buildMarket,
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
import { palette, type Palette } from "./palette";
import { triangleCount } from "./primitives";

export interface CampusGeometry {
  palette: Palette;
  /** Static groups: one merged geometry, one draw call each. */
  terrain: BufferGeometry;
  landmark: BufferGeometry;
  library: BufferGeometry;
  watchtower: BufferGeometry;
  market: BufferGeometry;
  /** Sun-shadow overlay (N8): one draw call, multiplied over the ground; not a click target. */
  shadow: BufferGeometry;
  /** Trees standing in a building's shadow, darkened per instance (QA r3). */
  shadedTrees: ReadonlySet<TreeInstance>;
  /** Instanced (one draw call per kind). */
  roundTree: BufferGeometry;
  cypress: BufferGeometry;
  /** Dynamic figures; the player geometry is drawn twice (body + x-ray silhouette). */
  player: BufferGeometry;
  lan: BufferGeometry;
}

/** Disposes a geometry when it is replaced (theme or status change) or on unmount. */
function useDisposable(geometry: BufferGeometry): BufferGeometry {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * Builds the campus for the active theme and time of day. Groups rebuild only when their inputs
 * change: theme or time for everything (the light is baked), a zone's look for its own building
 * (art §6.2).
 */
export function useCampusGeometry(
  campus: CampusTheme,
  time: TimeOfDay,
  library: SiteLook,
  watchtower: SiteLook,
  market: SiteLook,
): CampusGeometry {
  const pal = useMemo(() => palette(campus, time), [campus, time]);
  const { archetype, colonnades } = campus.landmark;
  return {
    palette: pal,
    terrain: useDisposable(useMemo(() => buildTerrain(pal, colonnades), [pal, colonnades])),
    shadow: useDisposable(
      useMemo(() => buildShadows(pal, archetype, colonnades), [pal, archetype, colonnades]),
    ),
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
    roundTree: useDisposable(useMemo(() => buildRoundTree(pal), [pal])),
    cypress: useDisposable(useMemo(() => buildCypress(pal), [pal])),
    player: useDisposable(useMemo(() => buildPlayer(pal), [pal])),
    lan: useDisposable(useMemo(() => buildLan(pal), [pal])),
  };
}

const ROUND_TREES = TREE_INSTANCES.filter((tree) => tree.kind === "round").length;
const CYPRESSES = TREE_INSTANCES.length - ROUND_TREES;

/**
 * Draw calls and triangles of the hub scene as CampusScene renders it: 5 static groups, the
 * sun-shadow overlay, 2 instanced tree meshes, player + x-ray, librarian, 2 ground blobs and the
 * interaction ring; and the props (useDressing) once they have arrived.
 */
export function sceneBudget(
  g: CampusGeometry,
  dressing?: BufferGeometry | null,
): { drawCalls: number; triangles: number } {
  const statics = [g.terrain, g.landmark, g.library, g.watchtower, g.market, g.shadow];
  if (dressing) statics.push(dressing);
  const triangles =
    statics.reduce((sum, geometry) => sum + triangleCount(geometry), 0) +
    triangleCount(g.roundTree) * ROUND_TREES +
    triangleCount(g.cypress) * CYPRESSES +
    triangleCount(g.player) * 2 +
    triangleCount(g.lan) +
    BLOB_SEGMENTS * 2 +
    RING_SEGMENTS * 2;
  return { drawCalls: statics.length + 2 + 2 + 1 + 2 + 1, triangles };
}
