import { describe, expect, it } from 'vitest';
import { wallGeometry } from '../src/model';
import { History } from '../src/editor/history';
import { hitTest } from '../src/editor/hit';
import { angleDeg, draftEnd, snapAngle, snapPoint } from '../src/editor/snap';
import { plan, rectangle } from './helpers';

const room = plan(rectangle(120, 120));

describe('snapPoint', () => {
  it('prefers wall ends, then walls, then the grid', () => {
    expect(snapPoint(room, { x: 121, y: 2 }, 6)).toEqual({ point: { x: 120, y: 0 }, kind: 'endpoint' });
    expect(snapPoint(room, { x: 60.4, y: 3 }, 6)).toEqual({ point: { x: 60.4, y: 0 }, kind: 'wall', wallId: 's' });
    expect(snapPoint(room, { x: 60.4, y: 40.6 }, 6)).toEqual({ point: { x: 60, y: 41 }, kind: 'grid' });
  });
});

describe('angles', () => {
  it('measures angles counterclockwise from east', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 9);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(270, 9);
  });

  it('snaps to 90-degree steps when close', () => {
    expect(snapAngle(86)).toBe(90);
    expect(snapAngle(355)).toBe(0);
    expect(snapAngle(45)).toBe(45);
  });
});

describe('draftEnd', () => {
  const start = { x: 0, y: 0 };

  it('uses a typed length in the pointer direction, snapped to 90 degrees', () => {
    const end = draftEnd({ start, cursor: { point: { x: 3, y: 50 }, kind: 'grid' }, length: 142.375, snapAngles: true });
    expect(end).toEqual({ x: 0, y: 142.375 });
  });

  it('uses a typed length and angle', () => {
    const end = draftEnd({ start, length: 100, angle: 30, snapAngles: true })!;
    expect(end.x).toBeCloseTo(100 * Math.cos(Math.PI / 6), 9);
    expect(end.y).toBeCloseTo(50, 9);
  });

  it('goes east when a length is typed before the pointer moves', () => {
    expect(draftEnd({ start, length: 144, snapAngles: true })).toEqual({ x: 144, y: 0 });
  });

  it('lands exactly on a wall end under the pointer', () => {
    expect(draftEnd({ start, cursor: { point: { x: 120.5, y: 0.5 }, kind: 'endpoint' }, snapAngles: true })).toEqual({ x: 120.5, y: 0.5 });
  });

  it('rounds the pointer length to the nearest inch along the snapped direction', () => {
    expect(draftEnd({ start, cursor: { point: { x: 47.6, y: 2 }, kind: 'grid' }, snapAngles: true })).toEqual({ x: 48, y: 0 });
  });

  it('has nothing to draw without a direction or length', () => {
    expect(draftEnd({ start, snapAngles: true })).toBeNull();
  });
});

describe('hitTest', () => {
  const p = plan(rectangle(120, 120), {
    openings: [{ id: 'd', wallId: 's', kind: 'door', offset: 40, width: 32, height: 80, sill: 0 }],
  });
  const g = wallGeometry(p);

  it('finds corners first', () => expect(hitTest(p, g, { x: 1, y: 1 }, 3)).toEqual({ kind: 'endpoint', point: { x: 0, y: 0 } }));
  it('then doors and windows', () => expect(hitTest(p, g, { x: 50, y: 1 }, 3)).toEqual({ kind: 'opening', id: 'd' }));
  it('then walls, with the position along the wall', () => {
    expect(hitTest(p, g, { x: 100, y: -1 }, 3)).toEqual({ kind: 'wall', id: 's', at: expect.closeTo(100, 9) });
  });
  it('then nothing', () => expect(hitTest(p, g, { x: 60, y: 60 }, 3)).toBeNull());
});

describe('History', () => {
  it('undoes and redoes, and a new change clears redo', () => {
    const a = plan([]);
    const b = plan(rectangle(10, 10));
    const c = plan(rectangle(20, 20));
    const h = new History(a);
    h.push(b);
    h.push(c);
    expect(h.undo()).toBe(b);
    expect(h.undo()).toBe(a);
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toBe(b);
    h.push(c);
    expect(h.canRedo).toBe(false);
  });
});
