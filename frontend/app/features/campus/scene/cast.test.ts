import { readFileSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

import {
  AnimationMixer,
  Box3,
  Color,
  MathUtils,
  MeshLambertMaterial,
  SRGBColorSpace,
  Vector3,
  type SkinnedMesh,
} from "three";
import { describe, expect, it } from "vitest";

import {
  buildFigure,
  CAST_ROLES,
  CAST_SCALE,
  CAST_JOINTS,
  CAST_PARENTS,
  castClips,
  disposeFigure,
  paintFigure,
  parseCast,
  unpackIndex,
  type CastJson,
  type CastRole,
} from "./cast";

const FILE = path.resolve(process.cwd(), "public", "models", "cast.json");
const text = readFileSync(FILE, "utf8");
const cast = JSON.parse(text) as CastJson;
const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

// Fixed numbers from tools/characters/bake-cast.mjs; a change to its colour rules updates them.
const TRIANGLES: Record<CastRole, number> = {
  player: 723,
  lan: 700,
  guard: 793,
  registrar: 797,
  operator: 788,
  examiner: 711,
};
const HAS_ACCENT: CastRole[] = ["guard", "operator", "examiner"];
/** Figures stand 0.045 above the ground (ground decal); the glass bridge clears 1.31. */
const LIFT = 0.045;

/** Skinned bounding box in scene units (mesh at the origin, scaled by CAST_SCALE). */
function skinnedBox(mesh: SkinnedMesh): Box3 {
  mesh.updateMatrixWorld(true);
  const box = new Box3();
  const p = new Vector3();
  const position = mesh.geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1)
    box.expandByPoint(mesh.applyBoneTransform(i, p.fromBufferAttribute(position, i)));
  return box.set(box.min.multiplyScalar(CAST_SCALE), box.max.multiplyScalar(CAST_SCALE));
}

/** A figure playing `clipName`; `sample(t)` poses it at time t and returns its skinned box. */
function posed(role: CastRole, clipName: string) {
  const mesh = buildFigure(cast, role, material);
  const mixer = new AnimationMixer(mesh);
  const clip = castClips(cast).find((c) => c.name === clipName);
  if (!clip) throw new Error(clipName);
  mixer.clipAction(clip).play();
  const sample = (t: number) => {
    mixer.setTime(t);
    return skinnedBox(mesh);
  };
  return { clip, sample };
}

/** Highest head top (scene units, lifted) over one loop of a clip, sampled every 1/60 s. */
function peak(role: CastRole, clipName: string): number {
  const { clip, sample } = posed(role, clipName);
  let top = 0;
  for (let t = 0; t <= clip.duration; t += 1 / 60) top = Math.max(top, sample(t).max.y + LIFT);
  return top;
}

const snapshot = (mesh: SkinnedMesh) =>
  mesh.skeleton.bones
    .map((b) => [...b.position.toArray(), ...b.quaternion.toArray()].map((x) => x.toFixed(6)))
    .join("|");

describe("cast.json format", () => {
  it("has the 7-joint rig, every role and nothing else", () => {
    expect(cast.version).toBe(1);
    expect(cast.joints).toEqual([
      "root",
      "leg-left",
      "leg-right",
      "torso",
      "arm-left",
      "arm-right",
      "head",
    ]);
    expect(cast.parents).toEqual([-1, 0, 0, 0, 3, 3, 3]);
    expect([cast.joints, cast.parents]).toEqual([CAST_JOINTS, CAST_PARENTS]);
    expect(Object.keys(cast.roles).sort()).toEqual([...CAST_ROLES].sort());
  });

  it("is the canonical output of the baker (no hand edits, no reformatting)", () => {
    expect(text).toBe(JSON.stringify(cast));
  });

  it("stays within its download budget", () => {
    const bytes = Buffer.from(text);
    expect(bytes.length).toBeLessThanOrEqual(130_000);
    expect(gzipSync(bytes).length).toBeLessThanOrEqual(23_000);
    expect(brotliCompressSync(bytes).length).toBeLessThanOrEqual(16_000);
  });
});

