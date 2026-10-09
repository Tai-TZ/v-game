// Bakes the six hub characters from Kenney "Mini Characters 1" (CC0) into one small JSON:
// rigid 7-bone skeleton, merged body+head geometry (1 draw call per figure), a colour slot per
// vertex so the theme can recolour clothes, and 5 shared clips in three's AnimationClip JSON.
// No textures and no GLTFLoader at runtime (decoder: frontend/app/features/campus/scene/cast.ts).
//
//   node tools/characters/bake-cast.mjs <dir> [out.json] [--report] [--check]
//
// <dir> holds the files of the "kenney-mini-characters" pack in tools/assets-sources.json under
// their `as` names (character-*.glb, mini-characters/colormap.png); every file is sha256-checked.
// [out.json] defaults to frontend/public/models/cast.json of this checkout, from any directory.
// --report lists which slot each (joint, texel colour) fell into; read it after editing ROLES.
// --check bakes twice and fails unless both runs and the committed file are byte-identical.
import { fileURLToPath } from "node:url";

import { emit, glb, hex, packIndex, png, Q, r4, sourceReader } from "../bake-lib.mjs";

const args = process.argv.slice(2);
const [
  SRC,
  OUT = fileURLToPath(new URL("../../frontend/public/models/cast.json", import.meta.url)),
] = args.filter((a) => !a.startsWith("--"));
const REPORT = args.includes("--report");
if (!SRC) throw new Error("usage: bake-cast.mjs <dir> [out.json] [--report] [--check]");
const read = sourceReader(SRC, ["kenney-mini-characters"]);

// Joint order = skins[0].joints of every file; parent index (-1 = none).
const JOINTS = ["root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"];
const PARENT = [-1, 0, 0, 0, 3, 3, 3];
// keep: baked colour; top/bottom/accent: theme colours; drop: triangle removed.
const SLOTS = { keep: 0, top: 1, bottom: 2, accent: 3, drop: -1 };
const TA = ["torso", "arm-left", "arm-right"];
const LEGS = ["leg-left", "leg-right"];
const ARMS = ["arm-left", "arm-right"];

// role -> base model + recolour rules [joints, swatch near which a texel counts, slot, hue tol?].
// First matching rule wins; unmatched texels keep their baked colour (skin, hair, face, shoes).
const ROLES = {
  player: {
    file: "male-a",
    rules: [
      [TA, "#3aa378", "top"],
      [LEGS, "#5b66c4", "bottom"],
    ],
  },
  // female-a holds a blue crutch fused into both arm meshes: its blue and grey texels are dropped.
  lan: {
    file: "female-a",
    rules: [
      [ARMS, "#658dd6", "drop"],
      [ARMS, "#585abf", "drop", 0.03],
      [ARMS, "#7f849c", "drop"],
      [ARMS, "#bbc3ea", "drop"],
      [TA, "#7e56ce", "top"],
      [LEGS, "#5b66c4", "bottom"],
    ],
  },
  guard: {
    file: "male-c",
    rules: [
      [TA, "#464650", "top"],
      [TA, "#658dd6", "top"],
      [TA, "#585abf", "top"],
      [["head"], "#6282d1", "accent"],
      [LEGS, "#3f3f46", "bottom"],
    ],
  },
  registrar: {
    file: "female-d",
    rules: [
      [TA, "#797e96", "top"],
      [LEGS, "#797e96", "bottom"],
    ],
  },
  operator: {
    file: "female-f",
    rules: [
      [TA, "#ff952f", "top"],
      [TA, "#ffd061", "top"],
      [ARMS, "#43434c", "top"],
      [["torso"], "#7f849c", "accent"],
      [LEGS, "#7e56ce", "bottom"],
    ],
  },
  examiner: {
    file: "male-d",
    rules: [
      [TA, "#3f3f46", "top"],
      [LEGS, "#3f3f46", "bottom"],
      [["torso"], "#fa6b41", "accent"],
      [["torso"], "#d3554e", "accent"],
    ],
  },
};
// Clips kept (source name -> baked name). "rest" = first key of idle (the frozen pose).
// Sprint loses its 0.2-unit root hop (art direction: no bouncing).
const CLIPS = {
  idle: "rest",
  walk: "walk",
  sprint: "run",
  "interact-right": "talk",
  "emote-yes": "nod",
};
const CLIP_SOURCE = "male-a";

function hsl([r, g, b]) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s, l };
}
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function match([joints, near, , tol = 0.05], joint, c) {
  if (!joints.includes(joint)) return false;
  const n = hsl(hex2rgb(near));
  if (n.s < 0.15) return c.s < 0.15 && Math.abs(c.l - n.l) < 0.22; // grey family
  const dh = Math.abs(c.h - n.h);
  return Math.min(dh, 1 - dh) < tol && Math.abs(c.s - n.s) < 0.2 && Math.abs(c.l - n.l) < 0.25;
}

