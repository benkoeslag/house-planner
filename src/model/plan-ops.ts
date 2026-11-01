import { JOIN_TOLERANCE, distance, samePoint } from './geometry';
import type { Opening, Plan, Point, Wall } from './types';

/** Makes ids for new plan items. Injected so tests get predictable ids. */
export type IdMaker = (prefix: string) => string;

export const randomIds: IdMaker = (prefix) =>
  `${prefix}-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;

export function counterIds(): IdMaker {
  let n = 0;
  return (prefix) => `${prefix}-${++n}`;
}

export type OpResult = { ok: true; plan: Plan; id?: string } | { ok: false; error: string };

/** Moves `p` onto an existing wall endpoint if one is within the join tolerance, so walls connect exactly. */
function snapToEndpoint(plan: Plan, p: Point): Point {
  for (const w of plan.walls) {
    if (samePoint(w.a, p)) return { ...w.a };
    if (samePoint(w.b, p)) return { ...w.b };
  }
  return { ...p };
}

export function addWall(
  plan: Plan,
  a: Point,
  b: Point,
  props: { thickness: number; height: number },
  ids: IdMaker = randomIds,
): OpResult {
  const sa = snapToEndpoint(plan, a);
  const sb = snapToEndpoint(plan, b);
  if (distance(sa, sb) <= JOIN_TOLERANCE) return { ok: false, error: 'A wall needs some length.' };
  if (!(props.thickness > 0) || !(props.height > 0)) return { ok: false, error: 'Wall thickness and height must be more than 0.' };
  const wall: Wall = { id: ids('wall'), a: sa, b: sb, thickness: props.thickness, height: props.height };
  return { ok: true, plan: { ...plan, walls: [...plan.walls, wall] }, id: wall.id };
}

/** Removes a wall and the openings in it. */
export function removeWall(plan: Plan, wallId: string): OpResult {
  if (!plan.walls.some((w) => w.id === wallId)) return { ok: false, error: 'That wall does not exist.' };
  return {
    ok: true,
    plan: {
      ...plan,
      walls: plan.walls.filter((w) => w.id !== wallId),
      openings: plan.openings.filter((o) => o.wallId !== wallId),
    },
  };
}

/**
 * Splits a wall into two at `at` inches from its `a` end. Openings move with the
 * part they are in; a split through an opening is refused.
 */
export function splitWall(plan: Plan, wallId: string, at: number, ids: IdMaker = randomIds): OpResult {
  const wall = plan.walls.find((w) => w.id === wallId);
  if (!wall) return { ok: false, error: 'That wall does not exist.' };
  const len = distance(wall.a, wall.b);
  if (at <= JOIN_TOLERANCE || at >= len - JOIN_TOLERANCE) return { ok: false, error: 'Split point must be inside the wall.' };
  const own = plan.openings.filter((o) => o.wallId === wallId);
  if (own.some((o) => o.offset < at && o.offset + o.width > at)) {
    return { ok: false, error: 'Cannot split a wall through a door or window.' };
  }
  const k = at / len;
  const mid: Point = { x: wall.a.x + (wall.b.x - wall.a.x) * k, y: wall.a.y + (wall.b.y - wall.a.y) * k };
  const first: Wall = { ...wall, b: mid };
  const second: Wall = { ...wall, id: ids('wall'), a: { ...mid } };
  const openings: Opening[] = plan.openings.map((o) =>
    o.wallId === wallId && o.offset >= at ? { ...o, wallId: second.id, offset: o.offset - at } : o,
  );
  const walls = plan.walls.flatMap((w) => (w.id === wallId ? [first, second] : [w]));
  return { ok: true, plan: { ...plan, walls, openings }, id: second.id };
}

export function addOpening(plan: Plan, opening: Omit<Opening, 'id'>, ids: IdMaker = randomIds): OpResult {
  if (!plan.walls.some((w) => w.id === opening.wallId)) return { ok: false, error: 'That wall does not exist.' };
  const o: Opening = { ...opening, id: ids(opening.kind) };
  return { ok: true, plan: { ...plan, openings: [...plan.openings, o] }, id: o.id };
}

export function removeOpening(plan: Plan, openingId: string): OpResult {
  if (!plan.openings.some((o) => o.id === openingId)) return { ok: false, error: 'That opening does not exist.' };
  return { ok: true, plan: { ...plan, openings: plan.openings.filter((o) => o.id !== openingId) } };
}