describe("parseCast", () => {
  /** A fresh copy of cast.json with `edit` applied to it. */
  const broken = (edit: (j: CastJson) => void) => {
    const j = JSON.parse(text) as CastJson;
    edit(j);
    return parseCast(j);
  };

  it("accepts the baked file", () => {
    expect(parseCast(JSON.parse(text))).not.toBeNull();
  });

  it.each<[string, (j: CastJson) => void]>([
    ["a wrong version", (j) => Object.assign(j, { version: 2 })],
    ["q = 0", (j) => Object.assign(j, { q: 0 })],
    ["another rig", (j) => j.parents.reverse()],
    ["a missing role", (j) => Reflect.deleteProperty(j.roles, "guard")],
    ["an index past the last vertex", (j) => j.roles.guard.index.splice(0, 3, 0, 5, 0)],
    ["a triangle cut short", (j) => j.roles.lan.index.pop()],
    ["a short position array", (j) => j.roles.player.position.pop()],
    ["a short colour array", (j) => j.roles.player.color.pop()],
    ["a slot out of range", (j) => j.roles.operator.slot.splice(0, 1, 4)],
    ["a joint out of range", (j) => j.roles.examiner.joint.splice(0, 1, 7)],
    ["a missing rest row", (j) => j.roles.registrar.rest.pop()],
    ["a clip without a uuid", (j) => Reflect.deleteProperty(j.clips[0] ?? {}, "uuid")],
  ])("rejects %s", (_, edit) => {
    expect(broken(edit)).toBeNull();
  });

  it("rejects what is not a cast at all", () => {
    for (const bad of [null, 1, "cast", [], {}]) expect(parseCast(bad)).toBeNull();
  });
});

describe("cast decoding", () => {
  it.each(CAST_ROLES)(
    "%s decodes to a single skinned mesh with the baked triangle count",
    (role) => {
      const d = cast.roles[role];
      const mesh = buildFigure(cast, role, material);
      const n = d.joint.length;
      expect(mesh.geometry.getAttribute("position").count).toBe(n);
      expect(d.position).toHaveLength(n * 3);
      expect(mesh.geometry.index?.count).toBe(TRIANGLES[role] * 3);
      expect(TRIANGLES[role]).toBeLessThanOrEqual(900);
      const index = Array.from(mesh.geometry.index?.array ?? []);
      expect(Math.min(...index)).toBe(0);
      expect(Math.max(...index)).toBe(n - 1);
      expect(mesh.skeleton.bones.map((b) => b.name)).toEqual(cast.joints);
      expect(mesh.skeleton.bones[4]?.parent).toBe(mesh.skeleton.bones[3]);
    },
  );

  it("disposeFigure frees the geometry and the skeleton's bone texture", () => {
    const mesh = buildFigure(cast, "guard", material);
    mesh.skeleton.computeBoneTexture(); // what the renderer does on the first frame
    const freed: string[] = [];
    mesh.geometry.addEventListener("dispose", () => freed.push("geometry"));
    mesh.skeleton.boneTexture?.addEventListener("dispose", () => freed.push("bones"));
    disposeFigure(mesh);
    expect(freed.sort()).toEqual(["bones", "geometry"]);
  });

  it("unpacks the high-water-mark index", () => {
    expect(unpackIndex([0, 0, 0, 1, 3, 0])).toEqual([0, 1, 2, 2, 0, 3]);
  });

  it("only uses slots 0-3, and the accent slot only where the role has one", () => {
    for (const role of CAST_ROLES) {
      const slots = new Set(cast.roles[role].slot);
      expect(
        [...slots].every((s) => s >= 0 && s <= 3),
        role,
      ).toBe(true);
      expect(slots.has(1) && slots.has(2), role).toBe(true);
      expect(slots.has(3), role).toBe(HAS_ACCENT.includes(role));
    }
  });
});

describe("cast recolouring", () => {
  const looks = (top: string, bottom: string, accent: string) => ({
    top: new Color(top),
    bottom: new Color(bottom),
    accent: new Color(accent),
  });

  it.each(CAST_ROLES)("%s: a theme switch changes clothes only, never positions", (role) => {
    const d = cast.roles[role];
    const mesh = buildFigure(cast, role, material);
    const position = mesh.geometry.getAttribute("position").array.slice();
    const color = mesh.geometry.getAttribute("color");
    paintFigure(mesh, d, looks("#c72127", "#2a2a2e", "#134d8b"));
    const first = color.array.slice();
    expect(first.every((x) => x >= 0 && x <= 1)).toBe(true);
    paintFigure(mesh, d, looks("#1d6b62", "#b85f12", "#d9b46a"));
    expect(color.array.every((x) => x >= 0 && x <= 1)).toBe(true);
    expect(mesh.geometry.getAttribute("position").array).toEqual(position);
    d.slot.forEach((s, i) => {
      const same = [0, 1, 2].every((k) => color.array[i * 3 + k] === first[i * 3 + k]);
      expect(same, `${role} vertex ${i} slot ${s}`).toBe(s === 0);
    });
  });
});

