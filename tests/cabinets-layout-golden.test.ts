// Golden tests: the prototype's wall layouts, reproduced on a real floor plan. Each scenario in
// tests/fixtures/prototype-layout.json (scripts/prototype-fixtures.mjs) is drawn as an L of two walls
// meeting at an inside corner, with cabinet runs on the inside faces, the window as a plan opening
// and the stove as a stove-space item.
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/prototype-layout.json';
import { settle } from './helpers';
import { planCabinets } from '../src/cabinets';
import { scenarioProject } from './cabinet-scenarios';


describe('wall layout matches the prototype', () => {
  for (const sc of fixtures.layouts) {
    it(sc.name, () => {
      const { plan, data } = scenarioProject(sc);
      const out = planCabinets(plan, data);
      expect(out.brokenRuns).toEqual([]);
      expect(out.built.filter((b) => b.item.id !== 'stove').map((b) => b.label)).toEqual(sc.ids);
      for (const w of out.runs) {
        const k = w.geometry.run.id as 'L' | 'R';
        const exp = sc.walls[k];
        expect(settle({ len: w.geometry.length, lowStart: w.lowStart, upStart: w.upStart, lowEnd: w.lowEnd, upEnd: w.upEnd })).toEqual(
          settle({ len: exp.len, lowStart: exp.lowStart, upStart: exp.upStart, lowEnd: exp.lowEnd, upEnd: exp.upEnd }),
        );
        expect(settle(w.items.map((i) => ({ id: i.label, row: i.row, a: i.a, b: i.b, fixed: i.fixed })))).toEqual(settle(exp.items));
        expect(settle(w.gaps)).toEqual(settle(exp.gaps));
        expect(settle({ winCenter: w.winCenter, sinkOff: w.sinkOff })).toEqual(settle({ winCenter: exp.winCenter, sinkOff: exp.sinkOff }));
        expect(settle(w.counters.map((c) => c.b - c.a))).toEqual(settle(exp.counterRuns));
      }
      expect(out.warns).toEqual(sc.warns);
      // the prototype's cut list step adds baseRot and key to its parts afterward
      const kick = sc.kickParts.map(({ baseRot: _b, key: _k, ...p }) => p);
      expect(settle(out.parts.filter((p) => p.cab === 'Kick'))).toEqual(settle(kick));
      expect(settle(out.platformRuns)).toEqual(settle(sc.platformRuns));
      for (const c of (sc.corners as { id: string; gap?: number }[]).filter((x) => x.gap !== undefined)) {
        const cl = out.corners[0]!;
        const got = cl.blind?.label === c.id ? cl.blindGap : cl.blindUpper?.label === c.id ? cl.blindUpperGap : undefined;
        expect(got).toBeCloseTo(c.gap!, 9);
      }
    });
  }
});
