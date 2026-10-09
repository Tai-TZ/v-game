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

/** Theme colours of one figure (linear, as `new Color(hex)` gives them). */
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

const hsl = { h: 0, s: 0, l: 0 };
const c = new Color();

/** Writes theme colours into the `color` attribute; only colours change, never positions. */
export function paintFigure(mesh: SkinnedMesh, data: CastRoleData, looks: CastLooks): void {
  const attr = mesh.geometry.getAttribute("color");
  data.slot.forEach((s, i) => {
    const v = data.color[i] ?? 0;
    const look = s === 1 ? looks.top : s === 2 ? looks.bottom : s === 3 ? looks.accent : undefined;
    if (!look) c.setHex(v);
    else {
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
