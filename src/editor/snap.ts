import { add, along, distance, distanceToSegment, normalize, samePoint, scale, sub, JOIN_TOLERANCE } from '../model/geometry';
import type { Plan, Point } from '../model/types';

export interface Snap {
  point: Point;
  kind: 'endpoint' | 'wall' | 'grid';
  wallId?: string;
}

/**
 * Snaps a pointer position: to the nearest wall end within `tol` inches, else onto the nearest
 * wall centerline within `tol`, else to the nearest `grid` inches.
 */
export function snapPoint(plan: Plan, p: Point, tol: number, grid = 1): Snap {
  let best: { d: number; point: Point } | null = null;
  for (const w of plan.walls) {
    for (const q of [w.a, w.b]) {
      const d = distance(p, q);
      if (d <= tol && (!best || d < best.d)) best = { d, point: q };
    }
  }
  if (best) return { point: { ...best.point }, kind: 'endpoint' };

  let onWall: { d: number; point: Point; wallId: string } | null = null;
  for (const w of plan.walls) {
    const d = distanceToSegment(p, w.a, w.b);
    if (d > tol || (onWall && d >= onWall.d) || samePoint(w.a, w.b)) continue;
    const u = normalize(sub(w.b, w.a));
    const t = along(p, w.a, u);
    onWall = { d, point: add(w.a, scale(u, t)), wallId: w.id };
  }
  if (onWall) return { point: onWall.point, kind: 'wall', wallId: onWall.wallId };

  return { point: { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid }, kind: 'grid' };
}

const DEG = Math.PI / 180;

/** Angle in degrees (0 = east, 90 = north) from `a` toward `b`, in [0, 360). */
export function angleDeg(a: Point, b: Point): number {
  const deg = Math.atan2(b.y - a.y, b.x - a.x) / DEG;
  return (deg + 360) % 360;
}

/** Rounds an angle to the nearest multiple of 90 degrees when within `tolDeg` of it. */
export function snapAngle(deg: number, tolDeg = 8): number {
  const nearest = Math.round(deg / 90) * 90;
  return Math.abs(deg - nearest) <= tolDeg ? nearest % 360 : deg;
}

export interface DraftInput {
  /** Where the wall starts. */
  start: Point;
  /** Where the pointer is (already snapped), if it has moved. */
  cursor?: Snap;
  /** Typed length in inches. */
  length?: number;
  /** Typed or arrow-key angle in degrees, 0 = east, 90 = north. */
  angle?: number;
  /** Snap the pointer direction to 90-degree steps. */
  snapAngles: boolean;
}

/**
 * Where the wall being drawn ends.
 * - Typed length and angle win.
 * - Without a typed length, a pointer on a wall end lands exactly on it; otherwise the pointer
 *   distance is rounded to the nearest inch along the (snapped) direction.
 * Returns null when there is no direction or length yet.
 */
export function draftEnd(input: DraftInput): Point | null {
  const { start, cursor, length } = input;
  if (length === undefined && cursor?.kind === 'endpoint' && input.angle === undefined) {
    return distance(start, cursor.point) > JOIN_TOLERANCE ? cursor.point : null;
  }
  let angle = input.angle;
  if (angle === undefined) {
    if (!cursor || distance(start, cursor.point) <= JOIN_TOLERANCE) {
      if (length === undefined) return null;
      angle = 0;
    } else {
      const raw = angleDeg(start, cursor.point);
      angle = input.snapAngles ? snapAngle(raw) : raw;
    }
  }
  const dir = { x: Math.cos(angle * DEG), y: Math.sin(angle * DEG) };
  // Exact zeros for the 90-degree directions, so typed walls land on whole numbers.
  if (angle % 90 === 0) {
    dir.x = Math.round(dir.x);
    dir.y = Math.round(dir.y);
  }
  let len = length;
  if (len === undefined) {
    if (!cursor) return null;
    len = Math.round(Math.max(0, (cursor.point.x - start.x) * dir.x + (cursor.point.y - start.y) * dir.y));
  }
  if (!(len > JOIN_TOLERANCE)) return null;
  return { x: start.x + dir.x * len, y: start.y + dir.y * len };
}
