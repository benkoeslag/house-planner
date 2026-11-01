import { describe, expect, it } from 'vitest';
import { sampleProject, signedArea, wallGeometry, type Opening } from '../src/model';
import { buildWalls, planBounds, sliceOutline, wallMesh } from '../src/view3d/pieces';
import { plan, rectangle, wall } from './helpers';

const volume = (pieces: { outline: { x: number; y: number }[]; z0: number; z1: number }[]): number =>
  pieces.reduce((a, p) => a + Math.abs(signedArea(p.outline)) * (p.z1 - p.z0), 0);

const opening = (o: Partial<Opening>): Opening => ({ id: 'o', wallId: 's', kind: 'door', offset: 30, width: 32, height: 80, sill: 0, ...o });

describe('wallMesh', () => {
  const walls = rectangle(120, 120);
  const g = wallGeometry(plan(walls)).get('s')!;
  // The south wall outline: (124.5 + 115.5) / 2 * 4.5 = 540 sq in, 96" tall.
  const solid = 540 * 96;

  it('is one full-height piece without openings', () => {
    const m = wallMesh(g, []);
    expect(m.pieces).toHaveLength(1);
    expect(volume(m.pieces)).toBeCloseTo(solid, 6);
  });

  it('cuts a door out: 32" x 4 1/2" x 80" is removed', () => {
    const m = wallMesh(g, [opening({})]);
    expect(volume(m.pieces)).toBeCloseTo(solid - 32 * 4.5 * 80, 6);
    // Left of the door, right of the door, and the header over it. No piece under a door.
    expect(m.pieces).toHaveLength(3);
    expect(m.pieces.filter((p) => p.z0 === 0 && p.z1 === 96)).toHaveLength(2);
    expect(m.pieces.find((p) => p.z0 === 80)).toMatchObject({ z1: 96 });
    expect(m.glass).toEqual([]);
  });

  it('cuts a window out with a piece under it, a piece over it, and a glass pane', () => {
    const m = wallMesh(g, [opening({ kind: 'window', offset: 40, width: 36, height: 48, sill: 36 })]);
    expect(volume(m.pieces)).toBeCloseTo(solid - 36 * 4.5 * 48, 6);
    expect(m.pieces).toHaveLength(4);
    expect(m.glass).toHaveLength(1);
    expect(m.glass[0]).toMatchObject({ openingId: 'o', z0: 36, z1: 84 });
  });

  it('puts the glass pane in the middle of the wall, along the opening', () => {
    const pane = wallMesh(g, [opening({ kind: 'window', offset: 40, width: 36, height: 48, sill: 36 })]).glass[0]!;
    const xs = pane.outline.map((p) => p.x);
    const ys = pane.outline.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(40, 9);
    expect(Math.max(...xs)).toBeCloseTo(76, 9);
    expect(Math.min(...ys)).toBeCloseTo(-0.25, 9);
    expect(Math.max(...ys)).toBeCloseTo(0.25, 9);
  });

  it('handles an opening that starts at the inside corner', () => {
    const m = wallMesh(g, [opening({ offset: 2.25 })]);
    expect(volume(m.pieces)).toBeCloseTo(solid - 32 * 4.5 * 80, 6);
  });

  it('handles two openings in one wall', () => {
    const m = wallMesh(g, [opening({ id: 'a', offset: 10, width: 30 }), opening({ id: 'b', kind: 'window', offset: 60, width: 30, height: 40, sill: 40 })]);
    expect(volume(m.pieces)).toBeCloseTo(solid - 30 * 4.5 * 80 - 30 * 4.5 * 40, 6);
  });

  it('does not double-cut overlapping openings', () => {
    const m = wallMesh(g, [opening({ id: 'a', offset: 20, width: 40 }), opening({ id: 'b', offset: 40, width: 40 })]);
    // Together they remove 20..80 (60"), the second one only where it extends past the first.
    expect(volume(m.pieces)).toBeCloseTo(solid - 60 * 4.5 * 80, 6);
  });

  it('ignores openings on other walls', () => {
    expect(volume(wallMesh(g, [opening({ wallId: 'e' })]).pieces)).toBeCloseTo(solid, 6);
  });
});

describe('sliceOutline', () => {
  it('keeps the mitered ends', () => {
    const g = wallGeometry(plan(rectangle(120, 120))).get('s')!;
    const left = sliceOutline(g, -Infinity, 60);
    expect(signedArea(left)).toBeGreaterThan(0);
    // Area from the outside corner (-2.25) up to 60: the outside face starts at -2.25, the inside at 2.25.
    // Trapezoid with parallel sides 62.25 (outside face) and 57.75 (inside face), 4.5 apart.
    expect(signedArea(left)).toBeCloseTo(((62.25 + 57.75) / 2) * 4.5, 9);
  });

  it('returns nothing for a slice outside the wall', () => {
    const g = wallGeometry(plan(rectangle(120, 120))).get('s')!;
    expect(sliceOutline(g, 200, 300)).toEqual([]);
  });
});

describe('buildWalls and planBounds', () => {
  it('builds the sample room: four walls cut for a door and a window', () => {
    const { plan: p } = sampleProject();
    const m = buildWalls(p);
    // 4 solid walls cut into 3 pieces (door wall), 4 pieces (window wall) and 1 each for the others.
    expect(m.pieces).toHaveLength(3 + 4 + 1 + 1);
    expect(m.glass).toHaveLength(1);
  });

  it('reports the box around the walls, including their thickness', () => {
    const b = planBounds(sampleProject().plan)!;
    expect(b.min).toEqual({ x: expect.closeTo(-2.25, 9), y: expect.closeTo(-2.25, 9) });
    expect(b.max).toEqual({ x: expect.closeTo(146.25, 9), y: expect.closeTo(170.25, 9) });
    expect(b.height).toBe(96);
  });

  it('has no bounds for an empty plan', () => {
    expect(planBounds({ walls: [], openings: [], roomLabels: [] })).toBeNull();
    expect(buildWalls({ walls: [wall('z', 1, 1, 1, 1)], openings: [], roomLabels: [] }).pieces).toEqual([]);
  });
});
