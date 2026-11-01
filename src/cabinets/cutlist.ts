/**
 * Groups parts into the numbered cut list, with grain choices. This is a port of the prototype's
 * `finalize` (without the sheet layout, which is package 3); the rules are in
 * docs/cabinet-rules.md → "Cut list".
 */
import { roundCut } from './format';
import type { CabinetSettings } from './settings';
import type { Band, BuiltCabinet, Hardware, Material, Part } from './types';

/** Part types in cut list order; unknown names (custom parts) sort after these. */
export const KIND_ORDER: readonly string[] = [
  'Side', 'Corner side', 'Upper gable', 'Bottom', 'Top / bottom', 'Corner top / bottom', 'Fixed shelf', 'Drawer shelf',
  'Drawer partition', 'Front stretcher', 'Rear nailer', 'Adjustable shelf', 'Corner shelf', 'Door', 'Drawer front',
  'False front', 'Blind panel', 'Corner filler', 'Filler cleat', 'Toe kick', 'Back', 'Drawer box side',
  'Drawer box front/back', 'Drawer bottom',
];

/** Material order: 3/4″ box, 1/4″ backs and drawer bottoms, 1/2″ drawer boxes. */
export const MATERIAL_ORDER: readonly Material[] = ['box', 'back', 'drw'];

/** Parts nobody sees, ticked together by "Ignore grain on hidden parts". */
export const HIDDEN_PARTS: readonly string[] = [
  'Rear nailer', 'Front stretcher', 'Filler cleat', 'Drawer partition', 'Drawer shelf', 'Back', 'Drawer bottom',
  'Drawer box side', 'Drawer box front/back',
];

export interface CutGroup {
  /** Cut list number, from 1, used to label parts on sheet layouts. */
  num: number;
  /** Grouping key: material, name, rounded size, banding and grain. */
  key: string;
  /** Grain key: the owner's per-line grain choice is stored under it. */
  gk: string;
  mat: Material;
  name: string;
  L: number;
  W: number;
  band: Band;
  /** May ignore grain. */
  rot: boolean;
  /** May ignore grain without the owner's per-line choice (part type or settings). */
  baseRot: boolean;
  qty: number;
  /** Quantity from each cabinet, in the order the cabinets were listed. */
  cabs: [string, number][];
  notes: string[];
}

/** The key a per-line grain choice is stored under: material, name and rounded size. */
export function grainKey(p: Pick<Part, 'mat' | 'name' | 'L' | 'W'>, s: Pick<CabinetSettings, 'round'>): string {
  return [p.mat, p.name, roundCut(p.L, s.round), roundCut(p.W, s.round)].join('|');
}

/**
 * Groups identical parts, numbers the groups in cut list order, and applies grain: a part may
 * ignore grain if its type allows it, if it is a 3/4″ part and "all box parts can ignore grain" is
 * on, or if the owner ticked its line (`grainFree` holds grain keys).
 */
export function buildCutList(parts: readonly Part[], s: CabinetSettings, grainFree: Iterable<string> = []): CutGroup[] {
  const free = new Set(grainFree);
  const groups = new Map<string, CutGroup & { cabMap: Map<string, number>; noteSet: Set<string> }>();
  for (const p of parts) {
    const baseRot = p.rot || (p.mat === 'box' && s.rotBox);
    const gk = grainKey(p, s);
    const rot = baseRot || free.has(gk);
    const key = [p.mat, p.name, roundCut(p.L, s.round), roundCut(p.W, s.round), p.band.l, p.band.w, roundCut(p.band.x || 0, s.round), rot ? 1 : 0].join('|');
    let g = groups.get(key);
    if (!g) {
      g = { num: 0, key, gk, baseRot, mat: p.mat, name: p.name, L: p.L, W: p.W, band: p.band, rot, qty: 0, cabs: [], notes: [], cabMap: new Map(), noteSet: new Set() };
      groups.set(key, g);
    }
    g.qty += p.qty;
    g.cabMap.set(p.cab, (g.cabMap.get(p.cab) ?? 0) + p.qty);
    if (p.note) g.noteSet.add(p.note);
  }
  const kindOf = (n: string) => {
    const i = KIND_ORDER.indexOf(n);
    return i < 0 ? 99 : i;
  };
  const sorted = [...groups.values()].sort(
    (a, b) =>
      MATERIAL_ORDER.indexOf(a.mat) - MATERIAL_ORDER.indexOf(b.mat) ||
      kindOf(a.name) - kindOf(b.name) ||
      a.name.localeCompare(b.name) ||
      b.L - a.L ||
      b.W - a.W,
  );
  return sorted.map(({ cabMap, noteSet, ...g }, i) => ({ ...g, num: i + 1, cabs: [...cabMap.entries()], notes: [...noteSet] }));
}

/** Edge banding length in inches, before the 10% allowance. */
export function bandInches(groups: readonly CutGroup[]): number {
  return groups.reduce((a, g) => a + (g.band.l * g.L + g.band.w * g.W + (g.band.x || 0)) * g.qty, 0);
}

/** Edge banding to buy, in whole feet: the measured length plus 10%. */
export const bandFeet = (groups: readonly CutGroup[]): number => Math.ceil((bandInches(groups) * 1.1) / 12);

/** Grain keys that "Ignore grain on hidden parts" ticks: hidden part types not already free. */
export function hiddenGrainKeys(groups: readonly CutGroup[]): string[] {
  return groups.filter((g) => HIDDEN_PARTS.includes(g.name) && !g.baseRot).map((g) => g.gk);
}

/** Hardware totals across cabinets. */
export function totalHardware(cabinets: readonly BuiltCabinet[]): Hardware {
  const hw: Hardware = { hinges: 0, angleHinges: 0, pulls: 0, falsePulls: 0, slides: {}, pins: 0, doors: 0, drawers: 0 };
  for (const x of cabinets) {
    hw.hinges += x.hw.hinges;
    hw.angleHinges += x.hw.angleHinges;
    hw.pulls += x.hw.pulls;
    hw.falsePulls += x.hw.falsePulls;
    hw.pins += x.hw.pins;
    hw.doors += x.hw.doors;
    hw.drawers += x.hw.drawers;
    for (const [len, q] of Object.entries(x.hw.slides)) hw.slides[len] = (hw.slides[len] ?? 0) + q;
  }
  return hw;
}
