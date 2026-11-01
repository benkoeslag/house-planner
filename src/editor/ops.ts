import {
  JOIN_TOLERANCE,
  add,
  along,
  cross,
  distance,
  distanceToSegment,
  normalize,
  pointInPolygon,
  samePoint,
  scale,
  sub,
} from '../model/geometry';
import { addWall, randomIds, splitWall, type IdMaker, type OpResult } from '../model/plan-ops';
import { detectRooms } from '../model/rooms';
import type { DoorSwing, Opening, OpeningKind, Plan, Point, Wall } from '../model/types';
import { wallGeometry, type WallGeometry } from '../model/walls';

const ok = (plan: Plan, id?: string): OpResult => ({ ok: true, plan, ...(id ? { id } : {}) });
const fail = (error: string): OpResult => ({ ok: false, error });

/** Moves every wall end at `from` to `to`, so connected walls stay connected. */
export function moveEndpoint(plan: Plan, from: Point, to: Point): Plan {
  const move = (p: Point): Point => (samePoint(p, from) ? { ...to } : p);
  return { ...plan, walls: plan.walls.map((w) => ({ ...w, a: move(w.a), b: move(w.b) })) };
}

/** Splits whichever wall `p` lies in the middle of, so a wall ending there makes a proper junction. */
function splitAt(plan: Plan, p: Point, ids: IdMaker): OpResult {
  const host = plan.walls.find(
    (w) => distanceToSegment(p, w.a, w.b) <= JOIN_TOLERANCE && !samePoint(p, w.a) && !samePoint(p, w.b),
  );
  if (!host) return ok(plan);
  const t = along(p, host.a, normalize(sub(host.b, host.a)));
  const r = splitWall(plan, host.id, t, ids);
  return r.ok ? r : fail('A wall cannot meet another wall in the middle of a door or window.');
}

/** Where segment p-q crosses segment r-s, strictly inside both. */
function crossing(p: Point, q: Point, r: Point, s: Point): Point | null {
  const d = sub(q, p);
  const e = sub(s, r);
  const denom = cross(d, e);
  if (Math.abs(denom) < 1e-12) return null;
  const t = cross(sub(r, p), e) / denom;
  const u = cross(sub(r, p), d) / denom;
  const lenD = Math.hypot(d.x, d.y);
  const lenE = Math.hypot(e.x, e.y);
  const tol = JOIN_TOLERANCE;
  if (t * lenD <= tol || (1 - t) * lenD <= tol || u * lenE <= tol || (1 - u) * lenE <= tol) return null;
  return add(p, scale(d, t));
}

/**
 * Adds a wall from `a` to `b` and makes proper junctions: ends snap to nearby wall ends, an end
 * landing in the middle of a wall splits that wall, and walls crossing the new one are split at the
 * crossing (the new wall is split there too). Returns the id of the first new wall piece.
 */
export function placeWall(
  plan: Plan,
  a: Point,
  b: Point,
  props: { thickness: number; height: number },
  ids: IdMaker = randomIds,
): OpResult {
  const snapEnd = (p: Point): Point => {
    for (const w of plan.walls) {
      if (samePoint(w.a, p)) return { ...w.a };
      if (samePoint(w.b, p)) return { ...w.b };
    }
    return { ...p };
  };
  const sa = snapEnd(a);
  const sb = snapEnd(b);
  if (distance(sa, sb) <= JOIN_TOLERANCE) return fail('A wall needs some length.');
  if (!(props.thickness > 0) || !(props.height > 0)) return fail('Wall thickness and height must be more than 0.');

  let p = plan;
  for (const end of [sa, sb]) {
    const r = splitAt(p, end, ids);
    if (!r.ok) return r;
    p = r.plan;
  }

  // Points along the new wall where it must be split: crossings and existing wall ends lying on it.
  const u = normalize(sub(sb, sa));
  const len = distance(sa, sb);
  const stops: { t: number; point: Point }[] = [];
  const addStop = (point: Point) => {
    const t = along(point, sa, u);
    if (t > JOIN_TOLERANCE && t < len - JOIN_TOLERANCE && !stops.some((s) => Math.abs(s.t - t) <= JOIN_TOLERANCE)) {
      stops.push({ t, point });
    }
  };
  for (const w of p.walls) {
    for (const end of [w.a, w.b]) if (distanceToSegment(end, sa, sb) <= JOIN_TOLERANCE) addStop(end);
  }
  for (const w of [...p.walls]) {
    const c = crossing(sa, sb, w.a, w.b);
    if (!c) continue;
    const r = splitAt(p, c, ids);
    if (!r.ok) return r;
    p = r.plan;
    addStop(c);
  }
  stops.sort((s1, s2) => s1.t - s2.t);

  const points = [sa, ...stops.map((s) => s.point), sb];
  let firstId: string | undefined;
  for (let i = 0; i + 1 < points.length; i++) {
    const r = addWall(p, points[i]!, points[i + 1]!, props, ids);
    if (!r.ok) return r;
    p = r.plan;
    firstId ??= r.id;
  }
  return ok(p, firstId);
}

