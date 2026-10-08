import type { Box, Vec2 } from "./layout";

export const PLAYER_RADIUS = 0.35;
export const WALK_SPEED = 4.2; // world units per second
const ARRIVE_DISTANCE = 0.08;

/**
 * Screen-relative directions for the isometric camera (looking from +x,+z towards the
 * origin): "up" on screen is world (-1, -1).
 */
const KEY_DIRECTIONS: Readonly<Record<string, Vec2>> = {
  ArrowUp: { x: -1, z: -1 },
  KeyW: { x: -1, z: -1 },
  ArrowDown: { x: 1, z: 1 },
  KeyS: { x: 1, z: 1 },
  ArrowLeft: { x: -1, z: 1 },
  KeyA: { x: -1, z: 1 },
  ArrowRight: { x: 1, z: -1 },
  KeyD: { x: 1, z: -1 },
};

export function isMovementKey(code: string): boolean {
  return code in KEY_DIRECTIONS;
}

/** Unit direction from the held keys, or null when they cancel out or none are held. */
export function keyboardDirection(held: Iterable<string>): Vec2 | null {
  let x = 0;
  let z = 0;
  for (const code of held) {
    const direction = KEY_DIRECTIONS[code];
    if (direction) {
      x += direction.x;
      z += direction.z;
    }
  }
  const length = Math.hypot(x, z);
  return length < 1e-6 ? null : { x: x / length, z: z / length };
}

export function overlapsBox(point: Vec2, box: Box, radius: number): boolean {
  return (
    Math.abs(point.x - box.x) < box.halfX + radius && Math.abs(point.z - box.z) < box.halfZ + radius
  );
}

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function isBlocked(point: Vec2, obstacles: readonly Box[], b: Bounds): boolean {
  if (point.x < b.minX || point.x > b.maxX || point.z < b.minZ || point.z > b.maxZ) return true;
  return obstacles.some((box) => overlapsBox(point, box, PLAYER_RADIUS));
}

export interface StepResult {
  position: Vec2;
  /** Yaw in radians for the walking direction; unchanged when standing still. */
  heading: number | null;
  moving: boolean;
  /**
   * True when a click/tap target has been reached or cannot be reached any further. A target
   * inside an obstacle or off the walkable ground is given up at the first wall either axis
   * meets, so the player does not crawl along it (QA r4).
   */
  targetDone: boolean;
}

/**
 * Advance the player by one frame. Keyboard input wins over a pending target. Movement is
 * resolved per axis so the player slides along walls instead of sticking to them.
 */
export function step(
  position: Vec2,
  input: { keys: Iterable<string>; target: Vec2 | null },
  dt: number,
  obstacles: readonly Box[],
  bounds: Bounds,
): StepResult {
  let direction = keyboardDirection(input.keys);
  let maxDistance = WALK_SPEED * dt;
  let blockedTarget = false;

  if (!direction && input.target) {
    const dx = input.target.x - position.x;
    const dz = input.target.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= ARRIVE_DISTANCE) {
      // Snap onto a free target, so the next route leg starts on the line routeTo checked.
      const end = isBlocked(input.target, obstacles, bounds) ? position : { ...input.target };
      return { position: end, heading: null, moving: false, targetDone: true };
    }
    direction = { x: dx / distance, z: dz / distance };
    maxDistance = Math.min(maxDistance, distance);
    blockedTarget = isBlocked(input.target, obstacles, bounds);
  }

  if (!direction) return { position, heading: null, moving: false, targetDone: false };

  const next = { ...position };
  const tryX = { x: position.x + direction.x * maxDistance, z: position.z };
  const xFree = !isBlocked(tryX, obstacles, bounds);
  if (xFree) next.x = tryX.x;
  const tryZ = { x: next.x, z: position.z + direction.z * maxDistance };
  const zFree = !isBlocked(tryZ, obstacles, bounds);
  if (zFree) next.z = tryZ.z;

  const moved = Math.hypot(next.x - position.x, next.z - position.z);
  if (moved < 1e-6) {
    // Fully blocked: abandon a click target so the player does not keep pushing a wall.
    return { position, heading: null, moving: false, targetDone: input.target !== null };
  }
  return {
    position: next,
    heading: Math.atan2(direction.x, direction.z),
    moving: true,
    targetDone: blockedTarget && !(xFree && zFree),
  };
}

/** The interaction point closest to `position` within `radius`, if any. */
export function nearestWithin<T extends { door: Vec2 }>(
  position: Vec2,
  sites: readonly T[],
  radius: number,
): T | null {
  let best: T | null = null;
  let bestDistance = radius;
  for (const site of sites) {
    const distance = Math.hypot(site.door.x - position.x, site.door.z - position.z);
    if (distance <= bestDistance) {
      best = site;
      bestDistance = distance;
    }
  }
  return best;
}
