// Readable checks of the worked examples in docs/cabinet-rules.md, and cut list behavior.
// The exhaustive comparison with the prototype is in cabinets-golden.test.ts.
import { describe, expect, it } from 'vitest';
import {
  bandFeet,
  buildCabinet,
  buildCutList,
  cabinetSettings,
  fmt,
  grainKey,
  hiddenGrainKeys,
  hingeCount,
  totalHardware,
  type CabinetInput,
  type Part,
} from '../src/cabinets';

const S = cabinetSettings();
const f = (x: number) => fmt(x, 32);
/** Parts as readable lines: "Name L x W xQty". */
const lines = (input: CabinetInput) =>
  buildCabinet(input, S, 'X').parts.map((p) => `${p.name} ${f(p.L)} x ${f(p.W)} x${p.qty}`);

describe('worked examples (docs/cabinet-rules.md)', () => {
  it('24″ base with doors', () => {
    expect(lines({ type: 'base-doors', width: 24 })).toEqual([
      'Side 31 x 23 5/8 x2',
      'Bottom 22 9/16 x 23 5/8 x1',
      'Front stretcher 22 9/16 x 4 x1',
      'Rear nailer 22 9/16 x 4 x2',
      'Back 31 x 24 x1',
      'Door 30 7/8 x 23 7/8 x1',
      'Adjustable shelf 22 1/2 x 23 3/8 x1',
    ]);
    const x = buildCabinet({ type: 'base-doors', width: 24 }, S, 'X');
    expect([x.hw.hinges, x.hw.pulls, x.hw.pins]).toEqual([2, 1, 4]);
  });

  it('18″ drawer base, 3 drawers, 6″ top front', () => {
    const l = lines({ type: 'base-drawers', width: 18, drawers: 3, topFront: 6 });
    expect(l.filter((s) => s.startsWith('Drawer front'))).toEqual(['Drawer front 17 7/8 x 6 x1', 'Drawer front 17 7/8 x 12 5/16 x1', 'Drawer front 17 7/8 x 12 5/16 x1']);
    expect(l).toContain('Drawer box side 22 x 5 x2');
    expect(l).toContain('Drawer box side 22 x 11 5/16 x2');
    expect(l).toContain('Drawer box front/back 14 9/16 x 5 x2');
    expect(l).toContain('Drawer box front/back 14 9/16 x 11 5/16 x2');
    expect(l.filter((s) => s === 'Drawer bottom 15 x 21 7/16 x1')).toHaveLength(3);
    expect(buildCabinet({ type: 'base-drawers', width: 18, drawers: 3, topFront: 6 }, S, 'X').hw.slides).toEqual({ 22: 3 });
  });

  it('36″ sink base', () => {
    const x = buildCabinet({ type: 'base-drawer-door', width: 36, falseFront: true }, S, 'X');
    const l = x.parts.map((p) => `${p.name} ${f(p.L)} x ${f(p.W)} x${p.qty}`);
    expect(l).toContain('False front 35 7/8 x 6 x1');
    expect(l).toContain('Door 24 3/4 x 17 7/8 x2');
    expect(l).toContain('Adjustable shelf 34 1/2 x 23 3/8 x1');
    expect([x.hw.hinges, x.hw.pulls, x.hw.falsePulls, x.hw.drawers]).toEqual([4, 2, 2, 0]);
    expect(x.warns.map((w) => w.lvl)).toEqual(['warn']);
  });

  it('42″ base blind corner, blind end on the right', () => {
    const x = buildCabinet({ type: 'base-blind', width: 42, blindSide: 'right' }, S, 'X');
    expect(f(x.corner!.type === 'blind' ? x.corner!.blindX : 0)).toBe('27 19/32');
    expect(x.corner!.type === 'blind' && f(x.corner!.y0)).toBe('27 19/32');
    const l = x.parts.map((p) => `${p.name} ${f(p.L)} x ${f(p.W)} x${p.qty}`);
    for (const want of [
      'Blind panel 30 7/8 x 27 17/32 x1',
      'Drawer front 14 9/32 x 6 x1',
      'Drawer box front/back 11 11/16 x 5 x2',
      'Drawer bottom 12 1/8 x 21 7/16 x1',
      'Drawer shelf 14 13/32 x 23 5/8 x1',
      'Drawer partition 5 15/32 x 22 29/32 x1',
      'Door 24 3/4 x 14 9/32 x1',
      'Corner filler 30 7/8 x 3 x1',
      'Filler cleat 30 7/8 x 3 x1',
    ]) expect(l).toContain(want);
    expect(x.fronts.find((fr) => fr.kind === 'blind')!.x).toBeCloseTo(42 - (27.59375 - 0.0625), 9);
  });

  it('24″ diagonal corner upper', () => {
    const x = buildCabinet({ type: 'upper-diag', width: 24 }, S, 'X');
    const l = x.parts.map((p) => `${p.name} ${f(p.L)} x ${f(p.W)} x${p.qty}`);
    expect(l).toEqual([
      'Corner side 30 x 12 15/32 x2',
      'Corner top / bottom 23 1/32 x 23 1/32 x2',
      'Rear nailer 23 1/32 x 4 x2',
      'Rear nailer 22 5/16 x 4 x2',
      'Back 30 x 24 x1',
      'Back 30 x 23 3/4 x1',
      'Corner shelf 23 x 23 x2',
      'Door 29 7/8 x 15 17/32 x1',
    ]);
    expect(f(x.parts[1]!.band.x!)).toBe('14 15/16');
    expect(x.EW).toBeCloseTo(Math.SQRT2 * 12, 9);
    expect(x.hw.angleHinges).toBe(2);
  });

  it('24″ tall with two door rows', () => {
    expect(lines({ type: 'tall', width: 24 })).toEqual([
      'Side 80 1/2 x 23 3/4 x2',
      'Top / bottom 22 9/16 x 23 3/4 x2',
      'Fixed shelf 22 9/16 x 23 3/4 x1',
      'Rear nailer 22 9/16 x 4 x3',
      'Back 80 1/2 x 24 x1',
      'Door 30 7/8 x 23 7/8 x1',
      'Door 49 3/8 x 23 7/8 x1',
      'Adjustable shelf 22 1/2 x 23 1/2 x4',
    ]);
  });

  it('30″ × 18″ upper with gables takes 31 7/16″ of wall', () => {
    const x = buildCabinet({ type: 'upper', width: 30, height: 18, gables: true }, S, 'X');
    expect(f(x.EW!)).toBe('31 7/16');
    expect(x.parts.map((p) => p.name)).toContain('Upper gable');
  });

  it('hinges by door height', () => {
    expect([40, 40.01, 60, 60.5, 80, 81].map(hingeCount)).toEqual([2, 3, 3, 4, 4, 5]);
  });
});

