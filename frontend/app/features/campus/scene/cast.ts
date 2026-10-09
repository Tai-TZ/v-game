import {
  AnimationClip,
  Bone,
  BufferAttribute,
  BufferGeometry,
  Color,
  MathUtils,
  NormalAnimationBlendMode,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  type AnimationClipJSON,
  type Material,
} from "three";

/*
 * Decoder for public/models/cast.json (baked offline by tools/characters/bake-cast.mjs): one
 * rigidly skinned mesh per role with theme-recolourable clothes, plus the shared clips. Core
 * three only, no loaders and no textures.
 */

export const CAST_ROLES = ["player", "lan", "guard", "registrar", "operator", "examiner"] as const;
export type CastRole = (typeof CAST_ROLES)[number];

/** The rigid rig every role shares, and each joint's parent (-1 = none). */
export const CAST_JOINTS = [
  "root",
  "leg-left",
  "leg-right",
  "torso",
  "arm-left",
  "arm-right",
  "head",
];
export const CAST_PARENTS = [-1, 0, 0, 0, 3, 3, 3];

/** Baked units -> scene units (player 0.671 -> 1.14). */
export const CAST_SCALE = 1.7;

/** Vertex colour slots: 0 keeps the baked colour, the others take a theme colour. */
export const CAST_SLOTS = ["keep", "top", "bottom", "accent"] as const;

export interface CastRoleData {
  source: string;
  /** Rest translation of each joint. */
  rest: [number, number, number][];
  /** Integer positions; divide by `CastJson.q`. */
  position: number[];
  joint: number[];
  slot: number[];
  /** Slot 0: sRGB 0xRRGGBB. Other slots: lightness offset × 100 from the theme colour. */
  color: number[];
  /** Packed triangle index; see `unpackIndex`. */
  index: number[];
}

export type CastClipJson = Omit<AnimationClipJSON, "blendMode">;

export interface CastJson {
  version: 1;
  q: number;
  joints: string[];
  parents: number[];
  roles: Record<CastRole, CastRoleData>;
  clips: CastClipJson[];
}

/** Theme colours of one figure (linear, as `new Color(hex)` gives them); no accent = top. */
export interface CastLooks {
  top: Color;
  bottom: Color;
  accent?: Color;
}

/**
 * Undoes the bakers' high-water-mark coding: vertices are numbered in first-use order and each
 * entry is (vertices seen so far) - index, so 0 means "the next new vertex".
 */
export function unpackIndex(packed: readonly number[]): number[] {
  let next = 0;
  return packed.map((e) => {
    const v = next - e;
    if (e === 0) next += 1;
    return v;
  });
}

export const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null;

/** An array of `length` finite numbers. */
export const isNumbers = (a: unknown, length: number): a is number[] =>
  Array.isArray(a) && a.length === length && a.every((x) => Number.isFinite(x));

/** An array of `length` integers in [0, below). */
export const isIndices = (a: unknown, length: number, below: number): a is number[] =>
  isNumbers(a, length) && a.every((x) => Number.isInteger(x) && x >= 0 && x < below);

/** A packed triangle index (whole triangles) whose every vertex is in [0, vertices). */
export function isPackedIndex(packed: unknown, vertices: number): packed is number[] {
  return (
    Array.isArray(packed) &&
    packed.length % 3 === 0 &&
    isIndices(packed, packed.length, Infinity) &&
    isIndices(unpackIndex(packed), packed.length, vertices)
  );
}

function isRole(d: unknown): d is CastRoleData {
  if (!isObject(d) || !Array.isArray(d.joint)) return false;
  const n = d.joint.length;
  return (
    Array.isArray(d.rest) &&
    d.rest.length === CAST_JOINTS.length &&
    d.rest.every((r) => isNumbers(r, 3)) &&
    isNumbers(d.position, n * 3) &&
    isIndices(d.joint, n, CAST_JOINTS.length) &&
    isIndices(d.slot, n, CAST_SLOTS.length) &&
    isNumbers(d.color, n) &&
    isPackedIndex(d.index, n)
  );
}

