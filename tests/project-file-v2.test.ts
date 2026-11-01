// Project file version 2: cabinets (ADR-003). Version 1 files must keep opening.
import { describe, expect, it } from 'vitest';
import { cabinetSettings, emptyCabinets, planCabinets, pruneCabinets } from '../src/cabinets';
import { FILE_VERSION, parseProject, sampleProject, serializeProject, type Project } from '../src/model';
import { saveAutosave, loadAutosave, type KeyValueStore } from '../src/storage';
import { scenario, scenarioProject } from './cabinet-scenarios';

const starter = (): Project => {
  const { plan, data } = scenarioProject(scenario('starter kitchen'));
  return { name: 'Kitchen', settings: { wallThickness: 4.5, wallHeight: 96 }, plan, cabinets: data };
};
const parsed = (t: string): Project => {
  const r = parseProject(t);
  if (!r.ok) throw new Error(r.error);
  return r.project;
};
const errorOf = (t: string): string => {
  const r = parseProject(t);
  if (r.ok) throw new Error('expected the file to be refused');
  return r.error;
};
const docOf = (p: Project = starter()): Record<string, any> => JSON.parse(serializeProject(p));

describe('project file version 2', () => {
  it('saves cabinet settings under settings and the rest in a cabinets section', () => {
    const doc = docOf();
    expect(doc.version).toBe(2);
    expect(doc.settings.cabinets).toEqual(cabinetSettings({ gapAt: 'corner' }));
    expect(Object.keys(doc.cabinets)).toEqual(['runs', 'corners', 'items', 'grainFree', 'sheetLayouts']);
    expect(doc.cabinets.items).toHaveLength(16);
  });

  it('round-trips the starter kitchen exactly, and it lays out the same', () => {
    const p = starter();
    p.cabinets.grainFree = ['back|Back|31|18'];
    p.cabinets.sheetLayouts = [{ mat: 'drw', signature: '[96,48]', sheets: [{ strips: [{ y: 0, w: 5, usedL: 22.125, parts: [{ x: 0, y: 0, L: 22, W: 5, num: 81 }] }], area: 110, yield: 0.02 }] }];
    const back = parsed(serializeProject(p));
    expect(back).toEqual(p);
    const a = planCabinets(p.plan, p.cabinets);
    const b = planCabinets(back.plan, back.cabinets);
    expect(b.warns).toEqual(a.warns);
    expect(b.runs.map((w) => w.items.map((i) => [i.label, i.a, i.b]))).toEqual(a.runs.map((w) => w.items.map((i) => [i.label, i.a, i.b])));
  });

  it('opens a version 1 file unchanged, with no cabinets and the default cabinet settings', () => {
    const p = sampleProject();
    const v1 = { format: 'house-planner', version: 1, units: 'in', name: p.name, settings: p.settings, plan: p.plan };
    const r = parseProject(JSON.stringify(v1));
    if (!r.ok) throw new Error(r.error);
    expect(r.migratedFrom).toBe(1);
    expect(r.project.plan).toEqual(p.plan);
    expect(r.project.settings).toEqual(p.settings);
    expect(r.project.cabinets).toEqual(emptyCabinets());
    // and saving it again writes version 2
    expect(docOf(r.project).version).toBe(FILE_VERSION);
  });

  it('fills cabinet settings that are missing, and keeps the ones given', () => {
    const doc = docOf();
    doc.settings.cabinets = { boxT: 0.75, priceBox: 98.5 };
    const p = parsed(JSON.stringify(doc));
    expect(p.cabinets.settings).toEqual(cabinetSettings({ boxT: 0.75, priceBox: 98.5 }));
  });

  it('accepts zero where the prototype does (prices, tax, spares, trim, overhang)', () => {
    const doc = docOf();
    Object.assign(doc.settings.cabinets, { priceFinish: 0, taxRate: 0, spareBox: 0, trim: 0, counterOverhang: 0 });
    expect(() => parsed(JSON.stringify(doc))).not.toThrow();
  });

  it('explains bad cabinet values with where they are', () => {
    const cases: [(d: Record<string, any>) => void, RegExp][] = [
      [(d) => (d.settings.cabinets.boxT = 0), /settings\.cabinets\.boxT must be more than 0/],
      [(d) => (d.settings.cabinets.round = 8), /settings\.cabinets\.round must be one of 16, 32/],
      [(d) => (d.settings.cabinets.slideLengths = [12, -1]), /settings\.cabinets\.slideLengths\[1\] must be more than 0/],
      [(d) => (d.settings.cabinets.rotBox = 'yes'), /settings\.cabinets\.rotBox must be true or false/],
      [(d) => (d.cabinets.items[2].input.type = 'sofa'), /cabinets\.items\[2\]\.input\.type must be one of/],
      [(d) => (d.cabinets.items[2].input.width = 'wide'), /cabinets\.items\[2\]\.input\.width must be a number/],
      [(d) => (d.cabinets.items[2].position = { mode: 'at' }), /cabinets\.items\[2\]\.position\.at must be a number/],
      [(d) => (d.cabinets.items[2].snap = 'up'), /cabinets\.items\[2\]\.snap must be one of auto, left, right/],
      [(d) => (d.cabinets.items[2].runId = 'nowhere'), /cabinets\.items\[2\] is on a run that does not exist/],
      [(d) => (d.cabinets.items[8].cornerId = 'nowhere'), /cabinets\.items\[8\] is in a corner that does not exist/],
      [(d) => (d.cabinets.items[2].position = { mode: 'align', itemId: 'ghost', side: 'left' }), /lines up with a cabinet that does not exist/],
      [(d) => (d.cabinets.corners[0].owner = 'X'), /cabinets\.corners\[0\]\.owner must be one of its two runs/],
      [(d) => ((d.cabinets.corners[0].runIds = ['L', 'Q']), (d.cabinets.corners[0].owner = 'L')), /Corner "c" names a run that does not exist/],
      [(d) => (d.cabinets.runs[0].face = 'top'), /cabinets\.runs\[0\]\.face must be one of left, right/],
      [(d) => (d.cabinets.runs[0].wallIds = []), /cabinets\.runs\[0\]\.wallIds must name at least one wall/],
      [(d) => (d.cabinets.items[3].id = d.cabinets.items[2].id), /cabinet id "i2" is used more than once/],
      [(d) => (d.cabinets.items[2].cornerId = 'c'), /cannot be both on a run and in a corner/],
      [(d) => (d.cabinets.sheetLayouts = [{ mat: 'box', signature: 'x', sheets: [{ strips: [{ y: 0, w: 0, parts: [] }], area: 0, yield: 0 }] }]), /sheetLayouts\[0\]\.sheets\[0\]\.strips\[0\]\.w must be more than 0/],
      [(d) => (d.cabinets = []), /cabinets must be an object/],
    ];
    for (const [change, msg] of cases) {
      const doc = docOf();
      change(doc);
      expect(errorOf(JSON.stringify(doc))).toMatch(msg);
    }
  });

  it('keeps cabinets whose wall or window was deleted, and the layout says so', () => {
    const p = starter();
    p.plan = { ...p.plan, walls: p.plan.walls.filter((w) => w.id !== 's'), openings: [] };
    const back = parsed(serializeProject(p));
    expect(back.cabinets).toEqual(p.cabinets);
    const out = planCabinets(back.plan, back.cabinets);
    expect(out.brokenRuns).toEqual([{ runId: 'L', reason: 'The wall this run was on is gone.' }]);
    expect(out.warns.some((w) => /wall is gone/.test(w.msg))).toBe(true);
    expect(out.warns.some((w) => /door or window this was centered on is gone/.test(w.msg))).toBe(true);
  });
});