describe('inputs that fall back to defaults', () => {
  it('an invalid filler or top front uses 3″ and 6″', () => {
    const a = buildCabinet({ type: 'base-blind', width: 42, filler: 0, topFront: -1 }, S, 'X');
    const b = buildCabinet({ type: 'base-blind', width: 42 }, S, 'X');
    expect(a.parts).toEqual(b.parts);
  });
  it('a drawer count is clamped to 1–8', () => {
    const fronts = (n: number) => buildCabinet({ type: 'base-drawers', width: 18, drawers: n }, S, 'X').fronts.length;
    // as the prototype: 0 becomes 1 (parseInt('0') || 1); no count at all is the default 3
    expect([fronts(0), fronts(1), fronts(12), fronts(2.7)]).toEqual([1, 1, 8, 2]);
    expect(buildCabinet({ type: 'base-drawers', width: 18 }, S, 'X').fronts).toHaveLength(3);
  });
  it('a non-finite width is refused, not built', () => {
    for (const width of [NaN, Infinity, -5]) {
      const x = buildCabinet({ type: 'base-doors', width }, S, 'X');
      expect(x.ok).toBe(false);
      expect(x.parts).toEqual([]);
      expect(x.warns[0]!.lvl).toBe('bad');
    }
  });
});

describe('cut list', () => {
  const part = (o: Partial<Part>): Part => ({ cab: 'B1', name: 'Side', mat: 'box', L: 31, W: 23.625, qty: 2, band: { l: 1, w: 0 }, rot: false, note: '', ...o });

  it('groups identical parts across cabinets and keeps where they came from', () => {
    const g = buildCutList([part({}), part({ cab: 'B2' }), part({ cab: 'B1', qty: 1 })], S);
    expect(g).toHaveLength(1);
    expect(g[0]!.qty).toBe(5);
    expect(g[0]!.cabs).toEqual([['B1', 3], ['B2', 2]]);
  });

  it('parts within the rounding are the same line; different banding is not', () => {
    const g = buildCutList([part({}), part({ L: 31 + 1 / 100 }), part({ band: { l: 2, w: 2 } })], S);
    expect(g.map((x) => x.qty)).toEqual([4, 2]);
  });

  it('orders by material, then part type, then longest first, and numbers from 1', () => {
    const g = buildCutList(
      [part({ name: 'Back', mat: 'back', L: 31, W: 24, qty: 1 }), part({ name: 'Door', L: 20, W: 15 }), part({ name: 'Door', L: 30, W: 15 }), part({})],
      S,
    );
    expect(g.map((x) => `${x.num} ${x.name} ${x.L}`)).toEqual(['1 Side 31', '2 Door 30', '3 Door 20', '4 Back 31']);
  });

  it('a ticked line may ignore grain, and becomes its own line', () => {
    const parts = [part({}), part({ name: 'Back', mat: 'back', L: 31, W: 24, qty: 1 })];
    const gk = grainKey(parts[1]!, S);
    expect(gk).toBe('back|Back|31|24');
    const g = buildCutList(parts, S, [gk]);
    expect(g.find((x) => x.name === 'Back')!.rot).toBe(true);
    expect(g.find((x) => x.name === 'Back')!.baseRot).toBe(false);
    // as the prototype, the hidden-parts button re-ticks a line already ticked (harmless)
    expect(hiddenGrainKeys(g)).toEqual(['back|Back|31|24']);
    expect(hiddenGrainKeys(buildCutList(parts, S))).toEqual(['back|Back|31|24']);
  });

  it('"all box parts can ignore grain" frees 3/4″ parts only', () => {
    const g = buildCutList([part({}), part({ name: 'Back', mat: 'back', L: 31, W: 24, qty: 1 })], cabinetSettings({ rotBox: true }));
    expect(g.map((x) => x.rot)).toEqual([true, false]);
  });

  it('banding is bought in feet with 10% extra', () => {
    // 2 × 31″ one long edge = 62″; × 1.1 = 68.2″ → 6 ft
    expect(bandFeet(buildCutList([part({})], S))).toBe(6);
  });

  it('hardware totals add up across cabinets', () => {
    const hw = totalHardware([
      buildCabinet({ type: 'base-drawers', width: 18, drawers: 3, topFront: 6 }, S, 'B1'),
      buildCabinet({ type: 'base-drawers', width: 18, depth: 15, drawers: 2, topFront: 6 }, S, 'B2'),
      buildCabinet({ type: 'upper', width: 30 }, S, 'U1'),
    ]);
    expect(hw.slides).toEqual({ 22: 3, 12: 2 });
    expect([hw.hinges, hw.pulls, hw.drawers, hw.doors, hw.pins]).toEqual([4, 7, 5, 2, 8]);
  });
});
