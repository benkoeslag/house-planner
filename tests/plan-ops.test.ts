import { describe, expect, it } from 'vitest';
import { addOpening, addWall, counterIds, emptyPlan, removeWall, splitWall } from '../src/model';
import { plan, wall } from './helpers';

const props = { thickness: 4.5, height: 96 };

describe('plan operations', () => {
  it('adds walls and joins endpoints that land within the tolerance', () => {
    const ids = counterIds();
    const r1 = addWall(emptyPlan(), { x: 0, y: 0 }, { x: 120, y: 0 }, props, ids);
    if (!r1.ok) throw new Error(r1.error);
    const r2 = addWall(r1.plan, { x: 120.004, y: 0.003 }, { x: 120, y: 96 }, props, ids);
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.plan.walls.map((w) => w.id)).toEqual(['wall-1', 'wall-2']);
    expect(r2.plan.walls[1]!.a).toEqual({ x: 120, y: 0 });
  });

  it('refuses zero-length and zero-thickness walls', () => {
    expect(addWall(emptyPlan(), { x: 0, y: 0 }, { x: 0, y: 0 }, props).ok).toBe(false);
    expect(addWall(emptyPlan(), { x: 0, y: 0 }, { x: 10, y: 0 }, { thickness: 0, height: 96 }).ok).toBe(false);
  });

  it('removes a wall together with its openings', () => {
    const start = plan([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 100, 100)]);
    const withDoor = addOpening(start, { wallId: 'a', kind: 'door', offset: 10, width: 30, height: 80, sill: 0 }, counterIds());
    if (!withDoor.ok) throw new Error(withDoor.error);
    const r = removeWall(withDoor.plan, 'a');
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.walls.map((w) => w.id)).toEqual(['b']);
    expect(r.plan.openings).toEqual([]);
  });

  it('splits a wall and moves openings with their part', () => {
    const start = plan([wall('a', 0, 0, 200, 0)], {
      openings: [
        { id: 'o1', wallId: 'a', kind: 'window', offset: 10, width: 30, height: 40, sill: 36 },
        { id: 'o2', wallId: 'a', kind: 'window', offset: 150, width: 30, height: 40, sill: 36 },
      ],
    });
    const r = splitWall(start, 'a', 120, counterIds());
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.walls).toHaveLength(2);
    expect(r.plan.walls[0]!.b).toEqual({ x: 120, y: 0 });
    expect(r.plan.walls[1]!.a).toEqual({ x: 120, y: 0 });
    expect(r.plan.openings[0]).toMatchObject({ wallId: 'a', offset: 10 });
    expect(r.plan.openings[1]).toMatchObject({ wallId: 'wall-1', offset: 30 });
  });

  it('refuses to split through an opening', () => {
    const start = plan([wall('a', 0, 0, 200, 0)], {
      openings: [{ id: 'o1', wallId: 'a', kind: 'door', offset: 100, width: 32, height: 80, sill: 0 }],
    });
    expect(splitWall(start, 'a', 110).ok).toBe(false);
  });
});
