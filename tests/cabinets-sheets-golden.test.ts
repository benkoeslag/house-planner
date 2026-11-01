// Golden tests for sheet layouts, the optimizer, cut steps and costs: the engine must reproduce
// the prototype. Fixtures: tests/fixtures/prototype-sheets.json (scripts/prototype-fixtures.mjs).
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/prototype-sheets.json';
import { settle } from './helpers';
import {
  acceptOptimized,
  areaLowerBound,
  buildCutList,
  cutSteps,
  cutStepsText,
  fmt,
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
  type SheetLayout,
  type SheetSteps,
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

/** The cut steps in the fixture's format: the prototype page's text, line by line. */
function asPageText(steps: SheetSteps, s: CabinetSettings): string[] {
  const f = (x: number, den: number = s.round) => fmt(x, den);
  const sz = (L: number, W: number) => `${f(L)} × ${f(W)}`;
  const out: string[] = [];
  for (const st of steps.strips) {
    out.push(`S ${st.index}Rip a strip ${f(st.width)}″ wide`);
    for (const ln of st.lines) {
      if (ln.kind === 'crosscut') {
        const how = (ln.ripTo !== undefined ? `, rip to ${f(ln.ripTo)}″ wide` : '') + (ln.trimTo !== undefined ? `, trim to ${f(ln.trimTo)}″ long` : '');
        const act = (ln.count > 1 ? `Crosscut ${ln.count} pieces at ${f(ln.at)}″` : `Crosscut ${f(ln.at)}″`) + how;
        out.push(`C ${act} => ${ln.part.num} ${ln.part.name}${ln.count > 1 ? ` ×${ln.count}` : ''} ${sz(ln.part.L, ln.part.W)}`);
      } else {
        out.push(`C Crosscut ${f(ln.at)}″, then rip that piece into ${ln.pieces}:`);
        for (const r of ln.rips) {
          out.push(`R ${r.num} ${r.name}${r.count > 1 ? ` ×${r.count}` : ''} ${r.count > 1 ? `${r.count} at ` : ''}${f(r.W)}″ wide${r.trimTo !== undefined ? `, trim to ${f(r.trimTo)}″ long` : ''} ${sz(r.L, r.W)}`);
        }
      }
    }
    if (st.leftover) out.push(`O Leftover from this strip: ${f(st.leftover.L, 8)} × ${f(st.leftover.W)}`);
  }
  if (steps.edgeLeftover) out.push(`E Leftover along the edge: ${f(steps.edgeLeftover.L, 8)} × ${f(steps.edgeLeftover.W, 8)}`);
  return out;
}

describe('cut steps match the prototype', () => {
  for (const sc of fixtures.scenarios as Scenario[]) {
    const s = settingsOf(sc);
    const names = new Map(sc.groups.map((g) => [g.num, g.name]));
    for (const m of MATS) {
      it(`${sc.name}: ${m}, quick and optimized`, () => {
        const q = (sc.quick as Record<string, Scenario['quick']['box']>)[m]!;
        const o = (sc.optimized as Record<string, Scenario['optimized']['box']>)[m]!;
        q.sheets.forEach((sh, i) => expect(asPageText(cutSteps(sh as SheetLayout, q.mat, s, names), s)).toEqual(q.steps[i]));
        o.sheets.forEach((sh, i) => expect(asPageText(cutSteps(sh as unknown as SheetLayout, q.mat, s, names), s)).toEqual(o.steps[i]));
      });
    }
  }
  it('synthetic case', () => {
    const s = cabinetSettings();
    const names = new Map(fixtures.synthetic.groups.map((g) => [g.num, g.name]));
    fixtures.synthetic.nest.sheets.forEach((sh, i) =>
      expect(asPageText(cutSteps(sh as SheetLayout, fixtures.synthetic.nest.mat, s, names), s)).toEqual(fixtures.synthetic.steps[i]),
    );
  });
  it('plain text reads as steps', () => {
    const sc = fixtures.scenarios[0]!;
    const s = cabinetSettings();
    const text = cutStepsText(cutSteps(sc.quick.box.sheets[0] as SheetLayout, sc.quick.box.mat, s, new Map(sc.groups.map((g) => [g.num, g.name]))), s);
    expect(text.slice(0, 3)).toEqual([
      '1. Rip a strip 27 17/32″ wide',
      '   Crosscut 30 7/8″: #58 Blind panel 30 7/8 × 27 17/32',
      '   Crosscut 34 1/2″, rip to 24 23/32″ wide: #64 Dishwasher end panel 34 1/2 × 24 23/32',
    ]);
  });
});
