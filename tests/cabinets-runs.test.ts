import { describe, expect, it } from 'vitest';
import { runGeometry, type CabinetRun, type RunGeometry } from '../src/cabinets';
import type { Opening, Plan, Wall } from '../src/model/types';

const T = 4.5;
const h = T / 2;
const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: T, height: 96 });
/** An L with the inside corner at (0,0): the south wall runs east 156″, the west wall runs north 128″. */
const L = (): Plan => ({ walls: [wall('s', -h, -h, 156, -h), wall('w', -h, -h, -h, 128)], openings: [], roomLabels: [] });
const leftRun: CabinetRun = { id: 'L', kind: 'wall', name: 'Left wall', wallIds: ['s'], face: 'left', from: 'a' };
const rightRun: CabinetRun = { id: 'R', kind: 'wall', name: 'Right wall', wallIds: ['w'], face: 'right', from: 'a' };
const ok = (r: ReturnType<typeof runGeometry>): RunGeometry => {
  if (!r.ok) throw new Error(r.reason);
  return r;
};
const close = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 9);
  expect(p.y).toBeCloseTo(y, 9);
};

describe('run geometry', () => {
  it('measures each wall of an L from the inside corner, like the prototype', () => {
    const l = ok(runGeometry(L(), leftRun));
    close(l.origin, 0, 0);
    close(l.u, 1, 0);
    close(l.n, 0, 1);
    expect(l.length).toBeCloseTo(156, 9);
    // facing the left wall, positions increase to the left (the corner is on your right)
    expect(l.rightward).toBe(false);
    const r = ok(runGeometry(L(), rightRun));
    close(r.origin, 0, 0);
    close(r.u, 0, 1);
    close(r.n, 1, 0);
    expect(r.length).toBeCloseTo(128, 9);
    expect(r.rightward).toBe(true);
  });

  it('measures from the other end when asked', () => {
    const g = ok(runGeometry(L(), { ...leftRun, from: 'b' }));
    close(g.origin, 156, 0);
    close(g.u, -1, 0);
    expect(g.length).toBeCloseTo(156, 9);
    expect(g.rightward).toBe(true);
  });

  it('maps windows and doors to positions along the run', () => {
    const plan = L();
    const win: Opening = { id: 'win', wallId: 'w', kind: 'window', offset: 69.625 + h, width: 29.875, height: 40, sill: 42 };
    plan.openings.push(win);
    const g = ok(runGeometry(plan, rightRun));
    expect(g.openings).toHaveLength(1);
    expect(g.openings[0]!.a).toBeCloseTo(69.625, 9);
    expect(g.openings[0]!.b).toBeCloseTo(99.5, 9);
    expect(g.openings[0]!.sill).toBe(42);
    const back = ok(runGeometry(plan, { ...rightRun, from: 'b' }));
    expect(back.openings[0]!.a).toBeCloseTo(128 - 99.5, 9);
  });

  it('spans a wall split in two, even with the second piece drawn backward', () => {
    const plan: Plan = { walls: [wall('s1', -h, -h, 60, -h), wall('s2', 156, -h, 60, -h), wall('w', -h, -h, -h, 128)], openings: [], roomLabels: [] };
    plan.openings.push({ id: 'd', wallId: 's2', kind: 'door', offset: 10, width: 30, height: 80, sill: 0 });
    const g = ok(runGeometry(plan, { ...leftRun, wallIds: ['s1'] }));
    expect(g.wallIds).toEqual(['s1', 's2']);
    expect(g.length).toBeCloseTo(156, 9);
    // the door is 10″ from s2's a (x = 156), so it spans x 116 to 146
    expect(g.openings[0]!.a).toBeCloseTo(116, 9);
    expect(g.openings[0]!.b).toBeCloseTo(146, 9);
  });

  it('keeps going past a wall meeting the back of the face, and stops at one meeting the face', () => {
    const behind: Plan = { walls: [wall('s1', -h, -h, 60, -h), wall('s2', 60, -h, 156, -h), wall('w', -h, -h, -h, 128), wall('out', 60, -h, 60, -50)], openings: [], roomLabels: [] };
    expect(ok(runGeometry(behind, { ...leftRun, wallIds: ['s1'] })).length).toBeCloseTo(156, 9);
    const inFront: Plan = { ...behind, walls: [...behind.walls.slice(0, 3), wall('part', 60, -h, 60, 80)] };
    const g = ok(runGeometry(inFront, { ...leftRun, wallIds: ['s1'] }));
    expect(g.wallIds).toEqual(['s1']);
    expect(g.length).toBeCloseTo(60 - h, 9);
    // a wall ending against the middle of the face (not split) also ends it
    const unsplit: Plan = { walls: [wall('s', -h, -h, 156, -h), wall('w', -h, -h, -h, 128), wall('part', 60, -h, 60, 80)], openings: [], roomLabels: [] };
    expect(ok(runGeometry(unsplit, leftRun)).length).toBeCloseTo(60 - h, 9);
  });

  it('does not join walls of a different thickness', () => {
    const plan: Plan = { walls: [wall('s1', -h, -h, 60, -h), { ...wall('s2', 60, -h, 156, -h), thickness: 6 }, wall('w', -h, -h, -h, 128)], openings: [], roomLabels: [] };
    expect(ok(runGeometry(plan, { ...leftRun, wallIds: ['s1'] })).wallIds).toEqual(['s1']);
  });

  it('reports a run whose walls are gone', () => {
    const r = runGeometry(L(), { ...leftRun, wallIds: ['nope'] });
    expect(r.ok).toBe(false);
  });
});
