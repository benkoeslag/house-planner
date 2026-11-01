import { describe, expect, it } from 'vitest';
import { signedArea, wallGeometry } from '../src/model';
import { expectPoint, plan, rectangle, wall } from './helpers';

describe('wallGeometry: square room', () => {
  // 120" x 120" on the wall centerlines, 4 1/2" walls (2 1/4" each side of the centerline).
  const g = wallGeometry(plan(rectangle(120, 120)));
  const south = g.get('s')!;

  it('mitres the corners: inside corners 2 1/4" in, outside corners 2 1/4" out', () => {
    expectPoint(south.start.left, 2.25, 2.25);
    expectPoint(south.start.right, -2.25, -2.25);
    expectPoint(south.end.right, 117.75, 2.25);
    expectPoint(south.end.left, 122.25, -2.25);
  });

  it('gives a counterclockwise footprint', () => {
    expect(south.outline).toHaveLength(4);
    expect(signedArea(south.outline)).toBeGreaterThan(0);
    // Trapezoid: outside face 124.5 long, inside face 115.5 long, 4.5 thick.
    expect(signedArea(south.outline)).toBeCloseTo(((124.5 + 115.5) / 2) * 4.5, 9);
  });

  it('reports the face lengths and the clear span for openings', () => {
    expect(south.length).toBe(120);
    expect(south.faces.left.from).toBeCloseTo(2.25, 9);
    expect(south.faces.left.to).toBeCloseTo(117.75, 9);
    expect(south.faces.right.from).toBeCloseTo(-2.25, 9);
    expect(south.faces.right.to).toBeCloseTo(122.25, 9);
    expect(south.clear).toEqual({ from: expect.closeTo(2.25, 9), to: expect.closeTo(117.75, 9) });
  });

  it('is the same at every corner', () => {
    for (const id of ['s', 'e', 'n', 'w']) {
      expect(g.get(id)!.clear.to - g.get(id)!.clear.from).toBeCloseTo(115.5, 9);
    }
  });
});

describe('wallGeometry: different thicknesses at a corner', () => {
  it('meets the inside faces of both walls', () => {
    // 6" south wall meets a 4" west wall at the origin.
    const g = wallGeometry(plan([wall('s', 0, 0, 100, 0, 6), wall('w', 0, 100, 0, 0, 4)]));
    expectPoint(g.get('s')!.start.left, 2, 3);
    expectPoint(g.get('s')!.start.right, -2, -3);
    expectPoint(g.get('w')!.end.right, 2, 3);
  });
});

describe('wallGeometry: odd angles', () => {
  it('splits a 120-degree corner along the bisector', () => {
    const h = 2.25;
    const c = Math.cos((2 * Math.PI) / 3);
    const s = Math.sin((2 * Math.PI) / 3);
    const g = wallGeometry(plan([wall('a', 0, 0, 100, 0), wall('b', 0, 0, 100 * c, 100 * s)]));
    // Inside corner sits h above the first wall, at h / tan(60 degrees) along it.
    expectPoint(g.get('a')!.start.left, h / Math.tan(Math.PI / 3), h);
  });

  it('cuts very sharp corners square instead of making long spikes', () => {
    const angle = (10 * Math.PI) / 180;
    const g = wallGeometry(plan([wall('a', 0, 0, 100, 0), wall('b', 0, 0, 100 * Math.cos(angle), 100 * Math.sin(angle))]));
    const a = g.get('a')!;
    // Within the limit of 6 half-thicknesses of the junction.
    for (const p of [a.start.left, a.start.right]) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(6 * 2.25 + 1e-9);
  });

  it('keeps straight runs of different thickness square', () => {
    const g = wallGeometry(plan([wall('a', 0, 0, 50, 0, 6), wall('b', 50, 0, 100, 0, 4)]));
    expectPoint(g.get('a')!.end.left, 50, -3);
    expectPoint(g.get('a')!.end.right, 50, 3);
    expectPoint(g.get('b')!.start.left, 50, 2);
  });
});

describe('wallGeometry: T junction', () => {
  // A divider starting at the middle of a long wall.
  const g = wallGeometry(plan([wall('long', 0, 0, 240, 0), wall('divider', 120, 0, 120, 100)]));

  it('ends the divider on the face of the long wall', () => {
    const d = g.get('divider')!;
    expectPoint(d.start.left, 117.75, 2.25);
    expectPoint(d.start.right, 122.25, 2.25);
  });

  it('records where the divider meets the long wall', () => {
    expect(g.get('long')!.abutments).toEqual([
      { wallId: 'divider', side: 'left', from: expect.closeTo(117.75, 9), to: expect.closeTo(122.25, 9) },
    ]);
  });

  it('leaves the long wall straight with free ends cut square', () => {
    const l = g.get('long')!;
    expectPoint(l.start.left, 0, 2.25);
    expectPoint(l.end.right, 240, 2.25);
  });
});

describe('wallGeometry: input checks', () => {
  it('ignores zero-length walls', () => {
    const g = wallGeometry(plan([wall('zero', 5, 5, 5, 5), wall('ok', 0, 0, 10, 0)]));
    expect([...g.keys()]).toEqual(['ok']);
  });
});
