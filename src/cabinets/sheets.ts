/**
 * Quick sheet layout: rip-first strip packing, shown at once. A port of the prototype's `matInfo`
 * and `nest`; the rules are in docs/cabinet-rules.md → "Sheet layouts".
 */
import { MATERIAL_ORDER, type CutGroup } from './cutlist';
import { fmt } from './format';
import type { CabinetSettings } from './settings';
import type { CabinetWarning, Material } from './types';

export interface MaterialInfo {
  key: Material;
  name: string;
  /** Actual thickness. */
  t: number;
  nominal: string;
  /** Sheet length, along the grain. */
  L: number;
  W: number;
}

export function materialInfo(m: Material, s: CabinetSettings): MaterialInfo {
  if (m === 'box') return { key: 'box', name: 'Maple plywood', t: s.boxT, nominal: '3/4″', L: s.sheetBoxL, W: s.sheetBoxW };
  if (m === 'back') return { key: 'back', name: 'Maple plywood, backs and drawer bottoms', t: s.backT, nominal: '1/4″', L: s.sheetBackL, W: s.sheetBackW };
  return { key: 'drw', name: 'Maple plywood, drawer boxes', t: s.drwT, nominal: '1/2″', L: s.sheetDrwL, W: s.sheetDrwW };
}

/** What a sheet layout needs from a cut list line. */
export type LayoutGroup = Pick<CutGroup, 'num' | 'name' | 'L' | 'W' | 'qty' | 'rot'>;

/** A part on a sheet, measured from the usable area's corner (inside the trim). */
export interface PlacedPart {
  x: number;
  y: number;
  /** Size as placed: L along the sheet length. */
  L: number;
  W: number;
  num: number;
  name?: string;
}

/** A crosscut piece of a strip holding one or more parts ripped from it (optimized layouts). */
export interface Segment {
  x: number;
  L: number;
  usedW: number;
  items: PlacedPart[];
}

/** A strip ripped along the sheet's length. */
export interface Strip {
  y: number;
  w: number;
  /** Length used, kerfs included (quick layout). */
  used?: number;
  /** Length used, kerfs included (optimized layout). */
  usedL?: number;
  parts: PlacedPart[];
  /** Optimized layouts only. */
  segs?: Segment[];
}

export interface SheetLayout {
  strips: Strip[];
  usedW?: number;
  /** Parts area. */
  area: number;
  /** Parts area / whole sheet area. */
  yield: number;
}

export interface FailedPart {
  num: number;
  name: string;
  L: number;
  W: number;
  rot: boolean;
}

export interface NestResult {
  sheets: SheetLayout[];
  failed: FailedPart[];
  mat: MaterialInfo;
}

