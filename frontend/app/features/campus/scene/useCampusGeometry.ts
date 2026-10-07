import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";

import type { CampusTheme } from "~/features/theme/schema";
import type { ZoneStatus } from "~/features/zones/schema";

import {
  BLOB_SEGMENTS,
  buildCypress,
  buildLan,
  buildLandmark,
  buildLibrary,
  buildMarket,
  buildPlayer,
  buildRoundTree,
  buildTerrain,
  buildWatchtower,
  RING_SEGMENTS,
  TREE_INSTANCES,
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
 * Builds the campus for the active theme. Groups rebuild only when their inputs change: the
 * theme for everything, a zone's status for its own building (art §6.2).
 */
export function useCampusGeometry(
  campus: CampusTheme,
  library: ZoneStatus,
  watchtower: ZoneStatus,
  market: ZoneStatus,
): CampusGeometry {
  const pal = useMemo(() => palette(campus), [campus]);
  const { archetype, colonnades } = campus.landmark;
  return {
    palette: pal,
    terrain: useDisposable(useMemo(() => buildTerrain(pal, colonnades), [pal, colonnades])),
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
 * Draw calls and triangles of the hub scene as CampusScene renders it: 5 static groups,
 * 2 instanced tree meshes, player + x-ray, librarian, 2 ground blobs, interaction ring.
 */
export function sceneBudget(g: CampusGeometry): { drawCalls: number; triangles: number } {
  const statics = [g.terrain, g.landmark, g.library, g.watchtower, g.market];
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
