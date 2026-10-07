import type { ZoneLocation } from "~/features/zones/schema";

export interface Vec2 {
  x: number;
  z: number;
}

/** Axis-aligned rectangle on the ground plane, centred at (x, z). */
export interface Box {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
}

export interface Site {
  id: ZoneLocation;
  centre: Vec2;
  footprint: Box;
  /** Where the player stands to interact with the building. */
  door: Vec2;
  /** Rotation (radians, around Y) so the façade faces the plaza. */
  facing: number;
}

export const WORLD_BOUNDS = { halfX: 14, halfZ: 10 } as const;
export const SPAWN: Vec2 = { x: 0, z: 3 };
export const PLAZA: Vec2 = { x: 0, z: -1 };
export const FOUNTAIN_RADIUS = 1.4;
export const INTERACT_RADIUS = 1.7;

export const LANDMARK = {
  centre: { x: 0, z: -7.2 },
  footprint: { x: 0, z: -7.2, halfX: 3.4, halfZ: 2 },
} as const;

export const SITES: readonly Site[] = [
  {
    id: "library",
    centre: { x: -8.5, z: 2 },
    footprint: { x: -8.5, z: 2, halfX: 2.3, halfZ: 1.7 },
    door: { x: -5.6, z: 2 },
    facing: Math.PI / 2,
  },
  {
    id: "watchtower",
    centre: { x: 8.5, z: 2 },
    footprint: { x: 8.5, z: 2, halfX: 1.5, halfZ: 1.5 },
    door: { x: 6.4, z: 2 },
    facing: -Math.PI / 2,
  },
  {
    id: "market",
    centre: { x: 0, z: 7.6 },
    footprint: { x: 0, z: 7.6, halfX: 2.7, halfZ: 1.6 },
    door: { x: 0, z: 5.3 },
    facing: Math.PI,
  },
];

/** Colonnade columns flanking the plaza (only built when the theme asks for them). */
export const COLONNADE_COLUMNS: readonly Vec2[] = (() => {
  const columns: Vec2[] = [];
  const radius = 4.2;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      const angle = side * (Math.PI * 0.38 + (i / 5) * Math.PI * 0.3);
      columns.push({
        x: PLAZA.x + Math.sin(angle) * radius,
        z: PLAZA.z - Math.cos(angle) * radius,
      });
    }
  }
  return columns;
})();

/** Trees around the edge of the map and in a few clusters; positions are fixed so the scene is stable. */
export const TREES: readonly Vec2[] = (() => {
  const trees: Vec2[] = [];
  for (let x = -13; x <= 13; x += 2.6) {
    trees.push({ x, z: -9.3 }, { x: x + 1.3, z: 9.3 });
  }
  for (let z = -6.5; z <= 6.5; z += 2.6) {
    trees.push({ x: -13.3, z }, { x: 13.3, z: z + 1.3 });
  }
  trees.push(
    { x: -5, z: -4.6 },
    { x: 5, z: -4.6 },
    { x: -4.4, z: 6.8 },
    { x: 4.4, z: 6.8 },
    { x: -10.5, z: -3.5 },
    { x: 10.5, z: -3.5 },
    { x: -10.8, z: 6.5 },
    { x: 10.8, z: 6.5 },
  );
  // Drop trees that would overhang the base edge or push into the market roof (art §6.4).
  return trees.filter(
    (t) => Math.abs(t.x) <= WORLD_BOUNDS.halfX && !(t.z > 9 && Math.abs(t.x) < 2),
  );
})();

export const NPC_SPOT: Vec2 = { x: -5.4, z: 3.4 };
/** Where the player is placed (or walks to) to talk to the librarian: inside INTERACT_RADIUS. */
export const NPC_TALK_SPOT: Vec2 = { x: -4.7, z: 3.0 };
const NPC_BOX: Box = { ...NPC_SPOT, halfX: 0.3, halfZ: 0.3 };

/** Everything the player cannot walk through. */
export const OBSTACLES: readonly Box[] = [
  LANDMARK.footprint,
  ...SITES.map((site) => site.footprint),
  { x: PLAZA.x, z: PLAZA.z, halfX: FOUNTAIN_RADIUS, halfZ: FOUNTAIN_RADIUS },
  ...TREES.map((tree) => ({ x: tree.x, z: tree.z, halfX: 0.35, halfZ: 0.35 })),
  NPC_BOX,
];

export function siteFor(location: ZoneLocation): Site {
  const site = SITES.find((candidate) => candidate.id === location);
  if (!site) throw new Error(`No campus site for location "${location}".`);
  return site;
}

/** Where the player stands when returning from a zone page: 0.8 in front of the door, facing the plaza. */
export function arrivalPose(site: Site): { position: Vec2; heading: number } {
  return {
    position: {
      x: site.door.x + 0.8 * Math.sin(site.facing),
      z: site.door.z + 0.8 * Math.cos(site.facing),
    },
    heading: site.facing,
  };
}

/** Reads `?at=<site id>`; anything that is not a known site key is ignored. */
export function parseArrival(value: string | null): Site | null {
  return SITES.find((site) => site.id === value) ?? null;
}

/** Default pose: at SPAWN, turned towards the librarian as a hint of the first goal. */
export const SPAWN_HEADING = Math.atan2(NPC_SPOT.x - SPAWN.x, NPC_SPOT.z - SPAWN.z);
