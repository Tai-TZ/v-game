import { describe, expect, it } from "vitest";

import {
  arrivalPose,
  BACK,
  BASE,
  BACK_SPOT,
  BACK_Z,
  CYPRESS_TREES,
  FOUNTAIN_RADIUS,
  GATE,
  HOME_TOWARD,
  INTERACT_RADIUS,
  LAKE,
  NPC_SPOT,
  NPC_TALK_SPOT,
  NPCS,
  OBSTACLES,
  PARK_TREES,
  parseArrival,
  PLAZA,
  ROUND_TREES,
  routeTo,
  SITES,
  SPAWN,
  SPAWN_HEADING,
  speakerSpot,
  talkSpot,
  towardFor,
  TREES,
  WORLD_BOUNDS,
  type Box,
  type Vec2,
} from "./layout";
import { HOME_YAW } from "./camera";
import { isBlocked, PLAYER_RADIUS, step } from "./movement";

const deg = (d: number) => (d * Math.PI) / 180;

const FOOTPRINTS: readonly [string, Box][] = [
  ...SITES.map((site): [string, Box] => [site.id, site.footprint]),
  ...Object.entries(BACK),
];

/** Distance from a point to the nearest edge of a box (0 inside). */
const gap = (p: Vec2, f: Box) =>
  Math.hypot(
    Math.max(Math.abs(p.x - f.x) - f.halfX, 0),
    Math.max(Math.abs(p.z - f.z) - f.halfZ, 0),
  );

describe("trees (campus-scene v0.3 §2.4)", () => {
  it("keeps 57 trees, all inside the world bounds", () => {
    expect(TREES).toHaveLength(57);
    for (const tree of TREES) {
      expect(tree.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.minX);
      expect(tree.x).toBeLessThanOrEqual(WORLD_BOUNDS.maxX);
      expect(tree.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.minZ);
      expect(tree.z).toBeLessThanOrEqual(WORLD_BOUNDS.maxZ);
    }
  });

  it("keeps a 0.9 disc around every front tree and a 0.5 disc around park trees clear of buildings", () => {
    const rules = [
      { trees: [...ROUND_TREES, ...CYPRESS_TREES], clear: 0.9 },
      { trees: PARK_TREES, clear: 0.5 },
    ];
    for (const { trees, clear } of rules) {
      for (const tree of trees) {
        for (const [id, f] of FOOTPRINTS) {
          expect(gap(tree, f), `${id} vs (${tree.x}, ${tree.z})`).toBeGreaterThan(clear);
        }
      }
    }
  });
});

