import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { Box3, Color } from "three";
import { describe, expect, it } from "vitest";

import { baseColors, buildProp, paintProp, parseProps, type PropsJson } from "./props";

const FILE = path.resolve(process.cwd(), "public", "models", "props.json");
const text = readFileSync(FILE, "utf8");
const json = JSON.parse(text) as PropsJson;

// [triangles, plan scale, plan height] per prop: triangle counts are fixed by the baker, scale and
// height come from the dressing placement plan (height = baked height × scale, plan rounds to cm).
const PROPS: Record<string, [number, number, number | null]> = {
  "bush-large": [60, 2.2, 0.53],
  bush: [32, 1.6, 0.38],
  pot: [68, 1.5, 0.3],
  "lily-large": [86, 2.0, 0.2],
  "lily-small": [52, 2.0, 0.08],
  reed: [32, 2.0, 0.56],
  stone: [16, 1.4, 0.27],
  bamboo: [276, 2.6, 1.43],
  "dirt-row": [44, 1.5, 0.08],
  greens: [84, 1.1, 0.75],
  palm: [186, 1.5, 2.27],
  "palm-short": [190, 1.6, 1.7],
  cliff: [32, 0.55, null], // non-uniform scale on a cliff face; no target height in the plan
  "parasol-table": [96, 2.5, 1.13],
  bench: [276, 2.0, 0.38],
  "food-stall": [1132, 1.3, 1.35],
  dock: [388, 2.2, 1.03],
  boat: [224, 0.12, 0.24],
  gazebo: [698, 1.3, 1.76],
  "notice-board": [284, 0.8, 0.82],
  "arrow-sign": [120, 0.6, 1.23],
};

const entries = Object.entries(json.props);

describe("props.json format", () => {
  it("holds exactly the 21 planned props", () => {
    expect(json.version).toBe(1);
    expect(Object.keys(json.props).sort()).toEqual(Object.keys(PROPS).sort());
  });

  it("is the canonical output of the baker (no hand edits, no reformatting)", () => {
    expect(text).toBe(JSON.stringify(json));
  });

  it("stays within its download budget", () => {
    const bytes = Buffer.from(text);
    expect(bytes.length).toBeLessThanOrEqual(95_000);
    expect(gzipSync(bytes).length).toBeLessThanOrEqual(24_000);
    expect(brotliCompressSync(bytes).length).toBeLessThanOrEqual(19_500);
  });

  it("names a colour for every material, and atlas swatches by their colour", () => {
    for (const [id, p] of entries) {
      expect(p.base, id).toHaveLength(p.mats.length);
      expect(new Set(p.mats).size, id).toBe(p.mats.length);
      expect(new Set(p.mat), id).toEqual(new Set(p.mats.map((_, i) => i)));
      p.mats.forEach((name, i) => {
        const swatch = /:([0-9a-f]{6})$/.exec(name)?.[1];
        if (swatch) expect(parseInt(swatch, 16), `${id} ${name}`).toBe(p.base[i]);
      });
    }
    expect(json.props["parasol-table"]?.mats.every((m) => m.startsWith("colormap:"))).toBe(true);
  });

  it("flags the one double-sided source (the parasol's open canopy)", () => {
    const flagged = entries.filter(([, p]) => p.doubleSided).map(([id]) => id);
    expect(flagged).toEqual(["parasol-table"]);
  });
});

