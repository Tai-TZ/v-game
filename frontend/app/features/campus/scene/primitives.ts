import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  PlaneGeometry,
  RingGeometry,
  Shape,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { PLAZA } from "../layout";
import { shade } from "./palette";

/*
 * Shape helpers with the argument order of art-direction §5.0, and the part pipeline that
 * bakes light into vertex colours (§2.3–§2.4). Every helper returns a fresh geometry in
 * absolute world coordinates.
 */

export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return new BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate(
    (x0 + x1) / 2,
    (y0 + y1) / 2,
    (z0 + z1) / 2,
  );
}

export function cyl(rTop: number, rBot: number, seg: number, y0: number, y1: number, x = 0, z = 0) {
  return new CylinderGeometry(rTop, rBot, y1 - y0, seg).translate(x, (y0 + y1) / 2, z);
}

export function cone(r: number, seg: number, y0: number, y1: number, x = 0, z = 0, sq = false) {
  const geometry = new ConeGeometry(r, y1 - y0, seg);
  if (sq) geometry.rotateY(Math.PI / 4);
  return geometry.translate(x, (y0 + y1) / 2, z);
}

export function ico(r: number, detail: number, x: number, y: number, z: number) {
  return new IcosahedronGeometry(r, detail).translate(x, y, z);
}

const flat = (geometry: BufferGeometry, x: number, y: number, z: number) =>
  geometry.rotateX(-Math.PI / 2).translate(x, y, z);

export function circle(r: number, seg: number, x: number, y: number, z: number) {
  return flat(new CircleGeometry(r, seg), x, y, z);
}

export function ring(rIn: number, rOut: number, seg: number, x: number, y: number, z: number) {
  return flat(new RingGeometry(rIn, rOut, seg), x, y, z);
}

export function rect(x0: number, x1: number, z0: number, z1: number, y: number) {
  return flat(new PlaneGeometry(x1 - x0, z1 - z0), (x0 + x1) / 2, y, (z0 + z1) / 2);
}

export type Face = "+x" | "+z";

/** Stands a flat shape (built facing +z) on a façade, 0.01 out from the wall. */
export function onFace(geometry: BufferGeometry, face: Face, plane: number, u: number, v: number) {
  if (face === "+z") return geometry.translate(u, v, plane + 0.01);
  return geometry.rotateY(Math.PI / 2).translate(plane + 0.01, v, u);
}

export function quad(face: Face, plane: number, u: number, v: number, w: number, h: number) {
  return onFace(new PlaneGeometry(w, h), face, plane, u, v);
}

export function arch(face: Face, plane: number, u: number, v: number, r: number) {
  return onFace(new CircleGeometry(r, 8, 0, Math.PI), face, plane, u, v);
}

export function disc(face: Face, plane: number, u: number, v: number, r: number, seg: number) {
  return onFace(new CircleGeometry(r, seg), face, plane, u, v);
}

/** Triangular prism with its ridge along x (gable roof): 8 triangles, wound outwards. */
export function prismX(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  yBase: number,
  yRidge: number,
) {
  const zm = (z0 + z1) / 2;
  const a = [x0, yBase, z0];
  const b = [x0, yBase, z1];
  const c = [x0, yRidge, zm];
  const d = [x1, yBase, z0];
  const e = [x1, yBase, z1];
  const f = [x1, yRidge, zm];
  const triangles = [a, b, c, d, f, e, b, e, f, b, f, c, a, c, f, a, f, d, a, d, e, a, e, b];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(triangles.flat(), 3));
  return geometry;
}

/** Annular sector following the colonnade curve around the plaza, extruded from y0 to y1. */
export function arcSlab(rIn: number, rOut: number, a0: number, a1: number, y0: number, y1: number) {
  const SEGMENTS = 16;
  const point = (angle: number, r: number) =>
    new Vector2(PLAZA.x + Math.sin(angle) * r, -(PLAZA.z - Math.cos(angle) * r));
  const outline: Vector2[] = [];
  for (let i = 0; i <= SEGMENTS; i += 1) outline.push(point(a0 + ((a1 - a0) * i) / SEGMENTS, rOut));
  for (let i = SEGMENTS; i >= 0; i -= 1) outline.push(point(a0 + ((a1 - a0) * i) / SEGMENTS, rIn));
  return new ExtrudeGeometry(new Shape(outline), { depth: y1 - y0, bevelEnabled: false })
    .rotateX(-Math.PI / 2)
    .translate(0, y0, 0);
}

export function lathe(profile: readonly [number, number][], seg: number, x: number, z: number) {
  const points = profile.map(([r, y]) => new Vector2(r, y));
  return new LatheGeometry(points, seg).translate(x, 0, z);
}

/** Flat ground triangles with per-vertex colours, wound to face up (skirts, contact discs). */
export function groundTriangles(
  vertices: readonly { x: number; z: number; color: Color }[],
  y: number,
) {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i + 2 < vertices.length; i += 3) {
    let tri = vertices.slice(i, i + 3);
    const [p, q, r] = tri as [
      (typeof vertices)[number],
      (typeof vertices)[number],
      (typeof vertices)[number],
    ];
    // Upward normal needs (q - p) × (r - p) to have positive y.
    const ny = (q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z);
    if (ny < 0) tri = [p, r, q];
    for (const v of tri) {
      positions.push(v.x, y, v.z);
      colors.push(v.color.r, v.color.g, v.color.b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

export interface PartStyle {
  /** One colour, or `top` for faces with n.y > 0.5 and `side` for the rest. */
  color: Color | { top: Color; side: Color };
  /** Darken the foot of vertical faces (fake ambient occlusion, art §2.4). */
  ao?: boolean;
  /** Lit from inside: skip baked shading (windows, lamps, clock face). */
  emissive?: boolean;
}

const normal = new Vector3();

/**
 * Converts a primitive into a flat-shaded, non-indexed part with a `color` attribute.
 * `baked` multiplies in the light (MeshBasicMaterial groups); `lit` keeps plain colours and
 * normals for MeshLambertMaterial (figures, trees).
 */
export function part(source: BufferGeometry, style: PartStyle, mode: "baked" | "lit" = "baked") {
  const geometry = source.index ? source.toNonIndexed() : source;
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();

  const position = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox?.min.y ?? 0;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i += 1) {
    normal.fromBufferAttribute(normals, i);
    const base =
      style.color instanceof Color
        ? style.color
        : normal.y > 0.5
          ? style.color.top
          : style.color.side;
    let k = 1;
    if (mode === "baked" && !style.emissive) {
      k = shade(normal);
      if (style.ao && Math.abs(normal.y) < 0.5 && position.getY(i) <= minY + 0.001) k *= 0.82;
    }
    colors[i * 3] = base.r * k;
    colors[i * 3 + 1] = base.g * k;
    colors[i * 3 + 2] = base.b * k;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  if (mode === "baked") geometry.deleteAttribute("normal");
  return geometry;
}

/** Merges parts into one geometry (one draw call). */
export function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  // Every part carries the same attributes (position + colour, plus normal for "lit").
  const merged = mergeGeometries([...parts]);
  for (const piece of parts) piece.dispose();
  return merged;
}

export function triangleCount(geometry: BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
}
