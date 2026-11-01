/**
 * The on-demand sheet optimizer: three-stage guillotine packing (rip strips, crosscut segments, rip
 * parts), tried many ways within a time budget. A port of the prototype's `workerMain`, `sigFor`
 * and the acceptance rule in `runOptimizer`; the rules are in docs/cabinet-rules.md →
 * "Optimizer (on demand)". This module is pure: the app runs it in a Web Worker (package 7).
 *
 * The random numbers come from the prototype's fixed-seed generator, so a run with the same
 * inputs and number of tries gives the same layout. The arithmetic is kept exactly as the
 * prototype's, so results match it.
 */
import { MATERIAL_ORDER, type CutGroup } from './cutlist';
import { roundCut } from './format';
import type { CabinetSettings } from './settings';
import { type MaterialInfo, type NestResult, type PlacedPart, type SheetLayout } from './sheets';
import type { Material } from './types';

export interface OptimizerItem {
  num: number;
  L: number;
  W: number;
  rot: boolean;
}

export interface OptimizerJob {
  mat: Material;
  /** Usable sheet length and width (inside the trim). */
  SL: number;
  SW: number;
  kerf: number;
  items: OptimizerItem[];
}

interface RawItem {
  x: number;
  y: number;
  L: number;
  W: number;
  num: number;
}
interface RawSegment {
  x: number;
  L: number;
  usedW: number;
  items: RawItem[];
}
interface RawStrip {
  y: number;
  w: number;
  usedL: number;
  segs: RawSegment[];
}
export interface RawSheet {
  strips: RawStrip[];
  usedW: number;
}

export interface OptimizeOptions {
  /** Time budget in milliseconds. The fixed tries always run; random tries stop once the time is up. */
  budgetMs: number;
  now?: () => number;
  /** Called about every 150 ms with the fraction of the budget used. */
  onProgress?: (fraction: number) => void;
}

type Tol = { seg: number; strip: number };
type Item = OptimizerItem & { flip?: boolean };

/** Strategy 1: place each part in the best segment, then strip, then a new strip, then a new sheet. */
function pack(items: Item[], job: OptimizerJob, tol: Tol): RawSheet[] {
  const SL = job.SL, SW = job.SW, k = job.kerf, E = 1e-6, sheets: RawSheet[] = [];
  const newStrip = (sh: RawSheet, w: number): RawStrip => {
    const st: RawStrip = { y: sh.usedW, w, usedL: 0, segs: [] };
    sh.strips.push(st);
    sh.usedW += w + k;
    return st;
  };
  const placeSeg = (st: RawStrip, sg: RawSegment, L: number, W: number, num: number) => {
    sg.items.push({ x: sg.x, y: st.y + sg.usedW, L, W, num });
    sg.usedW += W + k;
  };
  const newSeg = (st: RawStrip, L: number, W: number, num: number) => {
    const sg: RawSegment = { x: st.usedL, L, usedW: 0, items: [] };
    st.segs.push(sg);
    st.usedL += L + k;
    placeSeg(st, sg, L, W, num);
  };
  for (const it of items) {
    const ors: [number, number][] =
      it.rot && Math.abs(it.L - it.W) > E ? (it.flip ? [[it.W, it.L], [it.L, it.W]] : [[it.L, it.W], [it.W, it.L]]) : [[it.L, it.W]];
    let b1: { sg: RawSegment; st: RawStrip; L: number; W: number; w: number } | null = null;
    let b2: { st: RawStrip; L: number; W: number; w: number } | null = null;
    let b3: { sh: RawSheet; L: number; W: number } | null = null;
    for (const sh of sheets) for (const st of sh.strips) for (const sg of st.segs) for (const [L, W] of ors)
      if (L <= sg.L + E && sg.usedW + W <= st.w + E) {
        const w = sg.L - L;
        if (!b1 || w < b1.w) b1 = { sg, st, L, W, w };
      }
    if (b1 && b1.w <= tol.seg * b1.sg.L) {
      placeSeg(b1.st, b1.sg, b1.L, b1.W, it.num);
      continue;
    }
    for (const sh of sheets) for (const st of sh.strips) for (const [L, W] of ors)
      if (W <= st.w + E && st.usedL + L <= SL + E) {
        const w = st.w - W;
        if (!b2 || w < b2.w) b2 = { st, L, W, w };
      }
    if (b2 && b2.w <= tol.strip * b2.W) {
      newSeg(b2.st, b2.L, b2.W, it.num);
      continue;
    }
    for (const sh of sheets) for (const [L, W] of ors)
      if (L <= SL + E && sh.usedW + W <= SW + E) {
        if (!b3 || W < b3.W) b3 = { sh, L, W };
      }
    if (b3) {
      newSeg(newStrip(b3.sh, b3.W), b3.L, b3.W, it.num);
      continue;
    }
    if (b1) {
      placeSeg(b1.st, b1.sg, b1.L, b1.W, it.num);
      continue;
    }
    if (b2) {
      newSeg(b2.st, b2.L, b2.W, it.num);
      continue;
    }
    const o = ors.find(([L, W]) => L <= SL + E && W <= SW + E);
    if (!o) continue;
    const sh: RawSheet = { strips: [], usedW: 0 };
    sheets.push(sh);
    newSeg(newStrip(sh, o[1]), o[0], o[1], it.num);
  }
  return sheets;
}

