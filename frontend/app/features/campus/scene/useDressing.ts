import { useEffect, useMemo, useState } from "react";
import { type BufferGeometry, type Color, Matrix4, Quaternion, Vector3 } from "three";

import { DRESSING, PROP_COLOURS, PROP_YAW0, type ColourSlot } from "../dressing";
import { STAGE, useSceneLoad } from "../hud/sceneLoad";
import type { Palette } from "./palette";
import { merge, part } from "./primitives";
import { buildProp, paintProp, parseProps, type PropsJson } from "./props";

export const PROPS_URL = "/models/props.json";

/** The props file, or null when it cannot be had: the campus then simply has no props. */
export async function fetchProps(load: typeof fetch = fetch): Promise<PropsJson | null> {
  try {
    const response = await load(PROPS_URL);
    return response.ok ? parseProps(await response.json()) : null;
  } catch {
    return null;
  }
}

const SLOT: Record<ColourSlot, (pal: Palette) => Color> = {
  foliage: (p) => p.foliage,
  hedge: (p) => p.hedge,
  cypress: (p) => p.cypress,
  trunk: (p) => p.trunk,
  dark: (p) => p.dark,
  bloom: (p) => p.bloom,
  band: (p) => p.band,
  sand: (p) => p.sand,
  "lm.wall": (p) => p.lm.wall,
  "lm.trim": (p) => p.lm.trim,
  "mk.roof": (p) => p.mk.roof,
  "mk.wall": (p) => p.mk.wall,
  "lib.roof": (p) => p.lib.roof,
};

/** Reverses every triangle: the back faces of a double-sided source, baked like any other face. */
function backFaces(geometry: BufferGeometry): BufferGeometry {
  const index = geometry.getIndex();
  if (!index) throw new Error("backFaces() needs an indexed geometry");
  const a = index.array;
  for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2] ?? 0, a[i + 1] ?? 0];
  return geometry;
}

const UP = new Vector3(0, 1, 0);
const matrix = new Matrix4();
const at = new Vector3();
const turn = new Quaternion();
const size = new Vector3();

/**
 * Every placed prop in one static geometry (one draw call), painted from the palette and baked
 * by world normal like the rest of the statics, so a theme or an hour only re-bakes it.
 */
export function buildDressing(props: PropsJson, pal: Palette): BufferGeometry {
  const parts = DRESSING.flatMap((row) => {
    const data = props.props[row.prop];
    if (!data) throw new Error(`props.json has no ${row.prop}`);
    const colours = data.mats.map((name) => {
      const slot = PROP_COLOURS[row.prop]?.[name];
      if (!slot) throw new Error(`prop ${row.prop}: no colour slot for ${name}`);
      return SLOT[slot](pal);
    });
    const s = row.scale;
    size.set(...(typeof s === "number" ? ([s, s, s] as const) : s));
    return row.at.flatMap(([x, z, yaw = 0]) => {
      const radians = ((yaw + (PROP_YAW0[row.prop] ?? 0)) * Math.PI) / 180;
      matrix.compose(at.set(x, row.y ?? 0, z), turn.setFromAxisAngle(UP, radians), size);
      const geometry = buildProp(props, data);
      paintProp(geometry, data, colours);
      geometry.applyMatrix4(matrix);
      const sides = data.doubleSided ? [geometry, backFaces(geometry.clone())] : [geometry];
      return sides.map((side) => part(side, {}, pal.light));
    });
  });
  return merge(parts);
}

/**
 * buildDressing, or null when props.json does not match DRESSING (a prop missing, a material
 * renamed: deploy or cache skew, /models/ has no hashed names). A decoration must never throw
 * into SceneBoundary, which would fail the whole campus for the session.
 */
export function tryBuildDressing(props: PropsJson, pal: Palette): BufferGeometry | null {
  try {
    return buildDressing(props, pal);
  } catch (error) {
    console.warn("Campus props skipped: props.json does not match the placements.", error);
    return null;
  }
}

/**
 * The dressing mesh: undefined until props.json is settled, then null if it could not be had.
 * Fetched only once the loader is done (the first campus frame is on screen), so the props
 * never hold up the first frame; they arrive during the loader's fade.
 */
export function useDressing(pal: Palette): BufferGeometry | null | undefined {
  const done = useSceneLoad((state) => state.stage >= STAGE.done);
  const [props, setProps] = useState<PropsJson | null>();
  useEffect(() => {
    if (!done) return;
    let live = true;
    void fetchProps().then((json) => {
      if (live) setProps(json);
    });
    return () => {
      live = false;
    };
  }, [done]);
  const geometry = useMemo(() => props && tryBuildDressing(props, pal), [props, pal]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}
