import { Color, Vector3 } from "three";

import type { CampusTheme } from "~/features/theme/schema";

/**
 * Every colour in the scene, read from the active theme manifest (art §2.1) plus the derived
 * colours of art §2.2. All maths happens on linear `Color`s; `new Color(hex)` converts from
 * sRGB.
 */
const WHITE = new Color(1, 1, 1);

const mul = (c: Color, k: number) => c.clone().multiplyScalar(k);
const lerpW = (c: Color, t: number) => c.clone().lerp(WHITE, t);

/** "Coming soon" look (art §2.2): pull towards grey of the same luminance, then darken a touch. */
export function desaturate(c: Color): Color {
  const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c
    .clone()
    .lerp(new Color(y, y, y), 0.7)
    .multiplyScalar(0.97);
}

const SUN = new Vector3(-0.35, 1, 0.75).normalize();

/** Baked light factor for a face normal (art §2.3): top 1.0, +z 0.8, +x 0.6. */
export function shade(n: Vector3): number {
  return Math.min(1, 0.466 + 0.268 * (0.5 + 0.5 * n.y) + 0.346 * Math.max(0, n.dot(SUN)));
}

/** Direction towards the sun; the directional light sits at `SUN × 30`. */
export const SUN_DIRECTION: Readonly<Vector3> = SUN;

export interface BuildingPalette {
  wall: Color;
  trim: Color;
  roof: Color;
}

export type Palette = ReturnType<typeof palette>;

export function palette(campus: CampusTheme) {
  const c = (hex: string) => new Color(hex);
  const building = (b: { wall: string; trim: string; roof: string }): BuildingPalette => ({
    wall: c(b.wall),
    trim: c(b.trim),
    roof: c(b.roof),
  });
  const ground = c(campus.ground);
  const water = c(campus.water);
  const foliage = c(campus.foliage);
  const trunk = c(campus.trunk);
  const player = c(campus.player);
  const npc = c(campus.npc);
  const lm = {
    wall: c(campus.landmark.wall),
    trim: c(campus.landmark.trim),
    roof: c(campus.landmark.roof),
    accent: c(campus.landmark.accent),
  };
  return {
    ground,
    path: c(campus.path),
    plaza: c(campus.plaza),
    water,
    foliage,
    trunk,
    player,
    npc,
    lm,
    lib: building(campus.buildings.library),
    wt: building(campus.buildings.watchtower),
    mk: building(campus.buildings.market),
    soil: mul(ground, 0.45),
    skirt: mul(ground, 0.7),
    contact: mul(ground, 0.8),
    glass: mul(water, 0.45),
    lit: lerpW(lm.accent, 0.2),
    waterHi: lerpW(water, 0.35),
    dark: mul(trunk, 0.35),
    lanSkirt: mul(npc, 0.45),
    pants: mul(player, 0.45),
    xray: lerpW(player, 0.45),
    cypress: mul(foliage, 0.82),
  };
}
