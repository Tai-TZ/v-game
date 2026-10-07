import { describe, expect, it } from "vitest";

import {
  arrivalPose,
  INTERACT_RADIUS,
  NPC_SPOT,
  NPC_TALK_SPOT,
  OBSTACLES,
  parseArrival,
  SITES,
  SPAWN,
  SPAWN_HEADING,
  TREES,
  WORLD_BOUNDS,
} from "./layout";
import { isBlocked, step } from "./movement";

describe("trees (campus-scene v0.2 §2.2)", () => {
  it("keeps 41 trees, all inside the world bounds", () => {
    expect(TREES).toHaveLength(41);
    for (const tree of TREES) {
      expect(Math.abs(tree.x)).toBeLessThanOrEqual(WORLD_BOUNDS.halfX);
      expect(Math.abs(tree.z)).toBeLessThanOrEqual(WORLD_BOUNDS.halfZ);
    }
  });

  it("keeps a 0.9 disc around every tree clear of the building footprints", () => {
    for (const tree of TREES) {
      for (const { footprint: f, id } of SITES) {
        const dx = Math.max(Math.abs(tree.x - f.x) - f.halfX, 0);
        const dz = Math.max(Math.abs(tree.z - f.z) - f.halfZ, 0);
        expect(Math.hypot(dx, dz), `${id} vs (${tree.x}, ${tree.z})`).toBeGreaterThan(0.9);
      }
    }
  });
});

describe("arrival from a zone page", () => {
  it("accepts only known site keys", () => {
    expect(parseArrival("library")?.id).toBe("library");
    expect(parseArrival("market")?.id).toBe("market");
    expect(parseArrival("abc")).toBeNull();
    expect(parseArrival("__proto__")).toBeNull();
    expect(parseArrival("")).toBeNull();
    expect(parseArrival(null)).toBeNull();
  });

  it("stands 0.8 in front of each door (art §4.6) on walkable ground", () => {
    const expected = {
      library: { x: -7.4, z: -2.8 },
      watchtower: { x: 7.4, z: -2.8 },
      market: { x: 5.6, z: 3.9 },
    };
    for (const site of SITES) {
      const { position } = arrivalPose(site);
      expect(position.x).toBeCloseTo(expected[site.id].x);
      expect(position.z).toBeCloseTo(expected[site.id].z);
      expect(isBlocked(position, OBSTACLES, WORLD_BOUNDS), site.id).toBe(false);
    }
  });
});

describe("librarian", () => {
  it("is an obstacle, with a reachable talk spot inside the interaction radius", () => {
    expect(isBlocked(NPC_SPOT, OBSTACLES, WORLD_BOUNDS)).toBe(true);
    expect(isBlocked(NPC_TALK_SPOT, OBSTACLES, WORLD_BOUNDS)).toBe(false);
    const distance = Math.hypot(NPC_TALK_SPOT.x - NPC_SPOT.x, NPC_TALK_SPOT.z - NPC_SPOT.z);
    expect(distance).toBeLessThan(INTERACT_RADIUS);
  });

  it("faces the spawn towards the librarian", () => {
    expect(SPAWN_HEADING).toBeCloseTo(-1.751, 3);
  });
});

describe("click-to-move (campus-scene v0.2 §1.6)", () => {
  it("walks straight between every pair of interaction points without path finding", () => {
    const points = [
      SPAWN,
      NPC_TALK_SPOT,
      ...SITES.flatMap((site) => [site.door, arrivalPose(site).position]),
    ];
    for (const from of points) {
      for (const to of points) {
        if (from === to) continue;
        let position = from;
        let done = false;
        for (let i = 0; i < 4000 && !done; i += 1) {
          const result = step(position, { keys: [], target: to }, 1 / 60, OBSTACLES, WORLD_BOUNDS);
          position = result.position;
          done = result.targetDone;
        }
        const label = `(${from.x}, ${from.z}) -> (${to.x}, ${to.z})`;
        expect(done, label).toBe(true);
        expect(Math.hypot(position.x - to.x, position.z - to.z), label).toBeLessThanOrEqual(0.08);
      }
    }
  });
});
