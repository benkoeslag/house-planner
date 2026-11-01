import { describe, expect, it } from 'vitest';
import { detectRooms, signedArea, toSquareFeet } from '../src/model';
import { plan, rectangle, wall } from './helpers';

describe('detectRooms', () => {
  it('finds one room in a square, with the floor area inside the walls', () => {
    const rooms = detectRooms(plan(rectangle(120, 120)));
    expect(rooms).toHaveLength(1);
    const r = rooms[0]!;
    expect(signedArea(r.centerline)).toBeCloseTo(14400, 9);
    expect(r.area).toBeCloseTo(115.5 * 115.5, 9);
    expect(toSquareFeet(r.area)).toBeCloseTo(92.640625, 9);
  });

  it('splits a long room in two with a divider that ends on the outer walls', () => {
    // 240" x 120" room; the divider runs from the middle of the south wall to the middle of the north wall.
    const walls = [...rectangle(240, 120), wall('divider', 120, 0, 120, 120)];
    const rooms = detectRooms(plan(walls));
    expect(rooms).toHaveLength(2);
    for (const r of rooms) expect(r.area).toBeCloseTo(115.5 * 115.5, 9);
  });

  it('ignores a partial wall sticking into a room', () => {
    const walls = [...rectangle(120, 120), wall('stub', 120, 60, 80, 60)];
    const rooms = detectRooms(plan(walls));
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.area).toBeCloseTo(115.5 * 115.5, 9);
  });

  it('handles odd angles: a right triangle', () => {
    const rooms = detectRooms(plan([wall('a', 0, 0, 120, 0), wall('b', 120, 0, 0, 90), wall('c', 0, 90, 0, 0)]));
    expect(rooms).toHaveLength(1);
    expect(signedArea(rooms[0]!.centerline)).toBeCloseTo(5400, 9);
    // The inside outline is the triangle moved in 2 1/4" from every side.
    const r = rooms[0]!.interior;
    expect(r).toHaveLength(3);
    // Inradius of the 90-120-150 triangle is 30; the inset triangle is similar with inradius 27.75.
    expect(rooms[0]!.area).toBeCloseTo(5400 * (27.75 / 30) ** 2, 6);
  });

  it('does not find rooms in an open shape', () => {
    expect(detectRooms(plan([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 100, 100)]))).toEqual([]);
  });

  it('names rooms from labels inside them', () => {
    const walls = [...rectangle(240, 120), wall('divider', 120, 0, 120, 120)];
    const rooms = detectRooms(
      plan(walls, {
        roomLabels: [
          { id: 'l1', name: 'Kitchen', at: { x: 60, y: 60 } },
          { id: 'l2', name: 'Dining', at: { x: 180, y: 60 } },
          { id: 'l3', name: 'Outside', at: { x: 500, y: 60 } },
        ],
      }),
    );
    const names = rooms.map((r) => r.name).sort();
    expect(names).toEqual(['Dining', 'Kitchen']);
  });

  it('keeps the same key for the same room', () => {
    const a = detectRooms(plan(rectangle(120, 120)))[0]!.key;
    const b = detectRooms(plan(rectangle(120, 120).reverse()))[0]!.key;
    expect(a).toBe(b);
  });
});