/** Changes a wall's length by moving its `b` end along the wall. Walls connected at that end follow. */
export function setWallLength(plan: Plan, wallId: string, length: number): OpResult {
  const w = plan.walls.find((x) => x.id === wallId);
  if (!w) return fail('That wall does not exist.');
  if (!(length > JOIN_TOLERANCE)) return fail('A wall needs some length.');
  const u = normalize(sub(w.b, w.a));
  const to = add(w.a, scale(u, length));
  return ok(moveEndpoint(plan, w.b, to));
}

export function setWallProps(plan: Plan, wallId: string, props: Partial<Pick<Wall, 'thickness' | 'height'>>): OpResult {
  const w = plan.walls.find((x) => x.id === wallId);
  if (!w) return fail('That wall does not exist.');
  if (props.thickness !== undefined && !(props.thickness > 0)) return fail('Thickness must be more than 0.');
  if (props.height !== undefined && !(props.height > 0)) return fail('Height must be more than 0.');
  return ok({ ...plan, walls: plan.walls.map((x) => (x.id === wallId ? { ...x, ...props } : x)) });
}

export const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sill: number }> = {
  door: { width: 32, height: 80, sill: 0 },
  window: { width: 36, height: 48, sill: 36 },
  opening: { width: 36, height: 84, sill: 0 },
};

/**
 * Puts a door, window or opening on a wall, centered on `at` (inches along the wall from `a`),
 * moved as needed to stay clear of the corners.
 */
export function placeOpening(
  plan: Plan,
  wallId: string,
  at: number,
  kind: OpeningKind,
  ids: IdMaker = randomIds,
  geometry: Map<string, WallGeometry> = wallGeometry(plan),
): OpResult {
  const g = geometry.get(wallId);
  if (!g) return fail('That wall does not exist.');
  const size = OPENING_DEFAULTS[kind];
  const clearWidth = g.clear.to - g.clear.from;
  if (clearWidth <= 1) return fail('This wall is too short for an opening.');
  const width = Math.min(size.width, Math.floor(clearWidth));
  const offset = Math.min(Math.max(at - width / 2, g.clear.from), g.clear.to - width);
  const height = Math.min(size.height, g.wall.height - size.sill);
  const o: Opening = {
    id: ids(kind),
    wallId,
    kind,
    offset: Math.round(offset * 16) / 16,
    width,
    height,
    sill: size.sill,
    ...(kind === 'door' ? { swing: { hinge: 'start', side: 'left' } as DoorSwing } : {}),
  };
  return ok({ ...plan, openings: [...plan.openings, o] }, o.id);
}

export function updateOpening(plan: Plan, id: string, patch: Partial<Omit<Opening, 'id' | 'wallId'>>): OpResult {
  if (!plan.openings.some((o) => o.id === id)) return fail('That opening does not exist.');
  for (const k of ['width', 'height'] as const) {
    const v = patch[k];
    if (v !== undefined && !(v > 0)) return fail(`${k === 'width' ? 'Width' : 'Height'} must be more than 0.`);
  }
  if (patch.sill !== undefined && patch.sill < 0) return fail('Sill height cannot be negative.');
  if (patch.offset !== undefined && patch.offset < 0) return fail('The opening cannot start before the wall does.');
  return ok({ ...plan, openings: plan.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}

/** Distance from the inside corner at the wall's `a` end to the near edge of the opening. */
export const fromStartCorner = (g: WallGeometry, o: Opening): number => o.offset - g.clear.from;
/** Distance from the far edge of the opening to the inside corner at the wall's `b` end. */
export const fromEndCorner = (g: WallGeometry, o: Opening): number => g.clear.to - (o.offset + o.width);

/** Names the room containing `at`. An empty name removes the room's name. */
export function setRoomName(plan: Plan, at: Point, name: string, ids: IdMaker = randomIds): OpResult {
  const room = detectRooms(plan).find((r) => pointInPolygon(at, r.centerline));
  if (!room) return fail('Click inside a closed room to name it.');
  const trimmed = name.trim();
  const existing = plan.roomLabels.find((l) => pointInPolygon(l.at, room.centerline));
  if (existing) {
    const roomLabels = trimmed
      ? plan.roomLabels.map((l) => (l.id === existing.id ? { ...l, name: trimmed } : l))
      : plan.roomLabels.filter((l) => l.id !== existing.id);
    return ok({ ...plan, roomLabels }, existing.id);
  }
  if (!trimmed) return ok(plan);
  const label = { id: ids('room'), name: trimmed, at: { ...at } };
  return ok({ ...plan, roomLabels: [...plan.roomLabels, label] }, label.id);
}
