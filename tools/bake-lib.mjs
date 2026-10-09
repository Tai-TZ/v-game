// Shared, dependency-free helpers of the offline model bakers (tools/characters, tools/props):
// a GLB reader, a PNG decoder for palette atlases, sha256-checked source reads and a deterministic
// writer with a --check mode. Node built-ins only.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const SOURCES = new URL("./assets-sources.json", import.meta.url);

/** Reads `<dir>/<name>` after checking it against tools/assets-sources.json (packs `packIds`). */
export function sourceReader(dir, packIds) {
  const { packs } = JSON.parse(readFileSync(SOURCES, "utf8"));
  const want = new Map();
  for (const pack of packs.filter((p) => packIds.includes(p.id)))
    for (const f of pack.files) want.set(f.as, f.sha256);
  return (name) => {
    if (!want.has(name)) throw new Error(`${name}: not listed in tools/assets-sources.json`);
    const bytes = readFileSync(join(dir, name));
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== want.get(name)) throw new Error(`${name}: sha256 ${sha} != ${want.get(name)}`);
    return bytes;
  };
}

/** Parsed GLB: { j: glTF JSON, acc(i) -> flat number[] of accessor i }. */
export function glb(bytes, label) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`${label}: not a GLB`);
  const jl = bytes.readUInt32LE(12);
  const j = JSON.parse(bytes.subarray(20, 20 + jl).toString());
  const bin = bytes.subarray(28 + jl);
  const acc = (i) => {
    const a = j.accessors[i];
    const v = j.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const [es, read] = {
      5126: [4, (o) => bin.readFloatLE(o)],
      5125: [4, (o) => bin.readUInt32LE(o)],
      5123: [2, (o) => bin.readUInt16LE(o)],
      5121: [1, (o) => bin[o]],
    }[a.componentType];
    if (a.normalized || a.sparse) throw new Error(`${label}: normalized/sparse accessor`);
    const off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const stride = v.byteStride ?? n * es;
    const out = new Array(a.count * n);
    for (let k = 0; k < a.count; k++)
      for (let c = 0; c < n; c++) out[k * n + c] = read(off + k * stride + c * es);
    return out;
  };
  return { j, acc };
}

/** 8-bit PNG (RGB, RGBA or palette) -> texel(u, v) = [r, g, b] in sRGB bytes, nearest texel. */
export function png(b) {
  let p = 8;
  let w, h, ct, plte;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString("ascii", p + 4, p + 8);
    const d = b.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      [w, h, ct] = [d.readUInt32BE(0), d.readUInt32BE(4), d[9]];
      if (d[8] !== 8 || d[12]) throw new Error("png: need 8-bit, non-interlaced");
    }
    if (type === "PLTE") plte = d;
    if (type === "IDAT") idat.push(d);
    p += 12 + len;
  }
  const bpp = { 2: 3, 6: 4, 3: 1 }[ct];
  if (!bpp) throw new Error(`png: colour type ${ct} unsupported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const up = y ? px[(y - 1) * stride + x] : 0;
      const c = y && x >= bpp ? px[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const q = a + up - c;
        const [pa, pb, pc] = [Math.abs(q - a), Math.abs(q - up), Math.abs(q - c)];
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return (u, v) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
    const i = y * stride + x * bpp;
    if (ct === 3) return [...plte.subarray(px[i] * 3, px[i] * 3 + 3)];
    return [px[i], px[i + 1], px[i + 2]];
  };
}

/** Positions are stored as integers of this many steps per source unit (0.1 mm). */
export const Q = 1e4;
export const r4 = (x) => Math.round(x * Q) / Q;
export const hex = (rgb) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

/**
 * High-water-mark index coding: with vertices numbered in first-use order, each index is stored as
 * (vertices seen so far) - index, so every new vertex is a 0 and recent repeats are small numbers.
 */
export function packIndex(index) {
  let next = 0;
  return index.map((v) => {
    if (v > next) throw new Error("index is not in first-use order");
    const e = next - v;
    if (e === 0) next++;
    return e;
  });
}

/**
 * Writes `bake()` as JSON to `out`, or with --check compares two fresh bakes and the committed
 * file byte for byte (exit 1 on any difference).
 */
export function emit(bake, out, check) {
  const text = JSON.stringify(bake());
  if (!check) {
    writeFileSync(out, text);
    console.log(`wrote ${out}: ${Buffer.byteLength(text)} B`);
    return;
  }
  const again = JSON.stringify(bake());
  if (again !== text) throw new Error("bake is not deterministic: two runs differ");
  if (!existsSync(out)) throw new Error(`committed file not found: ${out}`);
  const committed = readFileSync(out, "utf8");
  if (committed !== text) {
    console.error(`${out} differs from a fresh bake; re-run without --check and commit it`);
    process.exit(1);
  }
  console.log(`check ok: two bakes and ${out} are byte-identical (${committed.length} B)`);
}
