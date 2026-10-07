import { describe, expect, it } from "vitest";

import { OBSTACLES, SITES, SPAWN, WORLD_BOUNDS, type Box } from "./layout";
import { isBlocked, keyboardDirection, nearestWithin, step, WALK_SPEED } from "./movement";

const OPEN_FIELD: readonly Box[] = [];
const BOUNDS = { halfX: 10, halfZ: 10 };

describe("keyboardDirection", () => {
  it("returns null when no movement key is held", () => {
    expect(keyboardDirection([])).toBeNull();
    expect(keyboardDirection(["KeyQ"])).toBeNull();
  });

  it("normalises combined keys and cancels opposites", () => {
    const up = keyboardDirection(["KeyW"]);
    expect(up && Math.hypot(up.x, up.z)).toBeCloseTo(1);
    expect(keyboardDirection(["KeyW", "KeyS"])).toBeNull();
  });
});

describe("step", () => {
  it("moves towards a click target at walking speed and stops on arrival", () => {
    const target = { x: 1, z: 0 };
    const first = step({ x: 0, z: 0 }, { keys: [], target }, 0.1, OPEN_FIELD, BOUNDS);
    expect(first.moving).toBe(true);
    expect(first.position.x).toBeCloseTo(WALK_SPEED * 0.1);

    const arrived = step({ x: 0.999, z: 0 }, { keys: [], target }, 0.1, OPEN_FIELD, BOUNDS);
    expect(arrived.position).toEqual({ x: 0.999, z: 0 });
    expect(arrived.targetDone).toBe(true);
  });

  it("does not overshoot a nearby target", () => {
    const result = step(
      { x: 0, z: 0 },
      { keys: [], target: { x: 0.2, z: 0 } },
      1,
      OPEN_FIELD,
      BOUNDS,
    );
    expect(result.position.x).toBeCloseTo(0.2);
  });

  it("lets keyboard input override a pending target", () => {
    const result = step(
      { x: 0, z: 0 },
      { keys: ["KeyS"], target: { x: -5, z: -5 } },
      0.1,
      OPEN_FIELD,
      BOUNDS,
    );
    expect(result.position.x).toBeGreaterThan(0);
    expect(result.position.z).toBeGreaterThan(0);
  });

  it("slides along a wall instead of stopping", () => {
    const wall: Box = { x: 1, z: 0, halfX: 0.5, halfZ: 5 };
    const result = step({ x: 0, z: 0 }, { keys: [], target: { x: 3, z: 3 } }, 0.1, [wall], BOUNDS);
    expect(result.position.x).toBe(0);
    expect(result.position.z).toBeGreaterThan(0);
  });

  it("abandons a click target that is completely blocked", () => {
    const wall: Box = { x: 0, z: 0, halfX: 5, halfZ: 5 };
    const result = step(
      { x: -5.5, z: 0 },
      { keys: [], target: { x: 0, z: 0 } },
      0.1,
      [wall],
      BOUNDS,
    );
    expect(result.moving).toBe(false);
    expect(result.targetDone).toBe(true);
  });

  it("keeps the player inside the world bounds", () => {
    const result = step(
      { x: 9.9, z: 0 },
      { keys: ["ArrowRight"], target: null },
      1,
      OPEN_FIELD,
      BOUNDS,
    );
    expect(Math.abs(result.position.x)).toBeLessThanOrEqual(BOUNDS.halfX);
  });
});

describe("campus layout", () => {
  it("spawns the player on walkable ground", () => {
    expect(isBlocked(SPAWN, OBSTACLES, WORLD_BOUNDS)).toBe(false);
  });

  it("puts every door on walkable ground so each building is reachable", () => {
    for (const site of SITES) {
      expect(isBlocked(site.door, OBSTACLES, WORLD_BOUNDS), site.id).toBe(false);
    }
  });

  it("finds the nearest door within the interaction radius", () => {
    const library = SITES.find((site) => site.id === "library");
    expect(library).toBeDefined();
    if (!library) return;
    expect(nearestWithin(library.door, SITES, 1)?.id).toBe("library");
    expect(nearestWithin(SPAWN, SITES, 1)).toBeNull();
  });
});
