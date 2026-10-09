import { Color, Vector3 } from "three";

import type { CampusTheme, LightPreset, TimeOfDay } from "~/features/theme/schema";

/**
 * Every colour in the scene, read from the active theme manifest (art §2.1) plus the derived
 * colours of art §2.2. All maths happens on linear `Color`s; `new Color(hex)` converts from
 * sRGB.
 */
const WHITE = new Color(1, 1, 1);

const mul = (c: Color, k: number) => c.clone().multiplyScalar(k);
const lerpW = (c: Color, t: number) => c.clone().lerp(WHITE, t);
const lerp = (a: Color, b: Color, t: number) => a.clone().lerp(b, t);
/** Scaled so its brightest channel is 1. */
const full = (c: Color) => c.multiplyScalar(1 / Math.max(c.r, c.g, c.b));

/** "Coming soon" look (art §2.2): pull towards grey of the same luminance, then darken a touch. */
export function desaturate(c: Color): Color {
  const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c
    .clone()
    .lerp(new Color(y, y, y), 0.7)
    .multiplyScalar(0.97);
}

/** Towards the camera: fixed, since the isometric camera never turns (art §4.1). */
const VIEW = new Vector3(1, 1, 1).normalize();

/**
 * A light preset as linear multipliers: exactly what MeshLambertMaterial gets from the
 * preset's HemisphereLight and DirectionalLight (colour × intensity / π), so baked statics and
 * Lambert figures agree (art §3).
 */
export interface Light {
  /** Unit vector towards the sun; the directional light sits at `sun × 30`. */
  sun: Vector3;
  sunColor: Color;
  sky: Color;
  ground: Color;
  rim: number;
}

export function light(preset: LightPreset): Light {
  const coefficient = (hex: string, intensity: number) =>
    new Color(hex).multiplyScalar(intensity / Math.PI);
  return {
    sun: new Vector3(...preset.sunDirection).normalize(),
    sunColor: coefficient(preset.sun, preset.sunIntensity),
    sky: coefficient(preset.sky, preset.hemisphere),
    ground: coefficient(preset.ground, preset.hemisphere),
    rim: preset.rim,
  };
}

/**
 * Baked light for a face normal (art §2.3, rev. 2026-10-08): hemisphere + sun, plus a rim of
 * sunlight on faces seen edge-on, per channel, capped at 1. The day presets put the top face at
 * exactly 1 (manifest colour, QA rule), +z near 0.8 and warm, +x near 0.6 and cool.
 */
export function shade(n: Vector3, l: Light, out = new Color()): Color {
  const sun = Math.max(0, n.dot(l.sun));
  const up = 0.5 + 0.5 * n.y;
  const direct = sun * (1 + l.rim * (1 - Math.max(0, n.dot(VIEW))) ** 2);
  return out.setRGB(
    Math.min(1, l.ground.r + (l.sky.r - l.ground.r) * up + l.sunColor.r * direct),
    Math.min(1, l.ground.g + (l.sky.g - l.ground.g) * up + l.sunColor.g * direct),
    Math.min(1, l.ground.b + (l.sky.b - l.ground.b) * up + l.sunColor.b * direct),
  );
}

/** Per-channel factor taking a baked top face to the light of a wall turned from the sun. */
function shadowFactor(l: Light): Color {
  const top = shade(new Vector3(0, 1, 0), l);
  const turned = l.sky.clone().lerp(l.ground, 0.5);
  return new Color(
    Math.min(1, turned.r / top.r),
    Math.min(1, turned.g / top.g),
    Math.min(1, turned.b / top.b),
  );
}

export interface BuildingPalette {
  wall: Color;
  trim: Color;
  roof: Color;
}

export type Palette = ReturnType<typeof palette>;

export function palette(campus: CampusTheme, time: TimeOfDay = campus.lights.default) {
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
  const mk = building(campus.buildings.market);
  const wt = building(campus.buildings.watchtower);
  const band = mul(lm.trim, 0.5);
  const path = c(campus.path);
  const lit = light(campus.lights[time]);
  return {
    light: lit,
    ground,
    path,
    plaza: c(campus.plaza),
    water,
    foliage,
    trunk,
    player,
    npc,
    lm,
    lib: building(campus.buildings.library),
    wt,
    mk,
    soil: mul(ground, 0.45),
    skirt: mul(ground, 0.7),
    contact: mul(ground, 0.8),
    glass: mul(water, 0.45),
    // Lit from inside, never baked. At dusk the sunlit +z walls bake to the day tan (QA r6: the
    // watchtower's top slot vanished), so the glow takes half the low sun's hue at full strength.
    lit:
      time === "dusk"
        ? full(lerp(lm.accent, c(campus.lights.dusk.sun), 0.5))
        : lerpW(lm.accent, 0.2),
    waterHi: lerpW(water, 0.35),
    dark: mul(trunk, 0.35),
    lanSkirt: mul(npc, 0.45),
    pants: mul(player, 0.45),
    xray: lerpW(player, 0.45),
    cypress: mul(foliage, 0.82),
    /** Dark inlaid paving bands (campus-scene v0.2 §4.2). */
    band,
    hedge: mul(foliage, 0.7),
    bloom: mul(lerpW(mk.roof, 0.35), 0.85),
    // Back of campus (campus-scene v0.3 §5.1): derived, so each theme gets its own sports ground.
    track: mul(lerpW(mk.roof, 0.06), 0.72),
    vault: lerp(lm.roof, water, 0.35),
    solar: lerpW(wt.roof, 0.03),
    sand: mul(path, 0.8),
    court: mul(water, 0.78),
    asphalt: mul(band, 0.42),
    park: lerp(ground, trunk, 0.12),
    iron: mul(lm.trim, 0.06),
    // Baked sun (N8): the shadow overlay multiplies whatever ground it lies on from the light of
    // a top face down to that of a wall turned from the sun (art §2.3); static foam round the
    // lake.
    shadow: shadowFactor(lit),
    foam: lerpW(water, 0.6),
  };
}
