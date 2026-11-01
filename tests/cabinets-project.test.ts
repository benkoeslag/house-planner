import { describe, expect, it } from 'vitest';
import { buildCabinet, cabinetSettings, emptyCabinets, itemLabels, type CabinetItem } from '../src/cabinets';

const item = (id: string, input: CabinetItem['input']): CabinetItem => ({ id, runId: 'r1', input, position: { mode: 'flow' }, snap: 'auto' });

describe('cabinet project data', () => {
  it('starts empty with the default settings', () => {
    const c = emptyCabinets();
    expect(c).toEqual({ settings: cabinetSettings(), runs: [], corners: [], items: [], grainFree: [], sheetLayouts: [] });
  });

  it('labels items in list order by kind, as the prototype', () => {
    const labels = itemLabels([
      item('a', { type: 'base-blind', width: 42 }),
      item('b', { type: 'upper', width: 30 }),
      item('c', { type: 'base-doors', width: 24 }),
      item('d', { type: 'gap', width: 24 }),
      item('e', { type: 'panel', width: 24, length: 34.5 }),
      item('f', { type: 'upper-diag', width: 24 }),
      item('g', { type: 'tall', width: 24 }),
      item('h', { type: 'shelf', width: 36 }),
    ]);
    expect([...labels.values()]).toEqual(['B1', 'U1', 'B2', 'O1', 'P1', 'U2', 'T1', 'S1']);
  });
});

describe('stove space', () => {
  it('takes its width plus the countertop overhang on each side', () => {
    const x = buildCabinet({ type: 'gap', gapKind: 'stove', width: 30 }, cabinetSettings(), 'O1');
    expect([x.ok, x.gap, x.W, x.EW, x.H, x.parts.length]).toEqual([true, true, 30, 30.25, 36, 0]);
  });
});
