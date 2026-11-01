import {
  JOIN_TOLERANCE,
  add,
  along,
  angleOf,
  distance,
  distanceToSegment,
  length,
  lineIntersection,
  normalize,
  perpLeft,
  samePoint,
  scale,
  sub,
} from './geometry';
import type { Plan, Point, Wall } from './types';

/**
 * Corners at one end of a wall. `left` and `right` are relative to the direction
 * pointing away from that end, along the wall.
 */
export interface EndCorners {
  left: Point;
  right: Point;
}

/** A stretch of a wall face that another wall butts into. Distances are along the wall from `a`. */
export interface Abutment {
  wallId: string;
  /** Face of this wall, looking from `a` toward `b`. */
  side: 'left' | 'right';
  from: number;
  to: number;
}

export interface Span {
  from: number;
  to: number;
}

export interface WallGeometry {
  wall: Wall;
  length: number;
  /** Unit direction from `a` to `b`. */
  dir: Point;
  start: EndCorners;
  end: EndCorners;
  /** Footprint polygon, counterclockwise. */
  outline: Point[];
  /** Usable length of each face, measured along the wall from `a`. Left and right look from `a` toward `b`. */
  faces: { left: Span; right: Span };
  /** Where an opening can cut through both faces without running into a corner. */
  clear: Span;
  /** Walls that end against the middle of this wall. */
  abutments: Abutment[];
}

/**
 * Corner joins further from the junction than this many wall half-thicknesses are
 * cut square instead, so very sharp corners do not produce long spikes.
 */
const MITER_LIMIT = 6;

interface Ray {
  wall: Wall;
  /** Which end of the wall is at the junction, or `through` for a wall passing through it. */
  at: 'start' | 'end' | 'through';
  dir: Point;
  half: number;
  angle: number;
  left?: Point;
  right?: Point;
}

/** All distinct wall endpoints in the plan. */
function junctionPoints(walls: readonly Wall[]): Point[] {
  const pts: Point[] = [];
  for (const w of walls) {
    for (const p of [w.a, w.b]) if (!pts.some((q) => samePoint(p, q))) pts.push(p);
  }
  return pts;
}

function raysAt(node: Point, walls: readonly Wall[]): Ray[] {
  const rays: Ray[] = [];
  for (const wall of walls) {
    const u = normalize(sub(wall.b, wall.a));
    const half = wall.thickness / 2;
    const ray = (at: Ray['at'], dir: Point): Ray => ({ wall, at, dir, half, angle: angleOf(dir) });
    if (samePoint(wall.a, node)) rays.push(ray('start', u));
    else if (samePoint(wall.b, node)) rays.push(ray('end', scale(u, -1)));
    else if (distanceToSegment(node, wall.a, wall.b) <= JOIN_TOLERANCE) {
      rays.push(ray('through', u), ray('through', scale(u, -1)));
    }
  }
  return rays.sort((r, s) => r.angle - s.angle);
}

/** Works out the corner points of every wall end meeting at `node`. */
function solveJunction(node: Point, rays: Ray[]): void {
  const leftOffset = (r: Ray): Point => add(node, scale(perpLeft(r.dir), r.half));
  const rightOffset = (r: Ray): Point => add(node, scale(perpLeft(r.dir), -r.half));
  if (rays.length === 1) {
    const r = rays[0]!;
    r.left = leftOffset(r);
    r.right = rightOffset(r);
    return;
  }
  for (let i = 0; i < rays.length; i++) {
    // The space counterclockwise from `r` to `next` is bounded by r's left face and next's right face.
    const r = rays[i]!;
    const next = rays[(i + 1) % rays.length]!;
    const p = lineIntersection(leftOffset(r), r.dir, rightOffset(next), next.dir);
    const limit = MITER_LIMIT * Math.max(r.half, next.half);
    if (p && distance(p, node) <= limit) {
      r.left = p;
      next.right = p;
    } else {
      r.left = leftOffset(r);
      next.right = rightOffset(next);
    }
  }
}

/** Geometry for every wall in the plan, keyed by wall id. */
export function wallGeometry(plan: Pick<Plan, 'walls'>): Map<string, WallGeometry> {
  const walls = plan.walls.filter((w) => distance(w.a, w.b) > JOIN_TOLERANCE);
  const corners = new Map<string, { start?: EndCorners; end?: EndCorners }>();
  const abutments = new Map<string, Abutment[]>();

  for (const node of junctionPoints(walls)) {
    const rays = raysAt(node, walls);
    solveJunction(node, rays);
    for (const r of rays) {
      if (r.at === 'through') continue;
      const c = corners.get(r.wall.id) ?? {};
      c[r.at] = { left: r.left!, right: r.right! };
      corners.set(r.wall.id, c);
    }
    // A wall ending against the middle of another wall: record where it meets that wall's face.
    const hosts = new Set(rays.filter((r) => r.at === 'through').map((r) => r.wall));
    for (const hostWall of hosts) {
      const u = normalize(sub(hostWall.b, hostWall.a));
      const n = perpLeft(u);
      for (const r of rays) {
        if (r.at === 'through') continue;
        const side: Abutment['side'] = r.dir.x * n.x + r.dir.y * n.y > 0 ? 'left' : 'right';
        const t1 = along(r.left!, hostWall.a, u);
        const t2 = along(r.right!, hostWall.a, u);
        const list = abutments.get(hostWall.id) ?? [];
        list.push({ wallId: r.wall.id, side, from: Math.min(t1, t2), to: Math.max(t1, t2) });
        abutments.set(hostWall.id, list);
      }
    }
  }

  const out = new Map<string, WallGeometry>();
  for (const wall of walls) {
    const dir = normalize(sub(wall.b, wall.a));
    const len = length(sub(wall.b, wall.a));
    const c = corners.get(wall.id)!;
    const start = c.start!;
    const end = c.end!;
    // Left face (looking a -> b) runs from start.left to end.right; right face from start.right to end.left.
    const faces = {
      left: { from: along(start.left, wall.a, dir), to: along(end.right, wall.a, dir) },
      right: { from: along(start.right, wall.a, dir), to: along(end.left, wall.a, dir) },
    };
    out.set(wall.id, {
      wall,
      length: len,
      dir,
      start,
      end,
      outline: [start.right, end.left, end.right, start.left],
      faces,
      clear: { from: Math.max(faces.left.from, faces.right.from, 0), to: Math.min(faces.left.to, faces.right.to, len) },
      abutments: abutments.get(wall.id) ?? [],
    });
  }
  return out;
}
