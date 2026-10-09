// Bakes the campus dressing props (CC0: Kenney Nature Kit, Kenney City Kit Commercial, Quaternius
// on Poly Pizza) into one small JSON: per prop one merged, indexed, Y-up geometry whose vertices
// carry a material index. The material names stay in the JSON so the scene can map each one to a
// theme colour slot and recolour on a theme switch. Textured palette atlases are sampled once per
// vertex here and become one material per texel colour ("<material>:<rrggbb>"), so the runtime
// needs no textures and no GLTFLoader (decoder: frontend/app/features/campus/scene/props.ts).
//
//   node tools/props/bake-props.mjs <dir> [out.json] [--check]
//
// <dir> holds the prop files of tools/assets-sources.json under their `as` names (flat, plus
// Textures/colormap.png of the City Kit); every file is sha256-checked.
// --check bakes twice and fails unless both runs and the committed file are byte-identical.
import { emit, glb, hex, packIndex, png, Q, sourceReader } from "../bake-lib.mjs";

const args = process.argv.slice(2);
const [SRC, OUT = "frontend/public/models/props.json"] = args.filter((a) => !a.startsWith("--"));
if (!SRC) throw new Error("usage: bake-props.mjs <dir> [out.json] [--check]");
const read = sourceReader(SRC, [
  "kenney-nature-kit",
  "kenney-city-kit-commercial",
  "quaternius-poly-pizza",
]);

// prop id -> source file. Ids are neutral role names; the placement plan sets scale and colours.
const PROPS = {
  "bush-large": "plant_bushLarge.glb",
  bush: "plant_bush.glb",
  pot: "pot_large.glb",
  "lily-large": "lily_large.glb",
  "lily-small": "lily_small.glb",
  reed: "plant_flatTall.glb",
  stone: "stone_smallA.glb",
  bamboo: "crops_bambooStageA.glb",
  "dirt-row": "crops_dirtRow.glb",
  greens: "crops_leafsStageB.glb",
  palm: "tree_palm.glb",
  "palm-short": "tree_palmShort.glb",
  cliff: "cliff_large_stone.glb",
  "parasol-table": "detail-parasol-a.glb",
  bench: "7uSlZo3n9Y-bench-q2.glb",
  "food-stall": "hts7l0NZxW-market-stand-q2.glb",
  dock: "XViKoBh2UN-dock-q1.glb",
  boat: "5UEl54KsuC-boat-q.glb",
  gazebo: "xYZB1TmGMv-gazebo-q.glb",
  "notice-board": "4MSsNFk5fc-sign-q.glb",
  "arrow-sign": "dwmvPHHCdq-arrow-sign-q.glb",
};

/** Column-major 4x4 of a glTF node (matrix or TRS). */
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ]; // prettier-ignore
}
const mul = (a, b) =>
  Array.from({ length: 16 }, (_, i) => {
    const [c, r] = [i >> 2, i & 3];
    return (
      a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
    );
  });
const apply = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
const det3 = (m) =>
  m[0] * (m[5] * m[10] - m[6] * m[9]) -
  m[4] * (m[1] * m[10] - m[2] * m[9]) +
  m[8] * (m[1] * m[6] - m[2] * m[5]);
/** Linear [0, 1] -> sRGB byte. */
const srgb = (c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));

function bakeProp(file, atlas) {
  const g = glb(read(file), file);
  const mats = [];
  const base = [];
  const matIndex = (name, rgb) => {
    const k = mats.indexOf(name);
    if (k >= 0) return k;
    base.push(hex(rgb));
    return mats.push(name) - 1;
  };
  const verts = []; // [x, y, z, mat] in source units, Y-up, before the foot is moved to y = 0
  const seen = new Map();
  const index = [];
  const visit = (n, parent) => {
    const node = g.j.nodes[n];
    const m = mul(parent, local(node));
    for (const c of node.children ?? []) visit(c, m);
    if (node.mesh == null) return;
    if (det3(m) <= 0) throw new Error(`${file}: mirrored node transform`);
    for (const p of g.j.meshes[node.mesh].primitives) {
      if ((p.mode ?? 4) !== 4) throw new Error(`${file}: not triangles`);
      const mat = g.j.materials[p.material];
      const pbr = mat.pbrMetallicRoughness ?? {};
      const factor = (pbr.baseColorFactor ?? [1, 1, 1, 1]).slice(0, 3);
      const textured = pbr.baseColorTexture != null;
      if (textured && (pbr.baseColorTexture.texCoord ?? 0) !== 0)
        throw new Error(`${file}: texCoord`);
      if (textured && factor.some((f) => f !== 1)) throw new Error(`${file}: tinted texture`);
      const tt = pbr.baseColorTexture?.extensions?.KHR_texture_transform;
      if (tt && (tt.offset || tt.scale || tt.rotation))
        throw new Error(`${file}: texture transform`);
      const pos = g.acc(p.attributes.POSITION);
      const uv = textured ? g.acc(p.attributes.TEXCOORD_0) : null;
      const remap = [];
      for (let i = 0; i < pos.length / 3; i++) {
        let name = mat.name;
        let rgb = factor.map(srgb);
        if (textured) {
          // Palette atlas: every vertex sits on one flat swatch.
          rgb = atlas(uv[i * 2], uv[i * 2 + 1]);
          name = `${mat.name}:${hex(rgb).toString(16).padStart(6, "0")}`;
        }
        const [x, y, z] = apply(m, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        const mi = matIndex(name, rgb);
        const key = `${[x, y, z].map((v) => Math.round(v * Q))}|${mi}`;
        if (!seen.has(key)) seen.set(key, verts.push([x, y, z, mi]) - 1);
        remap[i] = seen.get(key);
      }
      const idx = g.acc(p.indices);
      for (const v of idx) index.push(remap[v]);
    }
  };
  for (const n of g.j.scenes[g.j.scene ?? 0].nodes) visit(n, local({}));
  // Foot on y = 0 (the placement plan's convention); x/z keep the authored origin.
  const minY = Math.min(...index.map((v) => verts[v][1]));
  const keep = [];
  const map = new Map();
  for (const v of index) if (!map.has(v)) map.set(v, keep.push(v) - 1);
  return {
    source: file,
    mats,
    base,
    position: keep.flatMap((v) => {
      const [x, y, z] = verts[v];
      return [x, y - minY, z].map((c) => Math.round(c * Q));
    }),
    mat: keep.map((v) => verts[v][3]),
    index: packIndex(index.map((v) => map.get(v))),
  };
}

function bake() {
  const atlas = png(read("Textures/colormap.png"));
  const props = Object.fromEntries(
    Object.entries(PROPS).map(([id, f]) => [id, bakeProp(f, atlas)]),
  );
  return { version: 1, q: Q, props };
}

const out = bake();
for (const [id, p] of Object.entries(out.props))
  console.log(
    `${id.padEnd(14)} verts ${String(p.mat.length).padStart(4)} tris ${String(p.index.length / 3).padStart(4)} mats ${p.mats.join(" ")}`,
  );
emit(bake, OUT, args.includes("--check"));
