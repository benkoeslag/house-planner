import { describe, expect, it } from 'vitest';
import {
  addDiagonal,
  addItem,
  defaultInput,
  emptyCabinets,
  moveItem,
  planCabinets,
  removeItem,
  removeRun,
  resolveCorners,
  runForFace,
  runGeometry,
  setCornerOwner,
  updateItem,
  updateRun,
  type CabinetOp,
  type CabinetsData,
  type CabinetType,
  type RunGeometry,
} from '../src/cabinets';
import { counterIds } from '../src/model/plan-ops';
import { parseProject, serializeProject } from '../src/model';
import type { Plan, Wall } from '../src/model/types';
import { scenario, scenarioProject } from './cabinet-scenarios';

const T = 4.5;
const h = T / 2;
const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: T, height: 96 });
/** A closed 156 x 128 room (inside faces), corner at (0,0): s (south), e, n, w. */
const room = (): Plan => ({
  walls: [wall('s', -h, -h, 156 + h, -h), wall('e', 156 + h, -h, 156 + h, 128 + h), wall('n', 156 + h, 128 + h, -h, 128 + h), wall('w', -h, 128 + h, -h, -h)],
  openings: [],
  roomLabels: [],
});
/** The result of an edit that must succeed: its cabinets and the id it made (if any). */
const done = (r: CabinetOp): { data: CabinetsData; id: string } => {
  if (!r.ok) throw new Error(r.error);
  return { data: r.data, id: r.id ?? '' };
};
const valid = (plan: Plan, data: CabinetsData) => {
  const r = parseProject(serializeProject({ name: 'x', settings: { wallThickness: T, wallHeight: 96 }, plan, cabinets: data }));
  if (!r.ok) throw new Error(r.error);
  expect(r.project.cabinets).toEqual(data);
  expect(() => planCabinets(plan, data)).not.toThrow();
};
const geom = (plan: Plan, data: CabinetsData, id: string): RunGeometry => {
  const g = runGeometry(plan, data.runs.find((r) => r.id === id)!);
  if (!g.ok) throw new Error(g.reason);
  return g;
};

describe('choosing a run for a wall face', () => {
  it('starts a new run at an inside corner, and the next run at the same corner', () => {
    const plan = room();
    const ids = counterIds();
    // the inside of the south wall is its left face (it runs east); click near the east end
    const r1 = runForFace(plan, emptyCabinets(), 's', 'left', { x: 150, y: 5 }, ids);
    const { data: d1, id: id1 } = done(r1);
    expect(r1.ok && r1.created).toBe(true);
    // both ends are inside corners, so the nearer end wins: the east end
    const g1 = geom(plan, d1, id1);
    expect(g1.origin.x).toBeCloseTo(156, 9);
    // the east wall's inside face (its left), clicked near its north end, still starts at the shared corner
    const { data: d2, id: id2 } = done(runForFace(plan, d1, 'e', 'left', { x: 150, y: 120 }, ids));
    const g2 = geom(plan, d2, id2);
    expect(g2.origin.x).toBeCloseTo(156, 9);
    expect(g2.origin.y).toBeCloseTo(0, 9);
    expect(resolveCorners(d2.corners, [g1, g2]).corners).toHaveLength(1);
    expect(d2.runs.map((r) => r.name)).toEqual(['Run 1', 'Run 2']);
  });

  it('finds the existing run again, from any wall piece of its face', () => {
    const plan = room();
    const d1 = done(runForFace(plan, emptyCabinets(), 's', 'left', { x: 10, y: 5 }, counterIds())).data;
    const again = runForFace(plan, d1, 's', 'left', { x: 100, y: 5 });
    expect(again.ok && again.created).toBe(false);
    expect(again.ok && again.data).toBe(d1);
    // the outside face is a different run
    expect(done(runForFace(plan, d1, 's', 'right', { x: 10, y: -10 }, counterIds())).data.runs).toHaveLength(2);
  });

  it('uses the end nearer the click on a free-standing wall', () => {
    const plan: Plan = { walls: [wall('x', 0, 0, 100, 0)], openings: [], roomLabels: [] };
    const { data: d, id } = done(runForFace(plan, emptyCabinets(), 'x', 'left', { x: 90, y: 5 }, counterIds()));
    expect(geom(plan, d, id).origin.x).toBeCloseTo(100, 9);
  });

  it('renames and flips a run', () => {
    const plan = room();
    const first = done(runForFace(plan, emptyCabinets(), 's', 'left', { x: 150, y: 5 }, counterIds()));
    let d = first.data;
    const id = first.id;
    d = done(updateRun(d, id, { name: 'Sink wall', from: 'a' })).data;
    expect(d.runs[0]).toMatchObject({ name: 'Sink wall', from: 'a' });
    expect(geom(plan, d, id).origin.x).toBeCloseTo(0, 9);
    d = done(updateRun(d, id, { name: '  ' })).data;
    expect(d.runs[0]!.name).toBeUndefined();
  });
});

