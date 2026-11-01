/**
 * Where a cabinet run sits on the plan: the straight wall face it follows, its start corner, its
 * direction, the side of the room it faces, its usable length, and the doors and windows along it.
 * Positions along a run are inches from its start face corner, as the prototype measures "from the
 * corner".
 */
import { add, along, dot, JOIN_TOLERANCE, normalize, perpLeft, samePoint, scale, sub } from '../model/geometry';
import type { OpeningKind, Plan, Point, Wall } from '../model/types';
import { wallGeometry, type WallGeometry } from '../model/walls';
import type { CabinetRun } from './project';

export interface RunOpening {
  id: string;
  kind: OpeningKind;
  /** Start and end along the run. */
  a: number;
  b: number;
  sill: number;
  height: number;
}

export interface RunGeometry {
  ok: true;
  run: CabinetRun;
  /** Every wall the run spans, in order along the face from the anchor wall's `a` side. */
  wallIds: string[];
  /** The start face corner (position 0). */
  origin: Point;
  /** Unit direction of increasing position. */
  u: Point;
  /** Unit normal from the face into the room. */
  n: Point;
  /** Positions increase to the right as you face the wall (like the prototype's right wall). */
  rightward: boolean;
  /** Usable length of the face. */
  length: number;
  openings: RunOpening[];
}

export type RunResult = RunGeometry | { ok: false; run: CabinetRun; reason: string };

const COLLINEAR = 1e-6;

/** Direction of `w` pointing away from its end at `p`. */
function awayFrom(w: Wall, p: Point): Point {
  return samePoint(w.a, p) ? normalize(sub(w.b, w.a)) : normalize(sub(w.a, w.b));
}
function otherEnd(w: Wall, p: Point): Point {
  return samePoint(w.a, p) ? w.b : w.a;
}

export function runGeometry(plan: Pick<Plan, 'walls' | 'openings'>, run: CabinetRun, geometry: Map<string, WallGeometry> = wallGeometry(plan)): RunResult {
  const anchorId = run.wallIds.find((id) => geometry.has(id));
  if (!anchorId) return { ok: false, run, reason: 'The wall this run was on is gone.' };
  const anchor = geometry.get(anchorId)!;
  const u0 = anchor.dir;
  const n = run.face === 'left' ? perpLeft(u0) : scale(perpLeft(u0), -1);
  const walls = [...geometry.values()].map((g) => g.wall);

  // Walk the straight face both ways from the anchor wall.
  const chain: Wall[] = [anchor.wall];
  const extend = (from: Point, dir: Point, push: (w: Wall) => void) => {
    let at = from;
    let prev = anchor.wall;
    for (;;) {
      const here = walls.filter((w) => w.id !== prev.id && (samePoint(w.a, at) || samePoint(w.b, at)));
      // Another wall meeting the face side at this joint ends the face.
      if (here.some((w) => dot(awayFrom(w, at), n) > COLLINEAR)) return;
      const next = here.find((w) => dot(awayFrom(w, at), dir) > 1 - COLLINEAR && Math.abs(w.thickness - anchor.wall.thickness) <= 1e-9 && !chain.includes(w));
      if (!next) return;
      push(next);
      prev = next;
      at = otherEnd(next, at);
    }
  };
  extend(anchor.wall.b, u0, (w) => chain.push(w));
  extend(anchor.wall.a, scale(u0, -1), (w) => chain.unshift(w));

  // Face extent along u0, measured from the anchor's `a`.
  const O = anchor.wall.a;
  let sMin = Infinity;
  let sMax = -Infinity;
  const cuts: number[] = [];
  for (const w of chain) {
    const g = geometry.get(w.id)!;
    const same = dot(g.dir, u0) > 0;
    const side = same ? run.face : run.face === 'left' ? 'right' : 'left';
    const span = g.faces[side];
    for (const t of [span.from, span.to]) {
      const s = along(add(w.a, scale(g.dir, t)), O, u0);
      sMin = Math.min(sMin, s);
      sMax = Math.max(sMax, s);
    }
    // A wall ending against the middle of the face also ends the face.
    for (const ab of g.abutments) {
      if (ab.side !== side) continue;
      for (const t of [ab.from, ab.to]) cuts.push(along(add(w.a, scale(g.dir, t)), O, u0));
    }
  }
  const fromA = run.from === 'a';
  const u = fromA ? u0 : scale(u0, -1);
  const sStart = fromA ? sMin : sMax;
  // Position of an along-u0 coordinate on the run.
  const pos = (s: number) => (fromA ? s - sMin : sMax - s);
  let length = sMax - sMin;
  for (const c of cuts) {
    const p = pos(c);
    if (p > JOIN_TOLERANCE && p < length) length = p;
  }
  const origin = add(add(O, scale(u0, sStart)), scale(n, anchor.wall.thickness / 2));
  const rightward = dot(u, { x: -n.y, y: n.x }) > 0;

  const ids = new Set(chain.map((w) => w.id));
  const openings: RunOpening[] = plan.openings
    .filter((o) => ids.has(o.wallId))
    .map((o) => {
      const g = geometry.get(o.wallId)!;
      const p1 = pos(along(add(g.wall.a, scale(g.dir, o.offset)), O, u0));
      const p2 = pos(along(add(g.wall.a, scale(g.dir, o.offset + o.width)), O, u0));
      return { id: o.id, kind: o.kind, a: Math.min(p1, p2), b: Math.max(p1, p2), sill: o.sill, height: o.height };
    })
    .sort((p, q) => p.a - q.a);

  return { ok: true, run, wallIds: chain.map((w) => w.id), origin, u, n, rightward, length, openings };
}

/** A point on the run: `t` along it and `d` out from the face into the room. */
export const runPoint = (g: RunGeometry, t: number, d = 0): Point => add(add(g.origin, scale(g.u, t)), scale(g.n, d));