/** Strategy 2: build complete strips first, then fit the strips onto sheets (best fit, with noise). */
function pack2(items: Item[], job: OptimizerJob, tol: Tol, rnd: () => number, noise: number): RawSheet[] {
  const SL = job.SL, SW = job.SW, k = job.kerf, E = 1e-6;
  type Seg2 = { x: number; L: number; usedW: number; items: (Omit<RawItem, 'y'> & { yo?: number; y?: number })[] };
  type Strip2 = { w: number; usedL: number; segs: Seg2[]; y?: number };
  const rest = items.slice();
  const strips: Strip2[] = [];
  while (rest.length) {
    const first = rest.shift()!;
    const fo: [number, number] =
      first.rot && Math.abs(first.L - first.W) > E && (first.flip ? first.L : first.W) < (first.flip ? first.W : first.L) ? [first.W, first.L] : [first.L, first.W];
    let o0 = fo;
    if (o0[0] > SL + E || o0[1] > SW + E) o0 = [fo[1], fo[0]];
    if (o0[0] > SL + E || o0[1] > SW + E) continue;
    const st: Strip2 = { w: o0[1], usedL: 0, segs: [] };
    const seg0: Seg2 = { x: 0, L: o0[0], usedW: 0, items: [] };
    st.segs.push(seg0);
    st.usedL = o0[0] + k;
    seg0.items.push({ x: 0, yo: 0, L: o0[0], W: o0[1], num: first.num });
    seg0.usedW = o0[1] + k;
    for (let i = 0; i < rest.length; i++) {
      const it = rest[i]!;
      const ors: [number, number][] = it.rot && Math.abs(it.L - it.W) > E ? [[it.L, it.W], [it.W, it.L]] : [[it.L, it.W]];
      let placed = false;
      for (const [L, W] of ors) {
        if (W > st.w + E) continue;
        const sg = st.segs.find((g) => L <= g.L + E && g.usedW + W <= st.w + E && g.L - L <= tol.seg * g.L);
        if (sg) {
          sg.items.push({ x: sg.x, yo: sg.usedW, L, W, num: it.num });
          sg.usedW += W + k;
          placed = true;
          break;
        }
        if (st.usedL + L <= SL + E && st.w - W <= tol.strip * W) {
          const g: Seg2 = { x: st.usedL, L, usedW: W + k, items: [{ x: st.usedL, yo: 0, L, W, num: it.num }] };
          st.segs.push(g);
          st.usedL += L + k;
          placed = true;
          break;
        }
      }
      if (placed) {
        rest.splice(i, 1);
        i--;
      }
    }
    strips.push(st);
  }
  strips.sort((a, b) => b.w * (1 + noise * (rnd() - 0.5)) - a.w * (1 + noise * (rnd() - 0.5)));
  const sheets: { strips: Strip2[]; usedW: number }[] = [];
  for (const st of strips) {
    let best: { sh: (typeof sheets)[number]; free: number } | null = null;
    for (const sh of sheets) {
      const free = SW - sh.usedW - st.w;
      if (free >= -E && (!best || free < best.free)) best = { sh, free };
    }
    const sh = best ? best.sh : (sheets.push({ strips: [], usedW: 0 }), sheets[sheets.length - 1]!);
    st.y = sh.usedW;
    sh.usedW += st.w + k;
    sh.strips.push(st);
    for (const g of st.segs)
      for (const p of g.items) {
        p.y = st.y + p.yo!;
        delete p.yo;
      }
  }
  return sheets as unknown as RawSheet[];
}