describe("cast colour slots", () => {
  const top = new Color("#c72127");
  const bottom = new Color("#2a2a2e");
  const accent = new Color("#134d8b");
  const d = cast.roles.guard;
  const first = (slot: number) => d.slot.indexOf(slot);
  /** What a slot-1..3 vertex must get: the theme colour with its sRGB lightness shifted. */
  const shifted = (look: Color, v: number) => {
    const hsl = look.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
    const l = MathUtils.clamp(hsl.l + v / 100, 0.04, 0.97);
    return new Color().setHSL(hsl.h, hsl.s, l, SRGBColorSpace);
  };
  const colorAt = (mesh: SkinnedMesh, i: number) =>
    new Color().fromBufferAttribute(mesh.geometry.getAttribute("color"), i);
  const expectColor = (got: Color, want: Color, label: string) => {
    for (const k of ["r", "g", "b"] as const)
      expect(got[k], `${label}.${k}`).toBeCloseTo(want[k], 5);
  };

  it("maps keep, top, bottom and accent to exactly their colours", () => {
    const mesh = buildFigure(cast, "guard", material);
    paintFigure(mesh, d, { top, bottom, accent });
    const want = [
      new Color(d.color[first(0)]),
      shifted(top, d.color[first(1)] ?? NaN),
      shifted(bottom, d.color[first(2)] ?? NaN),
      shifted(accent, d.color[first(3)] ?? NaN),
    ];
    want.forEach((w, s) => {
      expect(first(s), `slot ${s}`).toBeGreaterThanOrEqual(0);
      expectColor(colorAt(mesh, first(s)), w, `slot ${s}`);
    });
  });

  it("paints the accent slot from the top colour when a theme has no accent", () => {
    const mesh = buildFigure(cast, "guard", material);
    paintFigure(mesh, d, { top, bottom });
    d.slot.forEach((s, i) => {
      if (s === 3) expectColor(colorAt(mesh, i), shifted(top, d.color[i] ?? NaN), `vertex ${i}`);
    });
  });
});

describe("cast clips", () => {
  it("has rest, walk, run, talk and nod with distinct uuids", () => {
    const clips = castClips(cast);
    expect(clips.map((c) => c.name)).toEqual(["rest", "walk", "run", "talk", "nod"]);
    expect(new Set(clips.map((c) => c.uuid)).size).toBe(clips.length);
    // The prototype bug: without distinct uuids every clipAction returned one shared action.
    const mixer = new AnimationMixer(buildFigure(cast, "player", material));
    expect(new Set(clips.map((c) => mixer.clipAction(c))).size).toBe(clips.length);
  });

  it("rest pins every joint, so any fade back to it lands on the exact pose", () => {
    const rest = castClips(cast).find((c) => c.name === "rest");
    const pinned = rest?.tracks.map((t) => t.name).sort();
    expect(pinned).toEqual([...cast.joints.map((j) => `${j}.quaternion`), "root.position"].sort());
  });

  it("walk moves the bones away from rest and run has no root hop", () => {
    const mesh = buildFigure(cast, "player", material);
    const mixer = new AnimationMixer(mesh);
    const [rest, walk, run] = castClips(cast);
    if (!rest || !walk || !run) throw new Error("clips");
    mixer.clipAction(rest).play();
    mixer.update(0);
    const still = snapshot(mesh);
    mixer.stopAllAction();
    mixer.clipAction(walk).play();
    mixer.setTime(walk.duration / 4);
    expect(snapshot(mesh)).not.toBe(still);
    expect(run.tracks.some((t) => t.name === "root.position")).toBe(false);
  });
});

describe("cast sizes (scene units)", () => {
  it("player stands 1.14 tall at rest", () => {
    const box = posed("player", "rest").sample(0);
    expect(box.max.y - box.min.y).toBeCloseTo(1.14, 2);
  });

  it("every figure is 1.1-1.4 tall and narrower than 1.2 at rest", () => {
    for (const role of CAST_ROLES) {
      const box = posed(role, "rest").sample(0);
      expect(box.max.y - box.min.y, role).toBeGreaterThan(1.1);
      expect(box.max.y - box.min.y, role).toBeLessThan(1.4);
      expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z), role).toBeLessThan(1.2);
    }
  });

  it("player's head clears the glass bridge (1.31) while walking and running", () => {
    expect(peak("player", "rest")).toBeCloseTo(1.186, 2);
    expect(peak("player", "walk")).toBeCloseTo(1.27, 2);
    expect(peak("player", "walk")).toBeLessThanOrEqual(1.31);
    expect(peak("player", "run")).toBeLessThanOrEqual(1.31);
  });
});
