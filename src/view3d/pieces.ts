import { along, signedArea } from '../model/geometry';
import type { Opening, Plan, Point } from '../model/types';
import { wallGeometry, type WallGeometry } from '../model/walls';

/** A solid chunk of wall: a plan outline lifted from `z0` to `z1` (inches above the floor). */
export interface WallPiece {
  wallId: string;
  outline: Point[];
  z0: number;
  z1: number;
}

/** A window pane filling a window opening, as a thin box along the wall. */
export interface GlassPane {
  openingId: string;
  /** Four corners in plan, counterclockwise. */
  outline: Point[];
  z0: number;
  z1: number;
}

export interface WallMesh {
  pieces: WallPiece[];
  glass: GlassPane[];
}

const GLASS_THICKNESS = 0.5;
const MIN_AREA = 1e-6;

/** Keeps the part of a convex polygon where `keep(p) >= 0`, with `value` giving the signed distance. */
function clipHalfPlane(poly: Point[], value: (p: Point) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const vp = value(p);
    const vq = value(q);
    if (vp >= 0) out.push(p);
    if ((vp >= 0) !== (vq >= 0)) {
      const k = vp / (vp - vq);
      out.push({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k });
    }
  }
  return out;
}

/** The part of a wall's outline between `t0` and `t1` inches along the wall from its `a` end. */
export function sliceOutline(g: WallGeometry, t0: number, t1: number): Point[] {
  const a = g.wall.a;
  let poly = g.outline;
  if (Number.isFinite(t0)) poly = clipHalfPlane(poly, (p) => along(p, a, g.dir) - t0);
  if (Number.isFinite(t1) && poly.length) poly = clipHalfPlane(poly, (p) => t1 - along(p, a, g.dir));
  return poly.length >= 3 && Math.abs(signedArea(poly)) > MIN_AREA ? poly : [];
}

function usableOpenings(openings: Opening[], g: WallGeometry): Opening[] {
  const sorted = openings
    .filter((o) => o.wallId === g.wall.id && o.width > 0 && o.height > 0 && o.sill >= 0 && o.offset + o.width > 0 && o.offset < g.length)
    .sort((p, q) => p.offset - q.offset);
  return sorted;
}

/** Builds the solid pieces and window panes for one wall. */
export function wallMesh(g: WallGeometry, allOpenings: Opening[]): WallMesh {
  const H = g.wall.height;
  const pieces: WallPiece[] = [];
  const glass: GlassPane[] = [];
  const add = (t0: number, t1: number, z0: number, z1: number): void => {
    if (z1 - z0 <= 1e-9) return;
    const outline = sliceOutline(g, t0, t1);
    if (outline.length) pieces.push({ wallId: g.wall.id, outline, z0, z1 });
  };

  let cursor = -Infinity;
  for (const o of usableOpenings(allOpenings, g)) {
    const from = Math.max(o.offset, cursor === -Infinity ? o.offset : cursor);
    const to = o.offset + o.width;
    if (to <= from) continue; // swallowed by an overlapping opening
    add(cursor, from, 0, H);
    const bottom = Math.min(Math.max(o.sill, 0), H);
    const top = Math.min(o.sill + o.height, H);
    add(from, to, 0, bottom);
    add(from, to, top, H);
    if (o.kind === 'window' && top > bottom) {
      const half = GLASS_THICKNESS / 2;
      const nx = -g.dir.y;
      const ny = g.dir.x;
      const p0 = { x: g.wall.a.x + g.dir.x * from, y: g.wall.a.y + g.dir.y * from };
      const p1 = { x: g.wall.a.x + g.dir.x * to, y: g.wall.a.y + g.dir.y * to };
      glass.push({
        openingId: o.id,
        outline: [
          { x: p0.x - nx * half, y: p0.y - ny * half },
          { x: p1.x - nx * half, y: p1.y - ny * half },
          { x: p1.x + nx * half, y: p1.y + ny * half },
          { x: p0.x + nx * half, y: p0.y + ny * half },
        ],
        z0: bottom,
        z1: top,
      });
    }
    cursor = to;
  }
  add(cursor, Infinity, 0, H);
  return { pieces, glass };
}

/** Pieces and panes for every wall in the plan. */
export function buildWalls(plan: Plan): WallMesh {
  const geometry = wallGeometry(plan);
  const all: WallMesh = { pieces: [], glass: [] };
  for (const g of geometry.values()) {
    const m = wallMesh(g, plan.openings);
    all.pieces.push(...m.pieces);
    all.glass.push(...m.glass);
  }
  return all;
}

export interface Bounds {
  min: Point;
  max: Point;
  /** Tallest wall. */
  height: number;
}

/** The box around every wall, for pointing the camera. Null when there are no walls. */
export function planBounds(plan: Plan): Bounds | null {
  const pts: Point[] = [];
  let height = 0;
  for (const g of wallGeometry(plan).values()) {
    pts.push(...g.outline);
    height = Math.max(height, g.wall.height);
  }
  if (!pts.length) return null;
  return {
    min: { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) },
    max: { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) },
    height,
  };
}
