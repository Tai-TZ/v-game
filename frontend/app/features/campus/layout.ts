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
/** Middle of the central lawn, on the main axis (campus-scene v0.2 §2.2). */
export const SPAWN: Vec2 = { x: 0, z: -0.8 };
/** Centre of the fountain and the curved colonnades. */
export const PLAZA: Vec2 = { x: 0, z: 5.6 };
/** Half side of the fountain's blocking box: the hedge ring around the basin. */
export const FOUNTAIN_RADIUS = 1.88;
export const INTERACT_RADIUS = 1.7;

const span = (x0: number, x1: number, z0: number, z1: number): Box => ({
  x: (x0 + x1) / 2,
  z: (z0 + z1) / 2,
  halfX: (x1 - x0) / 2,
  halfZ: (z1 - z0) / 2,
});

/** Point on a circle around the plaza; angle 0 points to the main building (-z). */
export function arcPoint(angle: number, radius: number): Vec2 {
  return { x: PLAZA.x + Math.sin(angle) * radius, z: PLAZA.z - Math.cos(angle) * radius };
}

export const LANDMARK = {
  centre: { x: 0, z: -7.6 },
  /** Wings + pavilions; the tower base that steps forward; porch + steps. */
  footprints: [
    span(-9.75, 9.75, -9.9, -6.0),
    span(-3.15, 3.15, -6.0, -5.15),
    span(-1.7, 1.7, -5.15, -3.55),
  ],
} as const;

export const SITES: readonly Site[] = [
  {
    id: "library",
    centre: { x: -10.6, z: -3.3 },
    footprint: span(-12.4, -8.8, -6.0, -0.6),
    door: { x: -8.2, z: -2.8 },
    facing: Math.PI / 2,
  },
  {
    id: "watchtower",
    centre: { x: 10.4, z: -3.5 },
    footprint: span(8.8, 12.0, -6.0, -1.0),
    door: { x: 8.2, z: -2.8 },
    facing: -Math.PI / 2,
  },
  {
    id: "market",
    centre: { x: 9.0, z: 3.9 },
    footprint: span(7.0, 11.0, 2.6, 5.2),
    door: { x: 6.4, z: 3.9 },
    facing: -Math.PI / 2,
  },
];

export const COLONNADE = { inner: 3.05, outer: 3.75, mid: 3.4 } as const;

/** 24 columns: two rows (inner, outer) on six angles per side of the plaza. */
export const COLONNADE_COLUMNS: readonly Vec2[] = [-1, 1].flatMap((s) =>
  [0, 1, 2, 3, 4, 5].flatMap((i) => {
    const angle = s * (0.37 + 0.05 * i) * Math.PI;
    return [arcPoint(angle, COLONNADE.inner), arcPoint(angle, COLONNADE.outer)];
  }),
);

/** Square piers closing the front end of each colonnade. */
export const COLONNADE_PIERS: readonly Vec2[] = [-1, 1].map((s) =>
  arcPoint(s * 0.68 * Math.PI, COLONNADE.mid),
);

const v = (x: number, z: number): Vec2 => ({ x, z });

/** Broad-crowned trees; their trunks block the player. */
export const ROUND_TREES: readonly Vec2[] = [
  ...[v(-11.4, -9.0), v(-13.3, -7.4), v(11.4, -9.0), v(13.3, -7.4)], // back corners
  ...[v(-13.4, -4.4), v(-13.4, -1.8), v(-13.3, 1.2)], // west edge
  ...[v(13.3, -4.4), v(13.3, -1.6), v(12.8, 1.3), v(13.4, 3.7)], // east edge
  ...[v(-5.4, 2.4), v(5.6, 1.8), v(-4.9, 0.6), v(5.0, 0.6)], // lawns beside the axis
  ...[v(-4.9, 6.4), v(4.9, 6.4), v(-4.3, 8.9), v(4.3, 8.9)], // behind the colonnades
  ...[v(-13.4, 4.3), v(-13.4, 7.3), v(-12.8, 9.6), v(-5.6, 9.6)], // around the rose garden
];

/** Slender cypresses: decoration only, the player walks past them. */
export const CYPRESS_TREES: readonly Vec2[] = [
  // Two rows along the axis; none in front of the wings, whose facades must stay readable.
  ...[-3.75, 3.75].flatMap((x) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => v(x, -5.6 + 0.8 * k))),
];

export const TREES: readonly Vec2[] = [...ROUND_TREES, ...CYPRESS_TREES];

/** Four boxes inside the lake (front-right corner); the shore stays walkable. */
export const LAKE_BLOCKS: readonly Box[] = [
  span(8.6, 14.8, 8.3, 10.8),
  span(11.4, 14.8, 6.4, 8.3),
  span(7.2, 8.6, 9.0, 10.8),
  span(13.0, 14.8, 5.9, 6.4),
];

/** Next to the library entrance, off the camera's line of sight from the door. */
export const NPC_SPOT: Vec2 = { x: -6.6, z: -2.0 };
/** Where the player is placed (or walks to) to talk to the librarian: inside INTERACT_RADIUS. */
export const NPC_TALK_SPOT: Vec2 = { x: -6.6, z: -2.8 };
const NPC_BOX: Box = { ...NPC_SPOT, halfX: 0.3, halfZ: 0.3 };

/**
 * Everything the player cannot walk through: buildings, the fountain, round-tree trunks, the
 * lake and the librarian. Low or slender things (columns, lamps, statues, cypresses, hedges,
 * balustrades) do not block, so click-to-move walks straight without path finding.
 */
export const OBSTACLES: readonly Box[] = [
  ...LANDMARK.footprints,
  ...SITES.map((site) => site.footprint),
  { x: PLAZA.x, z: PLAZA.z, halfX: FOUNTAIN_RADIUS, halfZ: FOUNTAIN_RADIUS },
  ...ROUND_TREES.map((tree) => ({ x: tree.x, z: tree.z, halfX: 0.35, halfZ: 0.35 })),
  ...LAKE_BLOCKS,
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
