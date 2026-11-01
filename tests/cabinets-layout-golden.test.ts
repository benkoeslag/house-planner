// Golden tests: the prototype's wall layouts, reproduced on a real floor plan. Each scenario in
// tests/fixtures/prototype-layout.json (scripts/prototype-fixtures.mjs) is drawn as an L of two walls
// meeting at an inside corner, with cabinet runs on the inside faces, the window as a plan opening
// and the stove as a stove-space item.
import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/prototype-layout.json';
import { settle } from './helpers';
import { cabinetSettings, emptyCabinets, planCabinets, type CabinetInput, type CabinetItem, type CabinetsData, type ItemPosition } from '../src/cabinets';
import type { Plan, Wall } from '../src/model/types';

type Scenario = (typeof fixtures.layouts)[number];
type Cab = { input: CabinetInput; wall: string; pos?: string; at?: number; snap?: string; alignTo?: number; alignSide?: string };
const T = 4.5;
const h = T / 2;
const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: T, height: 96 });

export function scenarioProject(sc: Scenario): { plan: Plan; data: CabinetsData } {
  const room = sc.room;
  const settings = cabinetSettings({ ...((sc as { settings?: object }).settings ?? {}), gapAt: room.gapAt as 'corner' | 'fixed' });
  // The left wall is the south wall (running east from the corner), the right wall the west wall (running north).
  const plan: Plan = { walls: [wall('s', -h, -h, room.leftLen, -h), wall('w', -h, -h, -h, room.rightLen)], openings: [], roomLabels: [] };
  if (room.winWall !== 'none') {
    plan.openings.push({ id: 'win', wallId: room.winWall === 'L' ? 's' : 'w', kind: 'window', offset: room.winFrom + h, width: room.winW, height: 30, sill: 42 });
  }
  const data = emptyCabinets(settings);
  data.runs = [
    { id: 'L', kind: 'wall', name: 'Left wall', wallIds: ['s'], face: 'left', from: 'a' },
    { id: 'R', kind: 'wall', name: 'Right wall', wallIds: ['w'], face: 'right', from: 'a' },
  ];
  data.corners = [{ id: 'c', runIds: ['L', 'R'], owner: room.cornerOwner }];
  const position = (c: Cab): ItemPosition => {
    switch (c.pos ?? 'flow') {
      case 'window':
        return { mode: 'opening', openingId: 'win' };
      case 'stove':
        return { mode: 'align', itemId: 'stove', side: 'center' };
      case 'follow':
        return { mode: 'follow' };
      case 'at':
        return { mode: 'at', at: c.at! };
      case 'align':
        return { mode: 'align', itemId: 'i' + c.alignTo, side: c.alignSide as 'left' | 'right' | 'center' };
      default:
        return { mode: 'flow' };
    }
  };
  data.items = (sc.cabs as Cab[]).map(
    (c, i): CabinetItem => ({
      id: 'i' + i,
      ...(c.wall === '' ? { cornerId: 'c' } : { runId: c.wall }),
      input: c.input,
      position: position(c),
      snap: (c.snap ?? 'auto') as CabinetItem['snap'],
    }),
  );
  // The stove goes last so it does not change anyone's label.
  if (room.stoveWall !== 'none') {
    data.items.push({ id: 'stove', runId: room.stoveWall, input: { type: 'gap', gapKind: 'stove', width: room.stoveW }, position: { mode: 'at', at: room.stoveFrom - settings.counterOverhang }, snap: 'auto' });
  }
  return { plan, data };
}

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