function bakeRole(role, { file, rules }, texel) {
  const g = glb(read(`character-${file}.glb`), file);
  const names = g.j.skins[0].joints.map((n) => g.j.nodes[n].name);
  if (names.join() !== JOINTS.join()) throw new Error(`${file}: joints ${names}`);
  for (const s of g.j.skins)
    if (s.joints.join() !== g.j.skins[0].joints.join()) throw new Error(`${file}: skins differ`);
  const rest = g.j.skins[0].joints.map((n) => (g.j.nodes[n].translation ?? [0, 0, 0]).map(r4));
  const [position, joint, slot, color, index] = [[], [], [], [], []];
  const seen = new Map();
  const report = {};
  for (const node of g.j.nodes.filter((n) => n.mesh != null)) {
    for (const p of g.j.meshes[node.mesh].primitives) {
      if ((p.mode ?? 4) !== 4) throw new Error(`${file}: not triangles`);
      const pos = g.acc(p.attributes.POSITION);
      const uv = g.acc(p.attributes.TEXCOORD_0);
      const jo = g.acc(p.attributes.JOINTS_0);
      const we = g.acc(p.attributes.WEIGHTS_0);
      const idx = g.acc(p.indices);
      const remap = [];
      for (let i = 0; i < pos.length / 3; i++) {
        const w = we.slice(i * 4, i * 4 + 4);
        const k = w.indexOf(Math.max(...w));
        if (w[k] < 0.999) throw new Error(`${file}: vertex ${i} is not rigidly skinned`);
        const j = jo[i * 4 + k];
        const rgb = texel(uv[i * 2], uv[i * 2 + 1]);
        const c = hsl(rgb);
        const rule = rules.find((r) => match(r, JOINTS[j], c));
        const s = rule ? SLOTS[rule[2]] : 0;
        // slot 0: baked sRGB as 0xRRGGBB; slot > 0: lightness offset from the swatch (x100,
        // softened to 60 %) so the shading Kenney painted into the palette survives a recolour.
        const col = s ? Math.round((c.l - hsl(hex2rgb(rule[1])).l) * 60) : hex(rgb);
        const xyz = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]].map((x) => Math.round(x * Q));
        const key = `${xyz}|${j}|${s}|${col}`;
        if (!seen.has(key)) {
          seen.set(key, joint.length);
          position.push(...xyz);
          joint.push(j);
          slot.push(s);
          color.push(col);
        }
        remap[i] = seen.get(key);
        if (REPORT) {
          const t = `#${hex(rgb).toString(16).padStart(6, "0")}`;
          report[`${JOINTS[j]} ${t}`] = Object.keys(SLOTS).find((n) => SLOTS[n] === s);
        }
      }
      for (let t = 0; t < idx.length; t += 3) {
        const tri = [remap[idx[t]], remap[idx[t + 1]], remap[idx[t + 2]]];
        if (!tri.some((v) => slot[v] === SLOTS.drop)) index.push(...tri);
      }
    }
  }
  if (REPORT) {
    console.log(`\n${role} (${file})`);
    const by = {};
    for (const [k, s] of Object.entries(report)) (by[s] ||= []).push(k);
    for (const [s, ks] of Object.entries(by))
      console.log(`  ${s.padEnd(7)} ${ks.sort().join("  ")}`);
  }
  // Compact away dropped vertices, in first-use order.
  const keep = [];
  const map = new Map();
  for (const v of index) if (!map.has(v)) map.set(v, keep.push(v) - 1);
  return {
    source: `character-${file}.glb`,
    rest,
    position: keep.flatMap((v) => position.slice(v * 3, v * 3 + 3)),
    joint: keep.map((v) => joint[v]),
    slot: keep.map((v) => slot[v]),
    color: keep.map((v) => color[v]),
    index: packIndex(index.map((v) => map.get(v))),
  };
}

function bakeClips() {
  const g = glb(read(`character-${CLIP_SOURCE}.glb`), CLIP_SOURCE);
  return Object.entries(CLIPS).map(([src, name]) => {
    const a = g.j.animations.find((x) => x.name === src);
    if (!a) throw new Error(`clip ${src} missing`);
    const tracks = [];
    const seen = new Set();
    let duration = 0;
    for (const c of a.channels) {
      const node = g.j.nodes[c.target.node].name;
      const path = c.target.path;
      const s = a.samplers[c.sampler];
      if (path === "scale") continue;
      if (name === "run" && node === "root" && path === "translation") continue;
      if ((s.interpolation ?? "LINEAR") !== "LINEAR") throw new Error(`${src}: ${s.interpolation}`);
      let times = g.acc(s.input).map(r4);
      let values = g.acc(s.output).map(r4);
      if (name === "rest") [values, times] = [values.slice(0, values.length / times.length), [0]];
      seen.add(`${node}.${path}`);
      duration = Math.max(duration, times.at(-1));
      const quat = path === "rotation";
      tracks.push({
        name: `${node}.${quat ? "quaternion" : "position"}`,
        type: quat ? "quaternion" : "vector",
        times,
        values,
      });
    }
    if (name === "rest") {
      // The frozen pose pins every joint, so a finished fade always lands on exactly these values.
      for (const node of JOINTS)
        if (!seen.has(`${node}.rotation`))
          tracks.push({
            name: `${node}.quaternion`,
            type: "quaternion",
            times: [0],
            values: [0, 0, 0, 1],
          });
      tracks.push({ name: "root.position", type: "vector", times: [0], values: [0, 0, 0] });
    }
    // uuid: AnimationClip.parse copies it and mixer.clipAction caches actions by it; without one
    // every clip would share a single action.
    return { name, uuid: `cast-${name}`, duration: name === "rest" ? 1 : r4(duration), tracks };
  });
}

function bake() {
  const texel = png(read("mini-characters/colormap.png"));
  const roles = Object.fromEntries(
    Object.entries(ROLES).map(([r, spec]) => [r, bakeRole(r, spec, texel)]),
  );
  return { version: 1, q: Q, joints: JOINTS, parents: PARENT, roles, clips: bakeClips() };
}

emit(bake, OUT, args.includes("--check"));
