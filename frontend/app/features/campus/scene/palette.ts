import { Color, Vector3 } from "three";

import type { CampusTheme, LightPreset } from "~/features/theme/schema";

import type { Bake, Phase } from "../sky";

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
const luminance = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
/** The grey of a colour's own luminance. */
const grey = (c: Color) => new Color(luminance(c), luminance(c), luminance(c));
const UP = new Vector3(0, 1, 0);

/** "Coming soon" look (art §2.2): pull towards grey of the same luminance, then darken a touch. */
export function desaturate(c: Color): Color {
  const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return c
    .clone()
    .lerp(new Color(y, y, y), 0.7)
    .multiplyScalar(0.97);
}

/**
 * The home view direction, a fixed world vector (art §4.1): the camera may turn, the bake does not
 * (orbit-camera §6.2: shade reads the world normal and the preset only).
 */
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
  // North walls see less sky: without it the +x and −z walls, the pair seen from 135°, bake
  // alike and the building reads as a paper cut-out. A factor, so dark presets keep their walls
  // off black; 1 on every face with n.z ≥ 0, so the home view is unchanged (orbit-camera §6.2).
  const north = 1 - 0.2 * Math.max(0, -n.z) * (1 - Math.abs(n.y));
  return out.setRGB(
    Math.min(1, l.ground.r + (l.sky.r - l.ground.r) * up + l.sunColor.r * direct) * north,
    Math.min(1, l.ground.g + (l.sky.g - l.ground.g) * up + l.sunColor.g * direct) * north,
    Math.min(1, l.ground.b + (l.sky.b - l.ground.b) * up + l.sunColor.b * direct) * north,
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

/**
 * What each baked weather look does to the phase's preset (weather-time-visuals §2.2): sun and
 * hemisphere factors, how far the two hemisphere colours go grey, wet paving, and whether the
 * baked sun shade (N8) stays. The design table asked sun 0.75 / 0.30 / 0.30 / 0.20 with a
 * brighter sky; the orbit rule (campus v0.4 W0.7: two visible walls apart by 0.08 × the top
 * face at every look) floors the sun at 0.9, since by day it alone tells the walls apart, so
 * cloud dims the sky fill instead. The grey sky, the lost shade and the overlays carry the rest.
 */
const WEATHER: Record<
  Bake,
  { sun: number; sky: number; grey: number; wet: number; sunShade: boolean }
> = {
  clear: { sun: 1, sky: 1, grey: 0, wet: 0, sunShade: true },
  partly: { sun: 0.9, sky: 0.95, grey: 0.15, wet: 0, sunShade: true },
  overcast: { sun: 0.9, sky: 0.88, grey: 0.55, wet: 0, sunShade: false },
  damp: { sun: 0.9, sky: 0.84, grey: 0.55, wet: 0.5, sunShade: false },
  wet: { sun: 0.9, sky: 0.8, grey: 0.6, wet: 1, sunShade: false },
};

/** Pulls a hex colour `t` of the way to the grey of its own luminance. */
function greyHex(hex: string, t: number): string {
  const c = new Color(hex);
  const y = luminance(c);
  return `#${c.lerp(new Color(y, y, y), t).getHexString()}`;
}

/** The phase's preset under a weather look; `clear` returns the preset itself. */
export function weatherPreset(preset: LightPreset, bake: Bake): LightPreset {
  if (bake === "clear") return preset;
  const w = WEATHER[bake];
  return {
    ...preset,
    sky: greyHex(preset.sky, w.grey),
    ground: greyHex(preset.ground, w.grey),
    hemisphere: preset.hemisphere * w.sky,
    sunIntensity: preset.sunIntensity * w.sun,
    rim: preset.rim * w.sun,
  };
}

export interface BuildingPalette {
  wall: Color;
  trim: Color;
  roof: Color;
}

export type Palette = ReturnType<typeof palette>;

/**
 * The scene's colours for a phase and a baked weather look. Figures and trees take the theme's
 * own colours from `palette(campus)` (they rebuild only with the theme, campus v0.4 W0.6).
 */
export function palette(campus: CampusTheme, phase: Phase = "day", bake: Bake = "clear") {
  const c = (hex: string) => new Color(hex);
  const building = (b: { wall: string; trim: string; roof: string }): BuildingPalette => ({
    wall: c(b.wall),
    trim: c(b.trim),
    roof: c(b.roof),
  });
  const preset = weatherPreset(campus.lights[phase], bake);
  const weather = WEATHER[bake];
  // Wet paving darkens by 22 %, grass by 10 % (§2.2); roofs, walls and water keep their colour.
  const paving = 1 - 0.22 * weather.wet;
  const ground = mul(c(campus.ground), 1 - 0.1 * weather.wet);
  const water = c(campus.water);
  const foliage = c(campus.foliage);
  const trunk = c(campus.trunk);
  const npc = c(campus.npc);
  const lm = {
    wall: c(campus.landmark.wall),
    trim: c(campus.landmark.trim),
    roof: c(campus.landmark.roof),
    accent: c(campus.landmark.accent),
  };
  const mk = building(campus.buildings.market);
  const wt = building(campus.buildings.watchtower);
  const band = mul(lm.trim, 0.5 * paving);
  const path = mul(c(campus.path), paving);
  const sunlight = light(preset);
  const shadow = shadowFactor(sunlight);
  const soil = mul(ground, 0.45);
  /** How dark the look is (§1.3): 0 by day, 1 at night; lamps and pools of light follow it. */
  const darkness = Math.min(1, Math.max(0, (0.7 - luminance(shade(UP, sunlight))) / 0.5));
  // Lit from inside, never baked. At dusk the sunlit +z walls bake to the day tan (QA r6: the
  // watchtower's top slot vanished), so the glow takes half the low sun's hue at full strength.
  const lit =
    phase === "dusk"
      ? full(lerp(lm.accent, c(campus.lights.dusk.sun), 0.5))
      : lerpW(lm.accent, 0.2);
  const player = c(campus.player);
  return {
    light: sunlight,
    /** The weathered preset the three.js lights use, so figures match the bake. */
    preset,
    darkness,
    /** Baked sun shade (N8): none under a full cloud cover. */
    sunShade: weather.sunShade,
    ground,
    path,
    plaza: mul(c(campus.plaza), paving),
    water,
    foliage,
    trunk,
    player,
    npc,
    lm,
    lib: building(campus.buildings.library),
    wt,
    mk,
    soil,
    /** Lower band of the slab's cut side (art §5.1 T1). */
    subsoil: lerp(soil, trunk, 0.35),
    /** Darker lawn strip (mowing stripes); the light strip is the slab top itself. */
    mow: mul(ground, 0.925),
    /** Edge under every paved rect: a light stone kerb, darker when wet. */
    kerb: mul(lm.trim, 0.92 * paving),
    /** Lake centre and the water in the slab's cut side; the shore keeps the manifest hex. */
    deep: mul(water, 0.78),
    glass: mul(water, 0.45),
    lit,
    /** Landmark and back-campus windows lit after dark (§1.3); the zones keep N9. */
    litDim: mul(lit, 0.62),
    /** Figure material colour: lifts the outfits' hue at night, not their contrast (§1.4). */
    figureLift: 1 + 0.6 * darkness,
    /** Ground glow under a person after dark (additive), the blob's colour then (§1.4). */
    glow: mul(lit, 0.45 * darkness),
    /** The interaction ring, lighter after dark to stay apart from the night path. */
    ring: darkness >= 0.5 ? lerpW(player, 0.55) : player,
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
    track: mul(lerpW(mk.roof, 0.06), 0.72 * paving),
    vault: lerp(lm.roof, water, 0.35),
    solar: lerpW(wt.roof, 0.03),
    sand: mul(path, 0.8),
    court: mul(water, 0.78 * paving),
    asphalt: mul(band, 0.42),
    park: lerp(ground, trunk, 0.12),
    iron: mul(lm.trim, 0.06),
    // Baked sun (N8): the shadow overlay multiplies whatever ground it lies on from the light of
    // a top face down to that of a wall turned from the sun (art §2.3); static foam round the
    // lake.
    shadow,
    /**
     * Contact darkening (art §2.4): the AO overlay's darkest factor, fading to white (no change)
     * at each blob's rim. The sun shade half-way to its own grey, at 80 % of its strength:
     * contact blocks the blue sky light too, so a dusk blob on a warm path stays a warm grey.
     */
    ao: lerpW(lerp(shadow, grey(shadow), 0.5), 0.2),
    foam: lerpW(water, 0.6),
  };
}
