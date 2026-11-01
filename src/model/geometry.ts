import type { Point } from './types';

/** Two plan points closer than this (inches) are treated as the same point. */
export const JOIN_TOLERANCE = 0.01;
const EPS = 1e-9;

export const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
export const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
export const scale = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
export const dot = (p: Point, q: Point): number => p.x * q.x + p.y * q.y;
export const cross = (p: Point, q: Point): number => p.x * q.y - p.y * q.x;
export const length = (p: Point): number => Math.hypot(p.x, p.y);
export const distance = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
export const samePoint = (p: Point, q: Point, tol = JOIN_TOLERANCE): boolean => distance(p, q) <= tol;

export function normalize(p: Point): Point {
  const l = length(p);
  if (l < EPS) throw new Error('Cannot normalize a zero-length vector');
  return { x: p.x / l, y: p.y / l };
}

/** The vector rotated 90 degrees counterclockwise (points to the left of `p`). */
export const perpLeft = (p: Point): Point => ({ x: -p.y, y: p.x });

/** Angle of a vector in radians, in (-PI, PI]. */
export const angleOf = (p: Point): number => Math.atan2(p.y, p.x);

/** Intersection of the lines `p + t*d` and `q + s*e`, or null if they are parallel. */
export function lineIntersection(p: Point, d: Point, q: Point, e: Point): Point | null {
  const denom = cross(d, e);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross(sub(q, p), e) / denom;
  return add(p, scale(d, t));
}

/** Distance of `p` along the line from `a` in unit direction `u`. */
export const along = (p: Point, a: Point, u: Point): number => dot(sub(p, a), u);

/** Distance from `p` to the segment `a`-`b`. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < EPS) return distance(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return distance(p, add(a, scale(ab, t)));
}

/** Signed area of a polygon; positive when the points run counterclockwise. */
export function signedArea(poly: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
