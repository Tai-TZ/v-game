import { describe, expect, it } from "vitest";

import {
  arrivalPose,
  INTERACT_RADIUS,
  NPC_SPOT,
  NPC_TALK_SPOT,
  OBSTACLES,
  parseArrival,
  SITES,
  SPAWN_HEADING,
  TREES,
  WORLD_BOUNDS,
} from "./layout";
import { isBlocked } from "./movement";

describe("trees (art §6.4)", () => {
  it("keeps 39 trees, all inside the world bounds", () => {
    expect(TREES).toHaveLength(39);
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
      library: { x: -4.8, z: 2 },
      watchtower: { x: 5.6, z: 2 },
      market: { x: 0, z: 4.5 },
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
    expect(SPAWN_HEADING).toBeCloseTo(-1.497, 3);
  });
});
