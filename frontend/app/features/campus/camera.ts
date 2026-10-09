/**
 * Isometric camera maths (art-direction §4, orbit-camera §1). Pure functions only, so they are
 * unit tested and shared by the scene without importing three.js.
 *
 * The camera turns about the vertical axis only: `yaw` is its azimuth, so the ground direction
 * from the look-at point to the camera is h(yaw) = (sin yaw, cos yaw); pitch stays the true
 * isometric 35.264°. Screen coordinates (sx, sy) are in world units along the screen axes:
 * right R(yaw) = (cos yaw, 0, -sin yaw), up (-sin yaw · sin E, cos E, -cos yaw · sin E). At
 * HOME_YAW that is R = (1, 0, -1)/√2 and U = (-1, 2, -1)/√6.
 */

export interface Screen {
  sx: number;
  sy: number;
}

export type CameraMode = "overview" | "follow";

export interface View {
  width: number;
  height: number;
  zoom: number;
  mode: CameraMode;
  insetTop: number;
  insetBottom: number;
}

export interface Bounds2 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Ground {
  x: number;
  z: number;
}

/** The default view, camera at +x, +z (art §4.1). */
export const HOME_YAW = Math.PI / 4;
const SIN_E = 1 / Math.sqrt(3);
const COS_E = Math.sqrt(2 / 3);
const DISTANCE = 60;

/** Ground point the overview orbits: the middle of the base (layout BASE). */
export const PIVOT = { x: 0, z: -4.45 } as const;
/**
 * Screen extent of the whole model around PIVOT over every yaw, measured on the built geometry
 * (base, buildings, tree crowns) at 1° steps and rounded outwards; `top` has 0.2 more so the
 * 344-px left HUD corner stays sky at every yaw (orbit-camera §1.3).
 */
export const ORBIT_FRAME = { half: 22.94, top: 13.42, bottom: -13.9 } as const;
/**
 * Pixels kept free of scenery at both top corners in overview: HubTopBar lg:top-6 + h-11 + 8
 * high; wide enough for "Các khu" plus the theme switch with the longest theme name (≈ 315 px),
 * and on the left for "Về trang chủ" plus the "Hoàng hôn" switch (≈ 337 px, N8 2026-10-08).
 */
export const HUD_CORNER = { width: 344, height: 76 } as const;
/**
 * The "Góc nhìn" buttons at the bottom right (3 × 44 + 2 border + 24, 44 + 2 + 24 px), kept sky
 * in overview.
 */
export const VIEW_CONTROLS = { width: 158, height: 70 } as const;

const PAD = 24;
const FOLLOW_INSET_TOP = 72;

/** Screen position in world units for a camera at azimuth `yaw` (art §4.1 at HOME_YAW). */
export function toScreen(x: number, y: number, z: number, yaw = HOME_YAW): Screen {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { sx: x * c - z * s, sy: y * COS_E - (x * s + z * c) * SIN_E };
}

/** The ground point (y = 0) that projects to the given screen position. */
export function groundFromScreen({ sx, sy }: Screen, yaw = HOME_YAW): Ground {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const f = -sy / SIN_E;
  return { x: sx * c + f * s, z: -sx * s + f * c };
}

/** Camera position minus its look-at point: 60 away, (34.641, 34.641, 34.641) at HOME_YAW. */
export function cameraOffset(yaw: number): [number, number, number] {
  return [DISTANCE * COS_E * Math.sin(yaw), DISTANCE * SIN_E, DISTANCE * COS_E * Math.cos(yaw)];
}

/** An angle in (−π, π]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** `p` turned by `delta` around `pivot` on the ground, the way h(yaw) turns with yaw. */
export function rotateAbout(p: Ground, pivot: Ground, delta: number): Ground {
  const dx = p.x - pivot.x;
  const dz = p.z - pivot.z;
  const c = Math.cos(delta);
  const s = Math.sin(delta);
  return { x: pivot.x + dx * c + dz * s, z: pivot.z - dx * s + dz * c };
}

const QUARTER = Math.PI / 2;
/** A rotate key or button never picks a diagonal this close: each press turns a visible step. */
const MIN_TURN = Math.PI / 180;

/** The next isometric diagonal (45°, 135°, 225°, 315°) from `yaw`, clockwise for +1. */
export function nextIsoYaw(yaw: number, dir: -1 | 1): number {
  const u = (yaw - HOME_YAW) / QUARTER;
  const m = MIN_TURN / QUARTER;
  const k = dir > 0 ? Math.floor(u + m) + 1 : Math.ceil(u - m) - 1;
  return wrapAngle(HOME_YAW + k * QUARTER);
}

/** Within this of a diagonal, a released drag settles on it (orbit-camera §2.4). */
const SNAP = (12 * Math.PI) / 180;