/** The quick layout for one material. */
export function nestQuick(groups: readonly LayoutGroup[], mat: MaterialInfo, s: Pick<CabinetSettings, 'kerf' | 'trim'>): NestResult {
  const k = s.kerf;
  const tr = s.trim;
  const SL = mat.L - 2 * tr;
  const SW = mat.W - 2 * tr;
  type Item = { num: number; name: string; L: number; W: number; rot: boolean };
  const items: Item[] = [];
  for (const g of groups) {
    for (let i = 0; i < g.qty; i++) {
      let L = g.L;
      let W = g.W;
      if (g.rot && W > L && W <= SL) [L, W] = [W, L];
      items.push({ num: g.num, name: g.name, L, W, rot: g.rot });
    }
  }
  items.sort((a, b) => b.W - a.W || b.L - a.L);
  type QSheet = { strips: (Strip & { used: number })[]; usedW: number };
  const sheets: QSheet[] = [];
  const failed: FailedPart[] = [];
  const orients = (it: Item): [number, number][] => (it.rot ? [[it.L, it.W], [it.W, it.L]] : [[it.L, it.W]]);
  const newSheet = () => {
    const sh: QSheet = { strips: [], usedW: 0 };
    sheets.push(sh);
    return sh;
  };
  const openStrip = (sh: QSheet, w: number) => {
    const st = { y: sh.usedW, w, used: 0, parts: [] as PlacedPart[] };
    sh.strips.push(st);
    sh.usedW += w + k;
    return st;
  };
  const place = (st: QSheet['strips'][number], L: number, W: number, it: Item) => {
    st.parts.push({ x: st.used, y: st.y, L, W, num: it.num, name: it.name });
    st.used += L + k;
  };
  const narrowest = (os: [number, number][]) => os.slice().sort((a, b) => a[1] - b[1])[0];
  for (const it of items) {
    let best: { st: QSheet['strips'][number]; L: number; W: number; waste: number } | null = null;
    for (const sh of sheets) {
      for (const st of sh.strips) {
        for (const [L, W] of orients(it)) {
          if (W <= st.w + 1e-6 && st.used + L <= SL + 1e-6) {
            const waste = st.w - W;
            if (!best || waste < best.waste) best = { st, L, W, waste };
          }
        }
      }
    }
    if (best && best.waste <= Math.max(1.5, 0.25 * best.W)) {
      place(best.st, best.L, best.W, it);
      continue;
    }
    let opened = false;
    for (const sh of sheets) {
      const o = narrowest(orients(it).filter(([L, W]) => L <= SL + 1e-6 && W <= SW - sh.usedW + 1e-6));
      if (o) {
        place(openStrip(sh, o[1]), o[0], o[1], it);
        opened = true;
        break;
      }
    }
    if (opened) continue;
    if (best) {
      place(best.st, best.L, best.W, it);
      continue;
    }
    const o = narrowest(orients(it).filter(([L, W]) => L <= SL + 1e-6 && W <= SW + 1e-6));
    if (o) place(openStrip(newSheet(), o[1]), o[0], o[1], it);
    else failed.push({ num: it.num, name: it.name, L: it.L, W: it.W, rot: it.rot });
  }
  const sheetArea = mat.L * mat.W;
  const out: SheetLayout[] = sheets.map((sh) => {
    const area = sh.strips.reduce((a, st) => a + st.parts.reduce((b, p) => b + p.L * p.W, 0), 0);
    return { strips: sh.strips, usedW: sh.usedW, area, yield: area / sheetArea };
  });
  return { sheets: out, failed, mat };
}

/** Problems for parts that fit on no sheet. */
export function nestWarnings(n: NestResult, s: Pick<CabinetSettings, 'round'>): CabinetWarning[] {
  const f = (x: number) => fmt(x, s.round);
  return n.failed.map((p) => ({
    id: '#' + p.num,
    msg: `${p.name} (${f(p.L)} × ${f(p.W)}) does not fit on a ${f(n.mat.L)} × ${f(n.mat.W)} sheet${p.rot ? '' : ' with the grain running lengthwise'}. Split the part or allow it to ignore grain.`,
    lvl: 'bad',
  }));
}

/** Cut list lines split by material, in material order (only materials that have parts). */
export function groupsByMaterial<G extends { mat: Material }>(groups: readonly G[]): Partial<Record<Material, G[]>> {
  const out: Partial<Record<Material, G[]>> = {};
  for (const m of MATERIAL_ORDER) {
    const gs = groups.filter((g) => g.mat === m);
    if (gs.length) out[m] = gs;
  }
  return out;
}

/** Quick layouts for every material in the cut list, and the problems for parts that don't fit. */
export function quickLayouts(groups: readonly CutGroup[], s: CabinetSettings): { nests: Partial<Record<Material, NestResult>>; warns: CabinetWarning[] } {
  const nests: Partial<Record<Material, NestResult>> = {};
  const warns: CabinetWarning[] = [];
  for (const [m, gs] of Object.entries(groupsByMaterial(groups)) as [Material, CutGroup[]][]) {
    const n = nestQuick(gs, materialInfo(m, s), s);
    nests[m] = n;
    warns.push(...nestWarnings(n, s));
  }
  return { nests, warns };
}
