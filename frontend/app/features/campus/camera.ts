/**
 * Isometric camera maths (art-direction §4). Pure functions only, so they are unit tested
 * and shared by the scene without importing three.js.
 *
 * Screen coordinates (sx, sy) are in world units along the screen axes:
 * R = (1, 0, -1)/√2 to the right, U = (-1, 2, -1)/√6 upwards.
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

/** Distance from the look-at point along (1, 1, 1); 34.641 × √3 = 60. */
export const CAMERA_OFFSET = 34.641;

/**
 * Screen-space bounds of the whole model: the corners of the base and its plate, rounded
 * outwards (campus-scene v0.3 §4.1).
 */
export const CONTENT = { minX: -19.73, maxX: 26.03, minY: -12.05, maxY: 14.82 } as const;
/**
 * Pixels kept free of scenery at both top corners in overview: HubTopBar lg:top-6 + h-11 + 8
 * high; wide enough for "Các khu" plus the theme switch with the longest theme name (≈ 315 px),
 * and on the left for "Về trang chủ" plus the "Hoàng hôn" switch (≈ 337 px, N8 2026-10-08).
 */
export const HUD_CORNER = { width: 344, height: 76 } as const;

const PAD = 24;
const FOLLOW_INSET_TOP = 72;
const SQRT2 = Math.SQRT2;
const SQRT6 = Math.sqrt(6);

export function toScreen(x: number, y: number, z: number): Screen {
  return { sx: (x - z) / SQRT2, sy: (-x + 2 * y - z) / SQRT6 };
}

/** The ground point (y = 0) that projects to the given screen position. */
export function groundFromScreen({ sx, sy }: Screen): { x: number; z: number } {
  return { x: (sx * SQRT2 - sy * SQRT6) / 2, z: (-sx * SQRT2 - sy * SQRT6) / 2 };
}

/** Zoom (CSS px per world unit) and camera mode for a viewport, art §4.3. */
export function viewFor(width: number, height: number, insetBottom = 0): View {
  const spanX = CONTENT.maxX - CONTENT.minX;
  const spanY = CONTENT.maxY - CONTENT.minY;
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

/** Keeps the visible area inside the model (art §4.4). */
export function clampCentre(centre: Screen, view: View): Screen {
  const hw = view.width / (2 * view.zoom);
  const hh = (view.height - view.insetTop - view.insetBottom) / (2 * view.zoom);
  return {
    sx: clampAxis(centre.sx, hw, CONTENT.minX, CONTENT.maxX),
    sy: clampAxis(centre.sy, hh, CONTENT.minY, CONTENT.maxY),
  };
}

/**
 * Where the centre of the visible area should be. Overview: the model's centre. Follow:
 * pushed by exactly the amount `focus` leaves the dead-zone (art §4.5), or centred on
 * `focus` when `centreOnFocus` (the dialog sheet is open over the scene).
 */
export function desiredCentre(
  current: Screen,
  focus: Screen,
  view: View,
  centreOnFocus = false,
): Screen {
  if (view.mode === "overview") {
    return { sx: (CONTENT.minX + CONTENT.maxX) / 2, sy: (CONTENT.minY + CONTENT.maxY) / 2 };
  }
  if (centreOnFocus) return clampCentre(focus, view);
  const halfW = (0.12 * view.width) / view.zoom;
  const halfH = (0.1 * (view.height - view.insetTop - view.insetBottom)) / view.zoom;
  const push = (value: number, target: number, half: number) =>
    target > value + half ? target - half : target < value - half ? target + half : value;
  return clampCentre(
    { sx: push(current.sx, focus.sx, halfW), sy: push(current.sy, focus.sy, halfH) },
    view,
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