describe("parseProps", () => {
  const broken = (edit: (j: PropsJson) => void) => {
    const j = JSON.parse(text) as PropsJson;
    edit(j);
    return parseProps(j);
  };
  const pot = (j: PropsJson) => {
    const p = j.props.pot;
    if (!p) throw new Error("pot");
    return p;
  };

  it("accepts the baked file", () => {
    expect(parseProps(JSON.parse(text))).not.toBeNull();
  });

  it.each<[string, (j: PropsJson) => void]>([
    ["a wrong version", (j) => Object.assign(j, { version: 2 })],
    ["q = 0", (j) => Object.assign(j, { q: 0 })],
    ["an index past the last vertex", (j) => pot(j).index.splice(0, 3, 0, 5, 0)],
    ["a triangle cut short", (j) => pot(j).index.pop()],
    ["a short position array", (j) => pot(j).position.pop()],
    ["a material past the list", (j) => pot(j).mat.splice(0, 1, pot(j).mats.length)],
    ["a material without a colour", (j) => pot(j).base.pop()],
  ])("rejects %s", (_, edit) => {
    expect(broken(edit)).toBeNull();
  });

  it("rejects what is not a props file at all", () => {
    for (const bad of [null, 1, "props", [], {}]) expect(parseProps(bad)).toBeNull();
  });
});

describe("props decoding", () => {
  it.each(entries)("%s decodes to one indexed geometry with the baked triangle count", (id, p) => {
    const [triangles, scale, height] = PROPS[id] ?? [0, 0, null];
    const geometry = buildProp(json, p);
    const n = p.mat.length;
    expect(geometry.getAttribute("position").count).toBe(n);
    expect(p.position).toHaveLength(n * 3);
    expect(geometry.index?.count).toBe(triangles * 3);
    const index = Array.from(geometry.index?.array ?? []);
    expect(Math.min(...index)).toBe(0);
    expect(Math.max(...index)).toBe(n - 1);

    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new Box3();
    expect(box.min.y).toBe(0); // foot on the ground
    if (height !== null)
      expect(Math.abs((box.max.y - box.min.y) * scale - height)).toBeLessThan(0.015);
  });

  it("totals 4,376 triangles for one copy of each prop", () => {
    const total = entries.reduce((sum, [, p]) => sum + p.index.length / 3, 0);
    expect(total).toBe(4376);
  });
});

describe("props recolouring", () => {
  it("paints each vertex with its material's colour and leaves positions alone", () => {
    for (const [id, p] of entries) {
      const geometry = buildProp(json, p);
      const position = geometry.getAttribute("position").array.slice();
      const color = geometry.getAttribute("color");

      const base = baseColors(p);
      paintProp(geometry, p, base);
      const theme = p.mats.map((_, i) => new Color().setHSL(i / p.mats.length, 0.5, 0.5));
      const before = color.array.slice();
      paintProp(geometry, p, theme);

      p.mat.forEach((m, i) => {
        expect(color.getX(i), id).toBeCloseTo(theme[m]?.r ?? -1, 6);
        expect(color.getZ(i), id).toBeCloseTo(theme[m]?.b ?? -1, 6);
        expect(before[i * 3 + 1], id).toBeCloseTo(base[m]?.g ?? -1, 6);
      });
      expect(geometry.getAttribute("position").array, id).toEqual(position);
    }
  });

  it("refuses to paint with a missing colour slot", () => {
    const p = json.props.pot;
    if (!p) throw new Error("pot");
    expect(() => {
      paintProp(buildProp(json, p), p, [new Color()]);
    }).toThrow(/no colour for material woodBarkDark/);
  });
});

describe("model decoders stay in the scene chunk", () => {
  it("cast.ts and props.ts import only three, and only scene modules import them", () => {
    const scene = path.resolve(process.cwd(), "app", "features", "campus", "scene");
    for (const name of ["cast.ts", "props.ts"]) {
      const imports = [...readFileSync(path.join(scene, name), "utf8").matchAll(/from "([^"]+)"/g)];
      expect(
        imports.map((m) => m[1]).every((s) => s === "three" || s === "./cast"),
        name,
      ).toBe(true);
    }
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name)) files.push(full);
      }
    };
    walk(path.resolve(process.cwd(), "app"));
    for (const file of files.filter((f) => path.dirname(f) !== scene))
      expect(readFileSync(file, "utf8"), file).not.toMatch(/scene\/(cast|props)["']/);
  });
});