const isClip = (c: unknown) =>
  isObject(c) &&
  typeof c.name === "string" &&
  typeof c.uuid === "string" &&
  Array.isArray(c.tracks);

/**
 * Checks a fetched cast.json before anything is built from it: a stale, truncated or edited file
 * gives null (keep the fallback) instead of NaN vertices or out-of-range draws.
 */
export function parseCast(json: unknown): CastJson | null {
  if (!isObject(json) || json.version !== 1) return null;
  const { q, joints, parents, roles, clips } = json;
  const ok =
    typeof q === "number" &&
    Number.isFinite(q) &&
    q > 0 &&
    JSON.stringify(joints) === JSON.stringify(CAST_JOINTS) &&
    JSON.stringify(parents) === JSON.stringify(CAST_PARENTS) &&
    isObject(roles) &&
    CAST_ROLES.every((r) => isRole(roles[r])) &&
    Array.isArray(clips) &&
    clips.every(isClip);
  return ok ? (json as unknown as CastJson) : null;
}

/** One SkinnedMesh (1 draw call), bound at the origin; place it through a parent group. */
export function buildFigure(cast: CastJson, role: CastRole, material: Material): SkinnedMesh {
  const d = cast.roles[role];
  const n = d.joint.length;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      Float32Array.from(d.position, (v) => v / cast.q),
      3,
    ),
  );
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  d.joint.forEach((j, i) => {
    skinIndex[i * 4] = j;
    skinWeight[i * 4] = 1;
  });
  geometry.setAttribute("skinIndex", new BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new BufferAttribute(skinWeight, 4));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(n * 3), 3));
  geometry.setIndex(unpackIndex(d.index));
  geometry.computeVertexNormals();

  const bones = cast.joints.map((name, i) => {
    const bone = new Bone();
    bone.name = name;
    bone.position.fromArray(d.rest[i] ?? [0, 0, 0]);
    return bone;
  });
  cast.parents.forEach((p, i) => {
    const child = bones[i];
    if (p >= 0 && child) bones[p]?.add(child);
  });
  const mesh = new SkinnedMesh(geometry, material);
  const root = bones[0];
  if (root) mesh.add(root);
  mesh.bind(new Skeleton(bones));
  mesh.frustumCulled = false; // a skinned bounding sphere goes stale; 7 figures are cheap to draw
  return mesh;
}

/** Frees what buildFigure made: the geometry and the skeleton's bone texture (R3F won't). */
export function disposeFigure(mesh: SkinnedMesh): void {
  mesh.geometry.dispose();
  mesh.skeleton.dispose();
}

const hsl = { h: 0, s: 0, l: 0 };
const c = new Color();

/** Writes theme colours into the `color` attribute; only colours change, never positions. */
export function paintFigure(mesh: SkinnedMesh, data: CastRoleData, looks: CastLooks): void {
  const attr = mesh.geometry.getAttribute("color");
  data.slot.forEach((s, i) => {
    const v = data.color[i] ?? 0;
    if (s === 0) c.setHex(v);
    else {
      const look = s === 1 ? looks.top : s === 2 ? looks.bottom : (looks.accent ?? looks.top);
      look.getHSL(hsl, SRGBColorSpace);
      c.setHSL(hsl.h, hsl.s, MathUtils.clamp(hsl.l + v / 100, 0.04, 0.97), SRGBColorSpace);
    }
    attr.setXYZ(i, c.r, c.g, c.b);
  });
  attr.needsUpdate = true;
}

/**
 * The shared clips (rest, walk, run, talk, nod). Each keeps its baked uuid: mixer.clipAction
 * caches actions by uuid, so clips without distinct ones would share a single action.
 */
export function castClips(cast: CastJson): AnimationClip[] {
  return cast.clips.map((clip) =>
    AnimationClip.parse({ ...clip, blendMode: NormalAnimationBlendMode }),
  );
}