describe("lake", () => {
  it("keeps the player's centre within 0.3 of the shore", () => {
    const wet: string[] = [];
    for (let x = LAKE.x - LAKE.rx; x <= WORLD_BOUNDS.maxX; x += 0.05) {
      for (let z = LAKE.z - LAKE.rz; z <= WORLD_BOUNDS.maxZ; z += 0.05) {
        if (isBlocked({ x, z }, OBSTACLES, WORLD_BOUNDS)) continue;
        // Inside the ellipse shrunk by 0.3 means more than about 0.3 into the water.
        if (Math.hypot((x - LAKE.x) / (LAKE.rx - 0.3), (z - LAKE.z) / (LAKE.rz - 0.3)) < 1) {
          wet.push(`(${x.toFixed(2)}, ${z.toFixed(2)})`);
        }
      }
    }
    expect(wet).toEqual([]);
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

/** Walks like the frame loop: one click target, 60 steps a second, up to 4000 steps. */
function walk(from: Vec2, to: Vec2): Vec2 {
  let position = from;
  let done = false;
  for (let i = 0; i < 4000 && !done; i += 1) {
    const result = step(position, { keys: [], target: to }, 1 / 60, OBSTACLES, WORLD_BOUNDS);
    position = result.position;
    done = result.targetDone;
  }
  return position;
}

const FRONT_POINTS: readonly Vec2[] = [
  SPAWN,
  NPC_TALK_SPOT,
  ...SITES.flatMap((site) => [site.door, arrivalPose(site).position]),
];
/** Two points on the east lane, then the back points of campus-scene v0.3 §2.5. */
const LANE_POINTS: readonly Vec2[] = [
  { x: 12.7, z: -5 },
  { x: 10.3, z: -7.5 },
];
const BACK_POINTS: readonly Vec2[] = [
  BACK_SPOT,
  { x: 6.6, z: -12 },
  { x: 2.5, z: -19.5 },
  { x: -8, z: -19 },
  { x: 12, z: -19.5 },
  { x: -6, z: -14.5 },
  { x: -9, z: -12.5 },
  { x: -6.5, z: -10.8 },
  { x: -0.9, z: -19.5 },
];

const label = (from: Vec2, to: Vec2) => `(${from.x}, ${from.z}) -> (${to.x}, ${to.z})`;

/**
 * Walkable points 0.5 apart that axis steps join to SPAWN, offset so none sits exactly on an
 * obstacle edge (those lie on a 0.05 grid), and how many grid points are walkable at all.
 */
function pointsJoinedToSpawn(): { joined: Vec2[]; walkable: number } {
  const H = 0.5;
  const cols = Math.floor((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / H);
  const rows = Math.floor((WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / H);
  const at = (k: number): Vec2 => ({
    x: WORLD_BOUNDS.minX + 0.13 + (k % cols) * H,
    z: WORLD_BOUNDS.minZ + 0.07 + Math.floor(k / cols) * H,
  });
  const i = Math.round((SPAWN.x - WORLD_BOUNDS.minX - 0.13) / H);
  const j = Math.round((SPAWN.z - WORLD_BOUNDS.minZ - 0.07) / H);
  const queue = [j * cols + i];
  const seen = new Set(queue);
  for (const k of queue) {
    const column = k % cols;
    for (const n of [column > 0 ? k - 1 : -1, column < cols - 1 ? k + 1 : -1, k - cols, k + cols]) {
      if (n < 0 || n >= cols * rows || seen.has(n)) continue;
      seen.add(n);
      if (!isBlocked(at(n), OBSTACLES, WORLD_BOUNDS)) queue.push(n);
    }
  }
  let walkable = 0;
  for (let k = 0; k < cols * rows; k += 1) {
    if (!isBlocked(at(k), OBSTACLES, WORLD_BOUNDS)) walkable += 1;
  }
  return { joined: queue.map(at), walkable };
}

/** Every leg of `routeTo` must arrive within 0.08, as the frame loop moves on only then. */
function expectRouteArrives(from: Vec2, to: Vec2, toward = HOME_TOWARD) {
  let position = from;
  for (const waypoint of routeTo(from, to, toward)) {
    position = walk(position, waypoint);
    const miss = Math.hypot(position.x - waypoint.x, position.z - waypoint.z);
    expect(miss, `${label(from, to)} via (${waypoint.x}, ${waypoint.z})`).toBeLessThanOrEqual(0.08);
  }
}

describe("hub NPCs (npc-cast v0.4 §4)", () => {
  const box = (spot: Vec2): Box => ({ ...spot, halfX: 0.3, halfZ: 0.3 });
  const overlap = (a: Box, b: Box) =>
    Math.abs(a.x - b.x) < a.halfX + b.halfX && Math.abs(a.z - b.z) < a.halfZ + b.halfZ;

  it("each blocks a 0.6 box clear of every other obstacle, talk spot 0.8 away and walkable", () => {
    for (const npc of NPCS) {
      const own = box(npc.spot);
      expect(
        OBSTACLES.filter((o) => overlap(o, own)),
        npc.id,
      ).toHaveLength(1);
      expect(isBlocked(npc.talk, OBSTACLES, WORLD_BOUNDS), npc.id).toBe(false);
      const reach = Math.hypot(npc.talk.x - npc.spot.x, npc.talk.z - npc.spot.z);
      expect(reach).toBeCloseTo(0.8, 9);
      expect(reach).toBeLessThan(INTERACT_RADIUS);
      expect(speakerSpot(npc.id)).toBe(npc.spot);
      expect(talkSpot(npc.id)).toBe(npc.talk);
      // Out of the strip the spire hides from the home view (v0.3 §4.5).
      expect(npc.spot.x - npc.spot.z <= 5.5 || npc.spot.x - npc.spot.z >= 9.7, npc.id).toBe(true);
    }
    expect(speakerSpot("lan")).toBe(NPC_SPOT);
    expect(talkSpot("lan")).toBe(NPC_TALK_SPOT);
  });

  it("keeps their interaction rings apart from each other, the librarian's and every door", () => {
    const points = [NPC_SPOT, ...SITES.map((site) => site.door), ...NPCS.map((n) => n.spot)];
    for (const npc of NPCS) {
      for (const p of points) {
        if (p === npc.spot) continue;
        expect(Math.hypot(p.x - npc.spot.x, p.z - npc.spot.z)).toBeGreaterThan(2 * INTERACT_RADIUS);
      }
    }
    // The spawn shows no hint yet: the librarian stays the first goal.
    for (const npc of NPCS) {
      expect(Math.hypot(SPAWN.x - npc.spot.x, SPAWN.z - npc.spot.z)).toBeGreaterThan(
        INTERACT_RADIUS,
      );
    }
  });

  it.each([0, 45, 90, 135, 180, 225, 270, 315])(
    "walks from the spawn and the back to every door and talk spot, viewed from %i°",
    (yaw) => {
      const toward = towardFor(deg(yaw));
      const goals = [...SITES.map((site) => site.door), NPC_TALK_SPOT, ...NPCS.map((n) => n.talk)];
      for (const from of [SPAWN, BACK_SPOT]) {
        for (const to of goals) expectRouteArrives(from, to, toward);
      }
    },
    60_000,
  );
});

describe("click-to-move (campus-scene v0.2 §1.6, v0.3 §2.5)", () => {
  it("walks between every pair of front interaction points about as straight as v0.2 did", () => {
    for (const from of FRONT_POINTS) {
      for (const to of FRONT_POINTS) {
        if (from === to) continue;
        expectRouteArrives(from, to);
        let length = 0;
        let at = from;
        for (const waypoint of routeTo(from, to)) {
          length += Math.hypot(waypoint.x - at.x, waypoint.z - at.z);
          at = waypoint;
        }
        expect(length, label(from, to)).toBeLessThan(
          1.02 * Math.hypot(to.x - from.x, to.z - from.z),
        );
      }
    }
  });

  it("reaches every back point from the front and the lane, and comes back", () => {
    let routes = 0;
    for (const front of [...FRONT_POINTS, ...LANE_POINTS]) {
      for (const back of BACK_POINTS) {
        expectRouteArrives(front, back);
        expectRouteArrives(back, front);
        routes += 2;
      }
    }
    expect(routes).toBe(180);
  });

  it("walks between every pair of back points", () => {
    for (const from of BACK_POINTS) {
      for (const to of BACK_POINTS) if (from !== to) expectRouteArrives(from, to);
    }
  });

  it("takes the zone list's route from every walkable point: front to the back, back to the spawn", () => {
    const { joined, walkable } = pointsJoinedToSpawn();
    expect(joined.length).toBeGreaterThan(2000);
    // No sealed pocket: a click into one had no route (QA r4, west edge beside the library).
    expect(joined).toHaveLength(walkable);
    for (const from of joined) expectRouteArrives(from, from.z < BACK_Z ? SPAWN : BACK_SPOT);
  }, 60_000);

  it("starts each leg on the waypoint routeTo checked it from, not up to 0.08 off it", () => {
    // Both stopped at the east lane's mouth, against the watchtower, before step() snapped.
    expectRouteArrives({ x: -2.84, z: -17.44 }, { x: -3.04, z: -0.74 });
    expectRouteArrives({ x: 0.2, z: -17.5 }, { x: -4.8, z: -0.72 });
  });

  it("ends a click on the paving round the fountain hedge within 0.5 of it (QA r4)", () => {
    const clicks = [{ x: -2.2, z: 3.4 }];
    for (let r = FOUNTAIN_RADIUS + 0.02; r <= FOUNTAIN_RADIUS + 0.8; r += 0.1) {
      for (let degrees = 0; degrees < 360; degrees += 10) {
        const a = (degrees * Math.PI) / 180;
        clicks.push({ x: PLAZA.x + r * Math.cos(a), z: PLAZA.z + r * Math.sin(a) });
      }
    }
    for (const click of clicks) {
      let position = SPAWN;
      for (const waypoint of routeTo(SPAWN, click)) position = walk(position, waypoint);
      const miss = Math.hypot(position.x - click.x, position.z - click.z);
      expect(miss, label(SPAWN, click)).toBeLessThanOrEqual(0.5);
    }
  });

  it.each([45, 135, 225, 315])(
    "stops within 0.5 s of the stand point for every blocked click, viewed from %i° (QA r4)",
    (yaw) => {
      const toward = towardFor(deg(yaw));
      let blocked = 0;
      const slow: string[] = [];
      for (let x = BASE.minX - 0.87; x <= BASE.maxX + 1; x += 0.5) {
        for (let z = BASE.minZ - 0.93; z <= BASE.maxZ + 1; z += 0.5) {
          const click = { x, z };
          if (!isBlocked(click, OBSTACLES, WORLD_BOUNDS)) continue;
          blocked += 1;
          const route = routeTo(SPAWN, click, toward);
          const stand = route.at(-2);
          if (!stand || route.at(-1) !== click) {
            slow.push(`no stand point: ${label(SPAWN, click)}`);
            continue;
          }
          // The last leg, from the stand point (where step() snapped the player) to the click.
          let position = stand;
          let frames = 0;
          for (let done = false; !done && frames <= 30; frames += 1) {
            const result = step(
              position,
              { keys: [], target: click },
              1 / 60,
              OBSTACLES,
              WORLD_BOUNDS,
            );
            position = result.position;
            done = result.targetDone;
          }
          if (frames > 30) slow.push(label(stand, click));
        }
      }
      expect(blocked).toBeGreaterThan(2000);
      expect(slow).toEqual([]);
    },
    60_000,
  );

  it("stands on the side the camera sees: behind the main building from 225° (orbit §2.5)", () => {
    const back = { x: 0, z: -9.8 };
    const route = routeTo(SPAWN, back, towardFor(deg(225)));
    expect(route.at(-1)).toBe(back);
    expect(route.at(-2)?.z).toBeLessThan(-10.25);
    // From home the same click still stands in front of the building.
    expect(routeTo(SPAWN, back).at(-2)?.z).toBeGreaterThan(-6);
  });

  it.each([0, 90, 180, 270])(
    "finds a stand point off every edge and on every building, viewed from %i°",
    (yaw) => {
      // An axis yaw walks straight along x or z, so each edge's exit in pastBounds is reached.
      const toward = towardFor(deg(yaw));
      const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
      const clicks: Vec2[] = [
        { x: minX - 2, z: 0 },
        { x: maxX + 2, z: 0 },
        { x: 0, z: minZ - 2 },
        { x: 0, z: maxZ + 2 },
        ...SITES.map(({ footprint }) => ({ x: footprint.x, z: footprint.z })),
      ];
      for (const click of clicks) {
        const stand = routeTo(SPAWN, click, toward).at(-2);
        expect(stand && isBlocked(stand, OBSTACLES, WORLD_BOUNDS), label(SPAWN, click)).toBe(false);
      }
    },
  );

  it("keeps the home view's routes bit for bit (towardFor(HOME_YAW) is exactly (1, 1))", () => {
    expect(towardFor(HOME_YAW)).toEqual(HOME_TOWARD);
    expect(HOME_TOWARD).toEqual({ x: 1, z: 1 });
    for (const from of FRONT_POINTS) {
      for (const to of [...FRONT_POINTS, { x: 0, z: -7.6 }, { x: 10.4, z: -3.5 }]) {
        if (from !== to) expect(routeTo(from, to, towardFor(HOME_YAW))).toEqual(routeTo(from, to));
      }
    }
    for (const d of [0, 90, 135, 180, 225, 270, 315]) {
      const toward = towardFor(deg(d));
      expect(Math.max(Math.abs(toward.x), Math.abs(toward.z)), `${d}°`).toBe(1);
      expect(toward.x * Math.cos(deg(d)) - toward.z * Math.sin(deg(d)), `${d}°`).toBeCloseTo(0, 8);
    }
  });

  it("keeps the back spot walkable and the gate out of the player's way", () => {
    expect(isBlocked(BACK_SPOT, OBSTACLES, WORLD_BOUNDS)).toBe(false);
    expect(GATE.back).toBeGreaterThanOrEqual(WORLD_BOUNDS.maxZ + PLAYER_RADIUS);
  });
});