function score(sheets: RawSheet[], job: OptimizerJob): number {
  const last = sheets[sheets.length - 1];
  const used = last ? last.strips.reduce((a, st) => a + st.w * Math.min(job.SL, st.usedL), 0) : 0;
  return sheets.length * 1e9 + used;
}

const KEYS: ((it: OptimizerItem) => [number, number])[] = [
  (it) => [it.W, it.L],
  (it) => [it.L, it.W],
  (it) => [it.L * it.W, it.W],
  (it) => [Math.max(it.L, it.W), Math.min(it.L, it.W)],
  (it) => [it.L + it.W, it.W],
];
const TOLS: Tol[] = [
  { seg: 1, strip: 0 },
  { seg: 0.3, strip: 0.25 },
  { seg: 1, strip: 1 },
  { seg: 0.5, strip: 0.1 },
];

function order(items: Item[], key: (it: OptimizerItem) => [number, number], noise: number, rnd: () => number): Item[] {
  return items
    .map((it) => {
      const kv = key(it);
      return { it, a: kv[0] * (1 + noise * (rnd() - 0.5)), b: kv[1] };
    })
    .sort((p, q) => q.a - p.a || q.b - p.b)
    .map((x) => x.it);
}

/** Number of fixed (non-random) tries: every sort key with every tolerance pair, with both strategies. */
export const FIXED_TRIES = KEYS.length * TOLS.length * 2;

/** Optimizes one material. Returns the best layout found and the number of tries. */
export function optimizeJob(job: OptimizerJob, opts: OptimizeOptions): { sheets: RawSheet[]; iters: number } {
  const now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const budget = opts.budgetMs;
  let seed = 987654321;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let best: RawSheet[] | null = null;
  let bestScore = Infinity;
  let iters = 0;
  const t0 = now();
  let lastP = t0;
  for (;;) {
    const det = iters < FIXED_TRIES;
    const di = iters >> 1;
    const key = det ? KEYS[di % KEYS.length]! : KEYS[Math.floor(rnd() * KEYS.length)]!;
    const tol = det ? TOLS[Math.floor(di / KEYS.length) % TOLS.length]! : { seg: rnd(), strip: rnd() * rnd() };
    const items: Item[] = job.items.map((it) => ({ ...it, flip: !det && it.rot && rnd() < 0.5 }));
    const noise = det ? 0 : rnd() * 0.6;
    const ordered = order(items, key, noise, rnd);
    const sheets = iters % 2 ? pack2(ordered, job, tol, rnd, noise) : pack(ordered, job, tol);
    const sc = score(sheets, job);
    if (sc < bestScore) {
      bestScore = sc;
      best = sheets;
    }
    iters++;
    const t = now();
    if (t - lastP > 150) {
      opts.onProgress?.((t - t0) / budget);
      lastP = t;
    }
    if (!det && t - t0 > budget) break;
  }
  return { sheets: best ?? [], iters };
}

