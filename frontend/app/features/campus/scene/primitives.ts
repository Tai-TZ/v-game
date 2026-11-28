import {
  BoxGeometry,
  type BufferAttribute,
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
import { shade, type Light } from "./palette";

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

/**
 * A `box` with its four top edges and four vertical corner edges bevelled at 45°, `c` wide
 * (graphics upgrade §4.4.1; clamped for thin slabs, never more than half of any side); the
 * bottom stays square. Same outer bounds as `box`, non-indexed, 36 triangles, closed: top 2,
 * top bevels 8, sides 8, corner bevels 8, corner caps 4, octagonal bottom 6. `part()` bakes the
 * bevels with their own 45° normals, so they catch a light between the top face and the wall: a
 * thin highlight, no new material.
 */
export function chamferBox(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  c = 0.04,
) {
  const w = Math.min(c, (x1 - x0) / 2, (z1 - z0) / 2, (y1 - y0) / 2);
  const [xa, xb, za, zb] = [x0 + w, x1 - w, z0 + w, z1 - w];
  const yc = y1 - w;
  const centre = new Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const positions: number[] = [];
  // Each triangle is wound to face away from the centre, which a convex solid makes unambiguous.
  const tri = (a: Vector3, b: Vector3, d: Vector3) => {
    const n = b.clone().sub(a).cross(d.clone().sub(a));
    const out = a.clone().add(b).add(d).divideScalar(3).sub(centre);
    const [p, q] = n.dot(out) < 0 ? [d, b] : [b, d];
    for (const v of [a, p, q]) positions.push(v.x, v.y, v.z);
  };
  const quad = (a: Vector3, b: Vector3, d: Vector3, e: Vector3) => {
    tri(a, b, d);
    tri(a, d, e);
  };
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  quad(v(xa, y1, za), v(xb, y1, za), v(xb, y1, zb), v(xa, y1, zb));
  quad(v(xb, y1, za), v(xb, y1, zb), v(x1, yc, zb), v(x1, yc, za));
  quad(v(xa, y1, za), v(xa, y1, zb), v(x0, yc, zb), v(x0, yc, za));
  quad(v(xa, y1, zb), v(xb, y1, zb), v(xb, yc, z1), v(xa, yc, z1));
  quad(v(xa, y1, za), v(xb, y1, za), v(xb, yc, z0), v(xa, yc, z0));
  quad(v(x1, yc, za), v(x1, yc, zb), v(x1, y0, zb), v(x1, y0, za));
  quad(v(x0, yc, za), v(x0, yc, zb), v(x0, y0, zb), v(x0, y0, za));
  quad(v(xa, yc, z1), v(xb, yc, z1), v(xb, y0, z1), v(xa, y0, z1));
  quad(v(xa, yc, z0), v(xb, yc, z0), v(xb, y0, z0), v(xa, y0, z0));
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const cx = sx > 0 ? x1 : x0;
    const cz = sz > 0 ? z1 : z0;
    const ex = sx > 0 ? xb : xa;
    const ez = sz > 0 ? zb : za;
    tri(v(ex, y1, ez), v(cx, yc, ez), v(ex, yc, cz));
    quad(v(cx, yc, ez), v(ex, yc, cz), v(ex, y0, cz), v(cx, y0, ez));
  }
  // The bottom: an octagon (the corner bevels cut its corners), fanned from one vertex.
  const ring = [
    v(xa, y0, z0),
    v(xb, y0, z0),
    v(x1, y0, za),
    v(x1, y0, zb),
    v(xb, y0, z1),
    v(xa, y0, z1),
    v(x0, y0, zb),
    v(x0, y0, za),
  ];
  const first = ring[0];
  if (!first) throw new Error("empty ring");
  for (let i = 1; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (a && b) tri(first, a, b);
  }
  return new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3));
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

/** Flat ring; after laying it down, θ points to (cos θ, −sin θ), so 7π/6 + 2π/3 is the +z arc. */
export function ring(
  rIn: number,
  rOut: number,
  seg: number,
  x: number,
  y: number,
  z: number,
  thetaStart = 0,
  thetaLength = Math.PI * 2,
) {
  return flat(new RingGeometry(rIn, rOut, seg, 1, thetaStart, thetaLength), x, y, z);
}

export function rect(x0: number, x1: number, z0: number, z1: number, y: number) {
  return flat(new PlaneGeometry(x1 - x0, z1 - z0), (x0 + x1) / 2, y, (z0 + z1) / 2);
}

