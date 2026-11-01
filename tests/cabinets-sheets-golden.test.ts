// Golden tests for sheet layouts, the optimizer, cut steps and costs: the engine must reproduce
// the prototype. Fixtures: tests/fixtures/prototype-sheets.json (scripts/prototype-fixtures.mjs).
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/prototype-sheets.json';
import { settle } from './helpers';
import { buildCutList, cabinetSettings, materialInfo, nestQuick, quickLayouts, type CabinetSettings, type Material, type Part } from '../src/cabinets';

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
