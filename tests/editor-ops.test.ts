import { describe, expect, it } from 'vitest';
import { counterIds, detectRooms, emptyPlan, validateOpenings, wallGeometry, type Plan } from '../src/model';
import {
  fromEndCorner,
  fromStartCorner,
  moveEndpoint,
  placeOpening,
  placeWall,
  setRoomName,
  setWallLength,
  setWallProps,
  updateOpening,
} from '../src/editor/ops';
import { plan, rectangle, wall } from './helpers';

const props = { thickness: 4.5, height: 96 };
const must = (r: { ok: true; plan: Plan } | { ok: false; error: string }): Plan => {
  if (!r.ok) throw new Error(r.error);
  return r.plan;
};

/** Draws a closed room the way the editor does: each wall starts where the last ended. */
function drawRoom(points: [number, number][]): Plan {
  const ids = counterIds();
  let p = emptyPlan();
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[(i + 1) % points.length]!;
    p = must(placeWall(p, { x: ax, y: ay }, { x: bx, y: by }, props, ids));
  }
  return p;
}

describe('placeWall', () => {
  it('draws a closed room with connected corners', () => {
    const p = drawRoom([[0, 0], [144, 0], [144, 168], [0, 168]]);
    expect(p.walls).toHaveLength(4);
    const rooms = detectRooms(p);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.area).toBeCloseTo(139.5 * 163.5, 9);
  });

  it('splits a wall when a new wall ends in the middle of it (T junction)', () => {
    let p = drawRoom([[0, 0], [240, 0], [240, 120], [0, 120]]);
    p = must(placeWall(p, { x: 120, y: 0 }, { x: 120, y: 120 }, props, counterIds()));
    // The south and north walls are each split in two, plus the divider.
    expect(p.walls).toHaveLength(7);
    expect(detectRooms(p)).toHaveLength(2);
  });

  it('splits both walls where they cross', () => {
    const ids = counterIds();
    let p = must(placeWall(emptyPlan(), { x: 0, y: 50 }, { x: 100, y: 50 }, props, ids));
    p = must(placeWall(p, { x: 50, y: 0 }, { x: 50, y: 100 }, props, ids));
    expect(p.walls).toHaveLength(4);
    const ends = p.walls.flatMap((w) => [w.a, w.b]).filter((q) => q.x === 50 && q.y === 50);
    expect(ends).toHaveLength(4);
  });

  it('refuses to end a wall in the middle of a door', () => {
    const p = plan([wall('s', 0, 0, 200, 0)], { openings: [{ id: 'd', wallId: 's', kind: 'door', offset: 80, width: 40, height: 80, sill: 0 }] });
    const r = placeWall(p, { x: 100, y: 0 }, { x: 100, y: 100 }, props);
    expect(r.ok).toBe(false);
  });

  it('refuses a zero-length wall', () => {
    expect(placeWall(emptyPlan(), { x: 1, y: 1 }, { x: 1.001, y: 1 }, props).ok).toBe(false);
  });
});

describe('editing walls', () => {
  it('changes a wall length and drags the connected wall along', () => {
    const p = must(setWallLength(plan(rectangle(120, 120)), 's', 150));
    const s = p.walls.find((w) => w.id === 's')!;
    const e = p.walls.find((w) => w.id === 'e')!;
    expect(s.b).toEqual({ x: 150, y: 0 });
    expect(e.a).toEqual({ x: 150, y: 0 });
    expect(e.b).toEqual({ x: 120, y: 120 });
  });

  it('moves a corner shared by two walls', () => {
    const p = moveEndpoint(plan(rectangle(120, 120)), { x: 120, y: 120 }, { x: 130, y: 140 });
    expect(p.walls.find((w) => w.id === 'e')!.b).toEqual({ x: 130, y: 140 });
    expect(p.walls.find((w) => w.id === 'n')!.a).toEqual({ x: 130, y: 140 });
  });

  it('changes thickness and height, refusing bad values', () => {
    const p = must(setWallProps(plan(rectangle(120, 120)), 's', { thickness: 6.5 }));
    expect(p.walls.find((w) => w.id === 's')!.thickness).toBe(6.5);
    expect(setWallProps(p, 's', { height: 0 }).ok).toBe(false);
    expect(setWallLength(p, 's', 0).ok).toBe(false);
  });
});

describe('openings', () => {
  const room = plan(rectangle(120, 120));

  it('centers a new door where clicked', () => {
    const p = must(placeOpening(room, 's', 60, 'door', counterIds()));
    expect(p.openings[0]).toMatchObject({ kind: 'door', offset: 44, width: 32, height: 80, sill: 0, swing: { hinge: 'start', side: 'left' } });
    expect(validateOpenings(p)).toEqual([]);
  });

  it('keeps a new window clear of the corner when clicked near it', () => {
    const p = must(placeOpening(room, 's', 3, 'window', counterIds()));
    // Inside corner is 2 1/4" along the wall.
    expect(p.openings[0]).toMatchObject({ offset: 2.25, width: 36, sill: 36, height: 48 });
    expect(validateOpenings(p)).toEqual([]);
  });

  it('measures from the inside corners at both ends', () => {
    const p = must(placeOpening(room, 's', 60, 'door', counterIds()));
    const g = wallGeometry(p).get('s')!;
    const o = p.openings[0]!;
    // Inside face runs 2 1/4 to 117 3/4; the door is 44 to 76.
    expect(fromStartCorner(g, o)).toBeCloseTo(41.75, 9);
    expect(fromEndCorner(g, o)).toBeCloseTo(41.75, 9);
  });

  it('updates opening sizes, refusing bad values', () => {
    const p = must(placeOpening(room, 's', 60, 'door', counterIds()));
    const id = p.openings[0]!.id;
    expect(must(updateOpening(p, id, { width: 36 })).openings[0]!.width).toBe(36);
    expect(updateOpening(p, id, { width: 0 }).ok).toBe(false);
    expect(updateOpening(p, id, { sill: -1 }).ok).toBe(false);
  });
});

describe('room names', () => {
  it('names, renames and clears a room', () => {
    const ids = counterIds();
    let p = must(setRoomName(plan(rectangle(120, 120)), { x: 60, y: 60 }, 'Kitchen', ids));
    expect(detectRooms(p)[0]!.name).toBe('Kitchen');
    p = must(setRoomName(p, { x: 30, y: 90 }, 'Pantry', ids));
    expect(p.roomLabels).toHaveLength(1);
    expect(detectRooms(p)[0]!.name).toBe('Pantry');
    p = must(setRoomName(p, { x: 30, y: 90 }, '  ', ids));
    expect(p.roomLabels).toEqual([]);
  });

  it('refuses a name outside any room', () => {
    expect(setRoomName(plan(rectangle(120, 120)), { x: 500, y: 0 }, 'Yard').ok).toBe(false);
  });
});
