import { describe, expect, it } from "vitest";

import { toScreen } from "./camera";
import { OBSTACLES, SITES, SPAWN, WORLD_BOUNDS, type Box } from "./layout";
import { isBlocked, keyboardDirection, nearestWithin, step, WALK_SPEED } from "./movement";

const OPEN_FIELD: readonly Box[] = [];
const BOUNDS = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };

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

  it("walks world (-1, -1)/√2 for up at the home view", () => {
    const up = keyboardDirection(["ArrowUp"]);
    expect(up?.x).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(up?.z).toBeCloseTo(-Math.SQRT1_2, 12);
  });

  it("follows the screen axes of the current view (orbit-camera §2.5)", () => {
    const keys = [
      ["ArrowUp", "KeyW", 0, 1],
      ["ArrowDown", "KeyS", 0, -1],
      ["ArrowLeft", "KeyA", -1, 0],
      ["ArrowRight", "KeyD", 1, 0],
    ] as const;
    for (let d = 0; d < 360; d += 10) {
      const yaw = (d * Math.PI) / 180;
      for (const [arrow, letter, right, up] of keys) {
        const direction = keyboardDirection([arrow], yaw);
        expect(keyboardDirection([letter], yaw)).toEqual(direction);
        if (!direction) throw new Error(`${arrow} at ${d}° walks nowhere`);
        const moved = toScreen(direction.x, 0, direction.z, yaw);
        const at = `${arrow} at ${d}°`;
        expect(moved.sx, at).toBeCloseTo(right * Math.hypot(moved.sx, moved.sy), 9);
        expect(Math.sign(Math.round(moved.sy * 1e9)), at).toBe(up);
      }
    }
  });

  it("passes the view's yaw from step to the keys", () => {
    const yaw = (200 * Math.PI) / 180;
    const moved = step({ x: 0, z: 0 }, { keys: ["ArrowUp"], target: null, yaw }, 0.1, [], BOUNDS);
    const screen = toScreen(moved.position.x, 0, moved.position.z, yaw);
    expect(screen.sx).toBeCloseTo(0, 9);
    expect(screen.sy).toBeGreaterThan(0);
  });
});

describe("step", () => {
  it("moves towards a click target at walking speed and stops on arrival", () => {
    const target = { x: 1, z: 0 };
    const first = step({ x: 0, z: 0 }, { keys: [], target }, 0.1, OPEN_FIELD, BOUNDS);
    expect(first.moving).toBe(true);
    expect(first.position.x).toBeCloseTo(WALK_SPEED * 0.1);

    const arrived = step({ x: 0.95, z: 0 }, { keys: [], target }, 0.1, OPEN_FIELD, BOUNDS);
    expect(arrived.position).toEqual(target); // snapped, so a next route leg starts on target
    expect(arrived.targetDone).toBe(true);
  });

  it("does not snap onto a target inside an obstacle", () => {
    const wall: Box = { x: 1.5, z: 0, halfX: 0.5, halfZ: 5 };
    const target = { x: 0.7, z: 0 }; // 0.3 from the wall: blocked for the player's radius
    const arrived = step({ x: 0.64, z: 0 }, { keys: [], target }, 0.1, [wall], BOUNDS);
    expect(arrived.position).toEqual({ x: 0.64, z: 0 });
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

  it("gives up a target inside a wall at the first wall either axis meets (QA r4)", () => {
    const wall: Box = { x: 1, z: 0, halfX: 0.5, halfZ: 5 };
    // x runs into the wall, z is free: a free target slides on, a blocked one ends here.
    const blocked = step(
      { x: 0.1, z: 0 },
      { keys: [], target: { x: 1, z: 3 } },
      0.1,
      [wall],
      BOUNDS,
    );
    expect(blocked.moving).toBe(true);
    expect(blocked.targetDone).toBe(true);
    const free = step({ x: 0.1, z: 0 }, { keys: [], target: { x: 3, z: 3 } }, 0.1, [wall], BOUNDS);
    expect(free.moving).toBe(true);
    expect(free.targetDone).toBe(false);
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
    expect(result.position.x).toBeLessThanOrEqual(BOUNDS.maxX);
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