export type Face = "+x" | "+z" | "-x" | "-z";

/** Turn about y taking a shape built facing +z to face `face`: a turn, never a mirror. */
const TURN: Record<Face, number> = {
  "+z": 0,
  "+x": Math.PI / 2,
  "-z": Math.PI,
  "-x": -Math.PI / 2,
};

/** Outward from a façade: +0.01 on the +x/+z walls, −0.01 on the −x/−z walls. */
export const outward = (face: Face) => (face.startsWith("+") ? 0.01 : -0.01);

/**
 * Stands a flat shape (built facing +z) on a façade, 0.01 out from the wall; `u` runs along the
 * wall (world x on a z face, world z on an x face). Half-discs stay arched upwards and a clock on
 * the −z wall still reads clockwise, since the shape is turned, not mirrored.
 */
export function onFace(geometry: BufferGeometry, face: Face, plane: number, u: number, v: number) {
  geometry.rotateY(TURN[face]);
  return face.endsWith("z")
    ? geometry.translate(u, v, plane + outward(face))
    : geometry.translate(plane + outward(face), v, u);
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

/**
 * Annular sector around `centre` (the plaza: the colonnade curve), extruded from y0 to y1.
 * Angle 0 points to -z, π/2 to +x.
 */
export function arcSlab(
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  centre: { x: number; z: number } = PLAZA,
) {
  const SEGMENTS = 16;
  const point = (angle: number, r: number) =>
    new Vector2(centre.x + Math.sin(angle) * r, -(centre.z - Math.cos(angle) * r));
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
  /**
   * One colour, or `top` for faces with n.y > 0.5 and `side` for the rest. Omitted: keep the
   * source's own vertex colours (ground triangles).
   */
  color?: Color | { top: Color; side: Color } | undefined;
  /** Darken the foot of vertical faces (fake ambient occlusion, art §2.4). */
  ao?: boolean;
  /**
   * Shade under an eave or beam (graphics upgrade §4.4.3): wall vertices from 0.25 u under this
   * world y up to it are × 0.87. Top faces never change.
   */
  aoUnder?: number;
  /** Lit from inside: skip the bake (windows, lamps, clock face). */
  emissive?: boolean;
  /** Distance haze: after shading, pull this far towards the top-face light (v0.3 §5.2). */
  haze?: number;
}

const normal = new Vector3();
const UP = new Vector3(0, 1, 0);
const base = new Color();
const k = new Color();

/**
 * Converts a primitive into a flat-shaded, non-indexed part with a `color` attribute.
 * With a `light`, bakes it into the colours (MeshBasicMaterial groups); with `null`, keeps plain
 * colours and normals for MeshLambertMaterial (figures, trees), which the scene lights shade.
 */
export function part(source: BufferGeometry, style: PartStyle, light: Light | null) {
  const geometry = source.index ? source.toNonIndexed() : source;
  const own = geometry.getAttribute("color") as BufferAttribute | undefined;
  if (!style.color && !own) throw new Error("part() needs a colour or vertex colours");
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();

  const position = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox?.min.y ?? 0;
  const colors = new Float32Array(position.count * 3);
  const haze = style.haze ?? 0;
  const hazeTo = light ? shade(UP, light) : new Color(1, 1, 1);

  for (let i = 0; i < position.count; i += 1) {
    normal.fromBufferAttribute(normals, i);
    const color = style.color;
    if (color) base.copy(color instanceof Color ? color : normal.y > 0.5 ? color.top : color.side);
    else if (own) base.fromBufferAttribute(own, i);
    k.setRGB(1, 1, 1);
    if (light && !style.emissive) {
      shade(normal, light, k);
      if (style.ao && Math.abs(normal.y) < 0.5 && position.getY(i) <= minY + 0.001) {
        k.multiplyScalar(0.82);
      }
      const under = (style.aoUnder ?? -Infinity) - position.getY(i);
      if (Math.abs(normal.y) < 0.5 && under > -0.001 && under <= 0.25) k.multiplyScalar(0.87);
    }
    base.multiply(k).lerp(hazeTo, haze);
    colors[i * 3] = base.r;
    colors[i * 3 + 1] = base.g;
    colors[i * 3 + 2] = base.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  if (light) geometry.deleteAttribute("normal");
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