describe('pruning cabinets after walls are deleted', () => {
  it('drops runs whose walls are all gone, with their items and corners', () => {
    const p = starter();
    const plan = { ...p.plan, walls: p.plan.walls.filter((w) => w.id !== 's') };
    const { data, removed } = pruneCabinets(plan, p.cabinets);
    expect(removed.runs.map((r) => r.id)).toEqual(['L']);
    expect(removed.corners.map((c) => c.id)).toEqual(['c']);
    // B1-B3 and U2-U4 on the left wall, the diagonal corner upper, and the stove
    expect(removed.items.map((i) => i.id)).toEqual(['i0', 'i1', 'i2', 'i8', 'i9', 'i10', 'i11', 'stove']);
    expect(data.runs.map((r) => r.id)).toEqual(['R']);
    expect(data.items).toHaveLength(8);
    // the result is a valid file again
    expect(parsed(serializeProject({ ...p, plan, cabinets: data })).cabinets).toEqual(data);
  });

  it('puts line-ups with a dropped cabinet back in list order', () => {
    const p = starter();
    p.cabinets.items[12]!.position = { mode: 'align', itemId: 'i1', side: 'left' };
    const { data } = pruneCabinets({ walls: p.plan.walls.filter((w) => w.id !== 's') }, p.cabinets);
    expect(data.items.find((i) => i.id === 'i12')!.position).toEqual({ mode: 'flow' });
  });

  it('changes nothing when every run still has a wall', () => {
    const p = starter();
    const r = pruneCabinets(p.plan, p.cabinets);
    expect(r.data).toBe(p.cabinets);
  });
});

describe('autosave keeps cabinets', () => {
  it('restores the cabinets it saved', () => {
    const mem = new Map<string, string>();
    const store: KeyValueStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
    const p = starter();
    expect(saveAutosave(store, p)).toEqual({ ok: true });
    const r = loadAutosave(store);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.project.cabinets).toEqual(p.cabinets);
  });
});