describe('editing cabinets', () => {
  const start = () => {
    const { plan, data } = scenarioProject(scenario('starter kitchen'));
    return { plan, data };
  };

  it('adds at the end of the list with the prototype defaults', () => {
    const { data } = start();
    const { data: d, id } = done(addItem(data, { runId: 'R', input: defaultInput('base-drawers'), position: { mode: 'flow' }, snap: 'auto' }, counterIds()));
    expect(d.items.at(-1)).toMatchObject({ id, runId: 'R', input: { type: 'base-drawers', width: 18, drawers: 3, topFront: 6 } });
    expect(defaultInput('stove')).toEqual({ type: 'gap', width: 30, gapKind: 'stove', name: 'Stove' });
  });

  it('moves within its run and row only', () => {
    const { data } = start();
    // B5 (i4) up swaps with B4 (i3); B4 up stays (first base on the right wall)
    const up = done(moveItem(data, 'i4', -1)).data;
    expect(up.items.slice(3, 5).map((i) => i.id)).toEqual(['i4', 'i3']);
    expect(done(moveItem(up, 'i4', -1)).data.items).toEqual(up.items);
    // U5 (i12) up skips the left wall's uppers and stops (first upper on the right wall)
    expect(done(moveItem(data, 'i12', -1)).data.items).toEqual(data.items);
    // B6 (i5) down skips over nothing on another run and swaps with O1 (i6), a base-row item on the same run
    expect(done(moveItem(data, 'i5', 1)).data.items.slice(5, 7).map((i) => i.id)).toEqual(['i6', 'i5']);
  });

  it('removing a cabinet puts line-ups with it back in list order', () => {
    const { data } = start();
    const lined = done(updateItem(data, 'i12', { position: { mode: 'align', itemId: 'i3', side: 'left' } })).data;
    const d = done(removeItem(lined, 'i3')).data;
    expect(d.items.find((i) => i.id === 'i12')!.position).toEqual({ mode: 'flow' });
  });

  it('refuses a line-up with itself or with a cabinet that does not exist', () => {
    const { data } = start();
    expect(updateItem(data, 'i12', { position: { mode: 'align', itemId: 'i12', side: 'left' } }).ok).toBe(false);
    expect(updateItem(data, 'i12', { position: { mode: 'align', itemId: 'ghost', side: 'left' } }).ok).toBe(false);
  });

  it('removing a run removes its cabinets and corner, and the diagonal upper in it', () => {
    const { plan, data } = start();
    const d = done(removeRun(data, 'L')).data;
    expect(d.runs.map((r) => r.id)).toEqual(['R']);
    expect(d.corners).toEqual([]);
    expect(d.items.some((i) => i.cornerId)).toBe(false);
    valid(plan, d);
  });

  it('sets the corner owner and adds one diagonal upper, saving a found corner', () => {
    const plan = room();
    const ids = counterIds();
    let d = done(runForFace(plan, emptyCabinets(), 's', 'left', { x: 10, y: 5 }, ids)).data;
    d = done(runForFace(plan, d, 'w', 'left', { x: 5, y: 10 }, ids)).data;
    const corner = resolveCorners(d.corners, d.runs.map((r) => geom(plan, d, r.id))).corners[0]!;
    expect(corner.saved).toBe(false);
    d = done(setCornerOwner(d, corner, corner.runIds[0])).data;
    expect(d.corners).toEqual([{ id: corner.id, runIds: corner.runIds, owner: corner.runIds[0] }]);
    d = done(addDiagonal(d, corner, ids)).data;
    expect(d.items.at(-1)).toMatchObject({ cornerId: corner.id, input: { type: 'upper-diag', width: 24 } });
    expect(addDiagonal(d, corner, ids).ok).toBe(false);
    valid(plan, d);
  });
});

describe('random edits always leave a project that saves and opens', () => {
  it('holds over many random edit sequences', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    const types: (CabinetType | 'stove')[] = ['base-doors', 'base-drawers', 'base-drawer-door', 'base-blind', 'upper', 'upper-blind', 'shelf', 'tall', 'gap', 'panel', 'stove'];
    const ids = counterIds();
    for (let round = 0; round < 25; round++) {
      const { plan, data: start } = scenarioProject(scenario('starter kitchen'));
      plan.walls.push(wall('x', 156, -h, 156, 80));
      let d = start;
      for (let step = 0; step < 40; step++) {
        const items = d.items;
        const op = Math.floor(rnd() * 9);
        let r: CabinetOp;
        if (op === 0) r = runForFace(plan, d, pick(['s', 'w', 'x']), pick(['left', 'right'] as const), { x: rnd() * 150, y: rnd() * 120 }, ids);
        else if (op === 1 && d.runs.length) r = addItem(d, { runId: pick(d.runs).id, input: defaultInput(pick(types)), position: { mode: 'flow' }, snap: 'auto' }, ids);
        else if (op === 2 && items.length) {
          const it = pick(items);
          r = updateItem(d, it.id, { input: { ...it.input, width: pick([0, -3, 12.5, 24, 36, 1e3]) }, snap: pick(['auto', 'left', 'right'] as const) });
        } else if (op === 3 && items.length) {
          const it = pick(items);
          const pos = pick([
            { mode: 'flow' as const },
            { mode: 'follow' as const },
            { mode: 'at' as const, at: rnd() * 150 - 10 },
            { mode: 'opening' as const, openingId: pick(['win', 'gone']) },
            { mode: 'align' as const, itemId: pick(items).id, side: pick(['left', 'right', 'center'] as const) },
          ]);
          r = updateItem(d, it.id, { position: pos });
        } else if (op === 4 && items.length) r = moveItem(d, pick(items).id, pick([-1, 1] as const));
        else if (op === 5 && items.length) r = removeItem(d, pick(items).id);
        else if (op === 6 && d.runs.length && rnd() < 0.3) r = removeRun(d, pick(d.runs).id);
        else if (op === 7 || op === 8) {
          const gs = d.runs.map((x) => runGeometry(plan, x)).filter((g): g is RunGeometry => g.ok);
          const c = resolveCorners(d.corners, gs).corners[0];
          if (!c) continue;
          r = op === 7 ? setCornerOwner(d, c, pick(c.runIds)) : addDiagonal(d, c, ids);
        } else continue;
        if (r.ok) d = r.data;
        valid(plan, d);
      }
    }
  });
});
