// Golden tests for sheet layouts, the optimizer, cut steps and costs: the engine must reproduce
// the prototype. Fixtures: tests/fixtures/prototype-sheets.json (scripts/prototype-fixtures.mjs).
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/prototype-sheets.json';
import { settle } from './helpers';
import {
  acceptOptimized,
  areaLowerBound,
  buildCutList,
  cabinetSettings,
  layoutSignature,
  materialInfo,
  nestQuick,
  optimizeJob,
  optimizerJobs,
  quickLayouts,
  toSheetLayouts,
  type CabinetSettings,
  type CutGroup,
  type Material,
  type OptimizerJob,
  type Part,
} from '../src/cabinets';

type Scenario = (typeof fixtures.scenarios)[number];
const settingsOf = (sc: { settings?: object }) => cabinetSettings(sc.settings as Partial<CabinetSettings>);
const MATS = ['box', 'back', 'drw'] as Material[];

describe('quick sheet layouts match the prototype', () => {
  for (const sc of fixtures.scenarios as Scenario[]) {
    for (const m of MATS) {
      it(`${sc.name}: ${m}`, () => {
        const s = settingsOf(sc);
        const q = (sc.quick as Record<string, Scenario['quick']['box']>)[m]!;
        const groups = sc.groups.filter((g) => g.mat === m);
        const got = nestQuick(groups, materialInfo(m, s), s);
        expect(settle(got.mat)).toEqual(settle(q.mat));
        expect(settle(got.sheets)).toEqual(settle(q.sheets));
        expect(got.failed).toEqual(q.failed);
      });
    }
  }

  it('parts that do not fit, a part that only fits turned, and small parts', () => {
    const s = cabinetSettings();
    const part = (name: string, L: number, W: number, rot: boolean, qty = 1): Part => ({ cab: 'P1', name, mat: 'box', L, W, qty, band: { l: 0, w: 0 }, rot, note: '' });
    const groups = buildCutList([part('Too long', 100, 10, false), part('Too wide', 50, 50, true), part('Turn me', 20, 60, true), part('Strip', 90, 3, false, 3), part('Tiny', 4, 2, false, 5)], s);
    expect(groups.map((g) => ({ num: g.num, name: g.name, mat: g.mat, L: g.L, W: g.W, qty: g.qty, rot: g.rot }))).toEqual(fixtures.synthetic.groups);
    const { nests, warns } = quickLayouts(groups, s);
    expect(settle(nests.box!.sheets)).toEqual(settle(fixtures.synthetic.nest.sheets));
    expect(nests.box!.failed).toEqual(fixtures.synthetic.nest.failed);
    expect(warns).toEqual(fixtures.synthetic.warns);
  });
});

describe('optimizer matches the prototype (40 fixed tries plus 1 random)', () => {
  for (const sc of fixtures.scenarios as Scenario[]) {
    for (const m of MATS) {
      it(`${sc.name}: ${m}`, () => {
        const s = settingsOf(sc);
        const o = (sc.optimized as Record<string, Scenario['optimized']['box']>)[m]!;
        const q = (sc.quick as Record<string, Scenario['quick']['box']>)[m]!;
        // the job is built from the cut list and quick layout as the prototype does
        const groups = sc.groups.filter((g) => g.mat === m) as unknown as CutGroup[];
        const jobs = optimizerJobs(groups, { [m]: { sheets: q.sheets, failed: [], mat: q.mat } } as never, s);
        expect(jobs).toEqual([o.job]);
        const got = optimizeJob(jobs[0]!, { budgetMs: -1 });
        expect(got.iters).toBe(41);
        expect(settle(got.sheets)).toEqual(settle(o.raw));
        expect(settle(toSheetLayouts(got.sheets, q.mat))).toEqual(settle(o.sheets));
        expect(layoutSignature(groups, q.mat, s)).toBe(q.signature);
      });
    }
  }
});

describe('optimizer behavior', () => {
  const job = fixtures.scenarios[0]!.optimized.box.job as OptimizerJob;

  it('is repeatable', () => {
    expect(optimizeJob(job, { budgetMs: -1 })).toEqual(optimizeJob(job, { budgetMs: -1 }));
  });

  it('keeps trying until the time is up, and reports progress', () => {
    let t = 0;
    const seen: number[] = [];
    const r = optimizeJob(job, { budgetMs: 1000, now: () => (t += 10), onProgress: (p) => seen.push(p) });
    // about 1000 ms of 10 ms ticks (two clock reads per try)
    expect(r.iters).toBeGreaterThan(41);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('places every part exactly once, inside the sheet, with no overlaps', () => {
    for (const sc of fixtures.scenarios as Scenario[]) {
      for (const m of MATS) {
        const o = (sc.optimized as Record<string, Scenario['optimized']['box']>)[m]!;
        const j = o.job as OptimizerJob;
        const layouts = toSheetLayouts(optimizeJob(j, { budgetMs: -1 }).sheets, { L: j.SL, W: j.SW });
        const placed = layouts.flatMap((sh) => sh.strips.flatMap((st) => st.parts));
        expect(placed.map((p) => p.num).sort((a, b) => a - b)).toEqual(j.items.map((it) => it.num).sort((a, b) => a - b));
        for (const sh of layouts) {
          const ps = sh.strips.flatMap((st) => st.parts);
          for (const p of ps) {
            expect(p.x).toBeGreaterThanOrEqual(-1e-9);
            expect(p.y).toBeGreaterThanOrEqual(-1e-9);
            expect(p.x + p.L).toBeLessThanOrEqual(j.SL + 1e-6);
            expect(p.y + p.W).toBeLessThanOrEqual(j.SW + 1e-6);
          }
          for (let a = 0; a < ps.length; a++)
            for (let b = a + 1; b < ps.length; b++) {
              const p = ps[a]!, q = ps[b]!;
              const overlap = p.x < q.x + q.L - 1e-6 && q.x < p.x + p.L - 1e-6 && p.y < q.y + q.W - 1e-6 && q.y < p.y + p.W - 1e-6;
              expect(overlap).toBe(false);
            }
        }
        // a part that may not ignore grain is never turned
        const byNum = new Map(j.items.map((it) => [it.num, it]));
        for (const p of placed) {
          const it = byNum.get(p.num)!;
          if (!it.rot) expect([p.L, p.W]).toEqual([it.L, it.W]);
        }
      }
    }
  });

  it('keeps the new layout only when it is no worse', () => {
    expect(acceptOptimized(10, 11, null)).toBe('new');
    expect(acceptOptimized(11, 11, null)).toBe('new');
    expect(acceptOptimized(12, 11, null)).toBe('quick');
    expect(acceptOptimized(10, 11, 9)).toBe('previous');
    expect(acceptOptimized(9, 11, 9)).toBe('new');
    expect(acceptOptimized(0, 11, null)).toBe('quick');
  });

  it('lower bound by area', () => {
    expect(areaLowerBound({ mat: 'box', SL: 96, SW: 48, kerf: 0.125, items: [{ num: 1, L: 96, W: 48, rot: false }, { num: 2, L: 1, W: 1, rot: false }] })).toBe(2);
  });
});