/** Where a released drag settles: the nearest diagonal within 12°, else where it is. */
export function snapYaw(yaw: number, reduced = false): number {
  const diagonal = wrapAngle(HOME_YAW + Math.round((yaw - HOME_YAW) / QUARTER) * QUARTER);
  return !reduced && Math.abs(wrapAngle(yaw - diagonal)) <= SNAP + 1e-9 ? diagonal : yaw;
}

/** Drag speed in radians per CSS pixel: one turn per 600–1200 px of canvas width. */
export function dragRate(width: number): number {
  return (2 * Math.PI) / Math.min(Math.max(width, 600), 1200);
}

/**
 * Screen bounds of the model at `yaw`: the four bottom corners of the plate and the four
 * corners of the ground (layout BASE), as v0.3's CONTENT was at HOME_YAW.
 */
export function contentAt(yaw: number): Bounds2 {
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const [y, grow] of [
    [-0.8, 0.25],
    [0, 0],
  ] as const) {
    for (const x of [-14.8 - grow, 14.8 + grow]) {
      for (const z of [-21.5 - grow, 12.6 + grow]) {
        const { sx, sy } = toScreen(x, y, z, yaw);
        b.minX = Math.min(b.minX, sx);
        b.maxX = Math.max(b.maxX, sx);
        b.minY = Math.min(b.minY, sy);
        b.maxY = Math.max(b.maxY, sy);
      }
    }
  }
  return b;
}

/** Zoom (CSS px per world unit) and camera mode for a viewport, art §4.3; the same at any yaw. */
export function viewFor(width: number, height: number, insetBottom = 0): View {
  const spanX = 2 * ORBIT_FRAME.half;
  const spanY = ORBIT_FRAME.top - ORBIT_FRAME.bottom;
  const fit = Math.min((width - 2 * PAD) / spanX, (height - 2 * PAD) / spanY);
  if (fit >= 22) {
    return {
      width,
      height,
      zoom: Math.min(fit, 56),
      mode: "overview",
      insetTop: 0,
      insetBottom: 0,
    };
  }
  const zoom = Math.min(Math.max(Math.min((width - 32) / 11.5, (height - 72) / 8), 28), 40);
  return { width, height, zoom, mode: "follow", insetTop: FOLLOW_INSET_TOP, insetBottom };
}

function clampAxis(value: number, half: number, min: number, max: number): number {
  if (2 * half >= max - min) return (min + max) / 2;
  return Math.min(Math.max(value, min + half), max - half);
}

/** Keeps the visible area inside the model as seen from `yaw` (art §4.4). */
export function clampCentre(centre: Screen, view: View, yaw = HOME_YAW): Screen {
  const content = contentAt(yaw);
  const hw = view.width / (2 * view.zoom);
  const hh = (view.height - view.insetTop - view.insetBottom) / (2 * view.zoom);
  return {
    sx: clampAxis(centre.sx, hw, content.minX, content.maxX),
    sy: clampAxis(centre.sy, hh, content.minY, content.maxY),
  };
}

/**
 * Where the centre of the visible area should be, in the screen axes of `yaw`. Overview: the
 * middle of ORBIT_FRAME, which keeps PIVOT still on screen at every yaw. Follow: pushed by
 * exactly the amount `focus` leaves the dead-zone (art §4.5), or centred on `focus` when
 * `centreOnFocus` (the dialog sheet is open over the scene).
 */
export function desiredCentre(
  current: Screen,
  focus: Screen,
  view: View,
  centreOnFocus = false,
  yaw = HOME_YAW,
): Screen {
  if (view.mode === "overview") {
    const pivot = toScreen(PIVOT.x, 0, PIVOT.z, yaw);
    return { sx: pivot.sx, sy: pivot.sy + (ORBIT_FRAME.top + ORBIT_FRAME.bottom) / 2 };
  }
  if (centreOnFocus) return clampCentre(focus, view, yaw);
  const halfW = (0.12 * view.width) / view.zoom;
  const halfH = (0.1 * (view.height - view.insetTop - view.insetBottom)) / view.zoom;
  const push = (value: number, target: number, half: number) =>
    target > value + half ? target - half : target < value - half ? target + half : value;
  return clampCentre(
    { sx: push(current.sx, focus.sx, halfW), sy: push(current.sy, focus.sy, halfH) },
    view,
    yaw,
  );
}

/** Camera look-at in screen space: the visible centre shifted by the HUD insets (art §4.4). */
export function cameraCentre(visible: Screen, view: View): Screen {
  return { sx: visible.sx, sy: visible.sy + (view.insetTop - view.insetBottom) / (2 * view.zoom) };
}

/** Frame-rate independent exponential ease factor; 1 means "jump" (reduced motion). */
export function easeFactor(rate: number, dt: number, reduced: boolean): number {
  return reduced ? 1 : 1 - Math.exp(-rate * dt);
}