/** Optimizer jobs for every material that has sheets in its quick layout. */
export function optimizerJobs(groups: readonly CutGroup[], nests: Partial<Record<Material, NestResult>>, s: Pick<CabinetSettings, 'trim' | 'kerf'>): OptimizerJob[] {
  return MATERIAL_ORDER.filter((m) => nests[m] && nests[m]!.sheets.length).map((m) => {
    const mi = nests[m]!.mat;
    const items: OptimizerItem[] = [];
    for (const g of groups.filter((x) => x.mat === m)) for (let i = 0; i < g.qty; i++) items.push({ num: g.num, L: g.L, W: g.W, rot: g.rot });
    return { mat: m, SL: mi.L - 2 * s.trim, SW: mi.W - 2 * s.trim, kerf: s.kerf, items };
  });
}

/** Optimizes several materials, sharing the time budget equally (as the prototype's worker). */
export function optimizeLayouts(jobs: readonly OptimizerJob[], opts: OptimizeOptions): Partial<Record<Material, { sheets: RawSheet[]; iters: number }>> {
  const out: Partial<Record<Material, { sheets: RawSheet[]; iters: number }>> = {};
  jobs.forEach((job, ji) => {
    out[job.mat] = optimizeJob(job, {
      ...opts,
      budgetMs: opts.budgetMs / jobs.length,
      onProgress: opts.onProgress ? (p) => opts.onProgress!((ji + Math.min(1, p)) / jobs.length) : undefined,
    });
  });
  return out;
}

/** Turns optimizer sheets into sheet layouts with parts listed per strip, parts area and yield. */
export function toSheetLayouts(raw: readonly RawSheet[], mat: Pick<MaterialInfo, 'L' | 'W'>): SheetLayout[] {
  const area = mat.L * mat.W;
  return raw.map((sh) => {
    const strips = sh.strips.map((st) => ({ ...st, parts: st.segs.flatMap((sg) => sg.items) as PlacedPart[] }));
    const used = strips.reduce((a, st) => a + st.parts.reduce((b, p) => b + p.L * p.W, 0), 0);
    return { strips, area: used, yield: used / area };
  });
}

/**
 * Identifies the inputs a layout was made for: sheet size, kerf, trim, and each line's number, size,
 * quantity and grain. A saved optimized layout is used only while its signature still matches.
 */
export function layoutSignature(groups: readonly Pick<CutGroup, 'num' | 'L' | 'W' | 'qty' | 'rot'>[], mat: Pick<MaterialInfo, 'L' | 'W'>, s: Pick<CabinetSettings, 'kerf' | 'trim' | 'round'>): string {
  return JSON.stringify([mat.L, mat.W, s.kerf, s.trim, groups.map((g) => [g.num, roundCut(g.L, s.round), roundCut(g.W, s.round), g.qty, g.rot ? 1 : 0])]);
}

/** The fewest sheets possible by area alone. */
export function areaLowerBound(job: OptimizerJob): number {
  return Math.ceil(job.items.reduce((a, it) => a + it.L * it.W, 0) / (job.SL * job.SW));
}

export type AcceptOutcome = 'new' | 'previous' | 'quick';

/**
 * Which layout to keep after a run: the new one if it uses no more sheets than the quick layout and
 * the earlier optimized one, otherwise the earlier optimized one, otherwise the quick layout.
 */
export function acceptOptimized(newSheets: number, quickSheets: number, previousSheets: number | null): AcceptOutcome {
  const prevN = previousSheets ?? Infinity;
  if (newSheets && newSheets <= quickSheets && newSheets <= prevN) return 'new';
  if (previousSheets !== null) return 'previous';
  return 'quick';
}
