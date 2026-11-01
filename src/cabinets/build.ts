/**
 * Turns one cabinet's inputs into parts, fronts, hardware and warnings. This is a port of the
 * prototype's `buildCab` and `buildDiag` (docs/prototype/cabinet-planner.html); the rules are
 * written out in docs/cabinet-rules.md → "Parts for each cabinet", and
 * tests/cabinets-golden.test.ts checks the output against the prototype's own.
 */
import { fmt } from './format';
import { baseBoxHeight, tallBoxHeight, type CabinetSettings } from './settings';
import {
  BASE_TYPES,
  CABINET_TYPE_LABELS,
  UPPER_TYPES,
  type Band,
  type BandCode,
  type BuiltCabinet,
  type CabinetInput,
  type CabinetType,
  type Front,
  type Material,
} from './types';

export const BANDS: Readonly<Record<BandCode, Band>> = Object.freeze({
  none: Object.freeze({ l: 0, w: 0 }),
  '1L': Object.freeze({ l: 1, w: 0 }),
  '2L': Object.freeze({ l: 2, w: 0 }),
  '1L1W': Object.freeze({ l: 1, w: 1 }),
  all: Object.freeze({ l: 2, w: 2 }),
});

const NO_BAND: Band = Object.freeze({ l: 0, w: 0 });
const ALL: Band = Object.freeze({ l: 2, w: 2 });
const ONE_LONG: Band = Object.freeze({ l: 1, w: 0 });

const isDim = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** The value if it is a positive number, otherwise the default (the prototype's `dimOr`). */
const dimOr = (v: number | undefined, d: number): number => (isDim(v) ? v : d);
/** A count: whole part of a finite number, else the fallback (the prototype's `parseInt(v) || fallback`). */
const count = (v: number | undefined, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : NaN;
  return n || fallback;
};

/** Hinges per door by door height: 2 up to 40″, 3 up to 60″, 4 up to 80″, 5 above. */
export const hingeCount = (h: number): number => (h <= 40 ? 2 : h <= 60 ? 3 : h <= 80 ? 4 : 5);

/** Thickness of a material. */
export function materialThickness(m: Material, s: CabinetSettings): number {
  return m === 'box' ? s.boxT : m === 'back' ? s.backT : s.drwT;
}

function autoHeight(type: CabinetType, s: CabinetSettings): number | undefined {
  if (BASE_TYPES.has(type)) return baseBoxHeight(s);
  if (UPPER_TYPES.has(type)) return s.upperH;
  if (type === 'tall') return tallBoxHeight(s);
  return undefined;
}

function autoDepth(type: CabinetType, s: CabinetSettings): number | undefined {
  if (BASE_TYPES.has(type)) return s.baseD;
  if (UPPER_TYPES.has(type)) return s.upperD;
  if (type === 'tall') return s.tallD;
  return undefined;
}

/** Longest available slide no longer than `avail`, or 0 if none fits. */
function pickSlide(avail: number, s: CabinetSettings): number {
  const list = s.slideLengths.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => b - a);
  return list.find((x) => x <= avail + 1e-6) ?? 0;
}

/** Default adjustable shelf count for uppers by height. */
const upperShelves = (H: number): number => (H <= 24 ? 1 : H <= 36 ? 2 : 3);

export function buildCabinet(c: CabinetInput, s: CabinetSettings, id: string): BuiltCabinet {
  const X: BuiltCabinet = {
    id,
    label: c.name || CABINET_TYPE_LABELS[c.type],
    parts: [],
    fronts: [],
    warns: [],
    ok: false,
    W: 0,
    H: 0,
    D: 0,
    hw: { hinges: 0, angleHinges: 0, pulls: 0, falsePulls: 0, slides: {}, pins: 0, doors: 0, drawers: 0 },
  };
  const f = (x: number) => fmt(x, s.round);
  const warn = (msg: string, lvl: 'warn' | 'bad' = 'warn') => X.warns.push({ id, msg, lvl });
  const add = (name: string, mat: Material, L: number, Wd: number, qty: number, band: Band = NO_BAND, extra: { rot?: boolean; note?: string } = {}) => {
    if (qty <= 0) return;
    if (!(L > 0 && Wd > 0)) {
      warn(`${name} works out to no size. Check this cabinet's dimensions.`, 'bad');
      return;
    }
    X.parts.push({ cab: id, name, mat, L, W: Wd, qty, band, rot: !!extra.rot, note: extra.note || '' });
  };
  const W = c.width;

  if (c.type === 'shelf') {
    const D = dimOr(c.depth, 24);
    const at = dimOr(c.shelfAt, 72);
    if (!isDim(W)) {
      warn('Enter the shelf width (the space between the gables).', 'bad');
      return X;
    }
    add('Shelf board', 'box', W - 1 / 16, D, 1, ONE_LONG, { note: 'between the gables on shelf pins or cleats' });
    X.W = W;
    X.H = s.boxT;
    X.D = D;
    X.shelfAt = at;
    X.isShelf = true;
    X.ok = true;
    if (c.withTop) {
      add('Top board', 'box', W, D, 1, ONE_LONG, { note: 'fastened between the gable tops, flush with them' });
      X.topAt = s.upperTop;
      if (at > s.upperTop - 4) {
        warn(`The shelf at ${f(at)}″ is within 4″ of the top board at ${f(s.upperTop)}″. Lower the shelf to leave a usable opening.`);
      }
    }
    X.hw.pins += 4;
    return X;
  }

  if (c.type === 'gap') {
    if (!isDim(W)) {
      warn('Enter a width for this open space.', 'bad');
      return X;
    }
    const kind = c.gapKind ?? 'dw';
    X.W = W;
    X.ok = true;
    X.gap = true;
    if (kind === 'stove') {
      // The cabinets beside a stove sit back by the countertop overhang, so the countertop edges land on the stove space.
      X.H = s.counterH;
      X.EW = W + 2 * s.counterOverhang;
      return X;
    }
    const row = kind === 'dw' ? 'base' : kind === 'fridge' ? 'full' : kind;
    X.H = row === 'upper' ? s.upperH : row === 'full' ? (kind === 'fridge' ? 70 : s.upperTop) : s.counterH - s.counterT;
    return X;
  }

  if (c.type === 'panel') {
    const L = c.length;
    const q = Math.max(0, count(c.quantity ?? 1, 0));
    if (!isDim(W) || !isDim(L)) {
      warn('Enter a width and a length for this part.', 'bad');
      return X;
    }
    const mat = c.material ?? 'box';
    const rot = (mat === 'back' && s.rotBack) || (mat === 'drw' && s.rotDrw);
    add(c.name || 'Custom part', mat, L, W, q, BANDS[c.band ?? '1L'] ?? BANDS.none, { rot });
    X.ok = true;
    X.W = materialThickness(mat, s) * q;
    X.H = L;
    X.panel = true;
    return X;
  }

  const H = dimOr(c.height, autoHeight(c.type, s) ?? NaN);
  const D = dimOr(c.depth, autoDepth(c.type, s) ?? NaN);
  if (!isDim(W) || !isDim(H) || !isDim(D)) {
    warn('Width, height or depth is missing or not a number.', 'bad');
    return X;
  }
  X.W = W;
  X.H = H;
  X.D = D;
  const t = s.boxT;
  const iw = W - 2 * t;
  const sd = D - s.backT;
  if (iw <= 2 || sd <= 2) {
    warn('This cabinet is too small for the box material.', 'bad');
    return X;
  }
  X.ok = true;
  if (c.type === 'upper-diag') return buildDiagonal(X, c, s, warn, add);
  const isBase = BASE_TYPES.has(c.type);

  // ---- box
  add('Side', 'box', H, sd, 2, ONE_LONG);
  if (isBase) {
    add('Bottom', 'box', iw, sd, 1, ONE_LONG);
    add('Front stretcher', 'box', iw, s.stretcherW, 1, ONE_LONG, { note: 'flat, top front' });
    const nl = s.baseLowerNailer ? 2 : 1;
    add('Rear nailer', 'box', iw, s.nailerW, nl, NO_BAND, { note: nl === 2 ? 'on edge, top and bottom of back' : 'on edge, top of back' });
  } else if (c.type === 'upper' || c.type === 'upper-blind') {
    add('Top / bottom', 'box', iw, sd, 2, ONE_LONG);
    add('Rear nailer', 'box', iw, s.nailerW, 2, NO_BAND, { note: 'on edge, top and bottom of back' });
  } else if (c.type === 'tall') {
    add('Top / bottom', 'box', iw, sd, 2, ONE_LONG);
    if (s.tallFixedShelf) add('Fixed shelf', 'box', iw, sd, 1, ONE_LONG, { note: 'structural, mid-height' });
    add('Rear nailer', 'box', iw, s.nailerW, s.tallFixedShelf ? 3 : 2, NO_BAND, { note: 'on edge, top / middle / bottom' });
  }
  add('Back', 'back', H, W, 1, NO_BAND, { rot: s.rotBack, note: 'glued and nailed on, flush' });

  // ---- fronts
  const er = s.edgeReveal;
  const gap = s.frontGap;
  const fw = W - 2 * er;
  const mode = c.doors ?? 'auto';
  const doorMode = mode === 'auto' ? (W > s.pairOver ? 'pair' : 'left') : mode;

  const doors = (y0: number, h: number, pv: Front['pv']) => {
    if (doorMode === 'none') return;
    if (h <= 0) {
      warn('There is no room left for doors. Check the drawer front height.', 'bad');
      return;
    }
    const n = doorMode === 'pair' ? 2 : 1;
    const dw = n === 2 ? (fw - gap) / 2 : fw;
    if (n === 1) X.fronts.push({ kind: 'door', x: er, y: y0, w: dw, h, pull: doorMode === 'right' ? 'left' : 'right', pv });
    else {
      X.fronts.push({ kind: 'door', x: er, y: y0, w: dw, h, pull: 'right', pv });
      X.fronts.push({ kind: 'door', x: er + dw + gap, y: y0, w: dw, h, pull: 'left', pv });
    }
    add('Door', 'box', h, dw, n, ALL);
    X.hw.hinges += n * hingeCount(h);
    X.hw.pulls += n;
    X.hw.doors += n;
    if (n === 1 && dw > 24.01) {
      warn(`Single door is ${f(dw)}″ wide. Doors wider than about 24″ swing far into the room and are heavy on two hinges. Consider a pair.`);
    }
    if (n === 2 && dw < 8) warn(`Each door of the pair is only ${f(dw)}″ wide. Consider a single door.`);
  };

  const drawer = (y: number, h: number, isFalse: boolean, o: { fw?: number; x?: number; iw?: number } = {}) => {
    const vert = s.drawerGrain === 'vertical';
    const fwv = o.fw ?? fw;
    const iwv = o.iw ?? iw;
    add(isFalse ? 'False front' : 'Drawer front', 'box', vert ? h : fwv, vert ? fwv : h, 1, ALL, { note: isFalse ? 'fixed in place' : '' });
    X.fronts.push({ kind: isFalse ? 'false' : 'drawer', x: o.x ?? er, y, w: fwv, h });
    const np = fwv > s.pullDoubleOver ? 2 : 1;
    if (isFalse) {
      X.hw.falsePulls += np;
      return;
    }
    X.hw.pulls += np;
    X.hw.drawers++;
    const bh = Math.floor((h - s.drwDeduct) * 16 + 1e-6) / 16;
    const bw = iwv - 2 * s.slideClear;
    const depth = pickSlide(sd - t - 0.25, s);
    if (!depth) {
      warn('No drawer slide length in your list fits this cabinet depth.', 'bad');
      return;
    }
    if (bh < 2) {
      warn(`A drawer box works out to ${f(bh)}″ tall. Make that drawer front taller.`, 'bad');
      return;
    }
    const dt = s.drwT;
    const g = s.grooveD;
    add('Drawer box side', 'drw', depth, bh, 2, NO_BAND, { rot: s.rotDrw });
    add('Drawer box front/back', 'drw', bw - 2 * dt, bh, 2, NO_BAND, { rot: s.rotDrw, note: 'between the sides' });
    if (g > 0) {
      add('Drawer bottom', 'back', bw - 2 * dt + 2 * g - s.btmClear, depth - 2 * dt + 2 * g - s.btmClear, 1, NO_BAND, { rot: true, note: 'sits in groove' });
    } else add('Drawer bottom', 'back', bw, depth, 1, NO_BAND, { rot: true, note: 'nailed under the box' });
    const key = String(depth);
    X.hw.slides[key] = (X.hw.slides[key] ?? 0) + 1;
  };

  const shelves = (def: number) => {
    const n = c.shelves === undefined ? def : Math.max(0, count(c.shelves, 0));
    if (!n) return;
    add('Adjustable shelf', 'box', iw - s.shelfClear, sd - s.shelfSetback, n, ONE_LONG);
    X.shelfN = n;
    X.hw.pins += 4 * n;
    if (iw > 32) {
      warn(`The shelves in this cabinet are ${f(iw)}″ long with no support in the middle, and 3/4″ plywood starts to sag past about 32″ under heavy dishes. Glue a hardwood strip to the front edge, add a center divider, or split it into two cabinets. Fine to ignore for light items.`);
    }
  };

  const topY = H - s.counterGap;
  if (c.type === 'base-doors') {
    doors(0, topY, 'top');
    shelves(1);
  } else if (c.type === 'base-drawers') {
    const n = Math.min(8, Math.max(1, count(c.drawers ?? 3, 1)));
    const tf = c.topFront;
    const avail = topY - (n - 1) * gap;
    const hs = n > 1 && isDim(tf) ? [tf, ...Array<number>(n - 1).fill((avail - tf) / (n - 1))] : Array<number>(n).fill(avail / n);
    if (hs.some((h) => h < 3)) warn('Some drawer fronts are under 3″ tall. Reduce the number of drawers or the top front height.', 'bad');
    let y = topY;
    for (const h of hs) {
      y -= h;
      if (h > 0) drawer(y, h, false);
      y -= gap;
    }
  } else if (c.type === 'base-drawer-door') {
    const tf = dimOr(c.topFront, 6);
    const y = topY - tf;
    drawer(y, tf, !!c.falseFront);
    doors(0, y - gap, 'top');
    shelves(1);
  } else if (c.type === 'base-blind') {
    const F = dimOr(c.filler, 3);
    const right = c.blindSide !== 'left';
    const blindX = s.baseD + t + F;
    const blindW = blindX - gap / 2;
    const dw = W - blindX - gap / 2 - er;
    const topMode = c.blindTop ?? 'drawer';
    if (dw < 9) warn(`The door on this blind corner works out to ${f(dw)}″. Make the cabinet at least ${f(Math.ceil(blindX + 12.5))}″ wide for a 12″ door.`, 'bad');
    add('Blind panel', 'box', topY, blindW, 1, ALL, { note: 'screwed to the box front over the blind end' });
    X.fronts.push({ kind: 'blind', x: right ? W - blindW : 0, y: 0, w: blindW, h: topY });
    if (dw > 0) {
      const dx = right ? er : W - er - dw;
      let dh = topY;
      if (topMode === 'false' || topMode === 'drawer') {
        const tf = dimOr(c.topFront, 6);
        const y = topY - tf;
        drawer(y, tf, topMode === 'false', { fw: dw, x: dx, iw: W - t - blindX });
        if (topMode === 'drawer') {
          add('Drawer shelf', 'box', W - blindX, sd, 1, ONE_LONG, { note: 'under the drawer, partition to outer side' });
          add('Drawer partition', 'box', H - t - y + gap / 2, sd - t, 1, ONE_LONG, {
            note: `sits on the drawer shelf, ${f(blindX)}″ from the blind end; slide mounts to it`,
          });
        }
        dh = y - gap;
      }
      X.fronts.push({ kind: 'door', x: dx, y: 0, w: dw, h: dh, pull: right !== !!c.hingeFlip ? 'right' : 'left', pv: 'top' });
      add('Door', 'box', dh, dw, 1, ALL, { note: 'hinged on the end away from the corner' });
      X.hw.hinges += hingeCount(dh);
      X.hw.pulls++;
      X.hw.doors++;
    }
    add('Corner filler', 'box', topY, F, 1, NO_BAND, { note: 'goes on the first cabinet of the other wall' });
    add('Filler cleat', 'box', topY, 3, 1, NO_BAND, { note: 'glued behind the filler, screwed to that cabinet' });
    shelves(1);
    X.corner = { type: 'blind', W, D, F, blindX, blindW, dw, right, y0: D + t + F, topMode, flip: !!c.hingeFlip };
  } else if (c.type === 'upper-blind') {
    const F = dimOr(c.filler, 3);
    const right = c.blindSide !== 'left';
    const blindX = s.upperD + t + F;
    const blindW = blindX - gap / 2;
    const dw = W - blindX - gap / 2 - er;
    const y0 = s.vReveal / 2;
    const fh = H - s.vReveal;
    if (dw < 9) warn(`The door on this blind corner works out to ${f(dw)}″. Make the cabinet at least ${f(Math.ceil(blindX + 12.5))}″ wide for a 12″ door.`, 'bad');
    add('Blind panel', 'box', fh, blindW, 1, ALL, { note: 'screwed to the box front over the blind end' });
    X.fronts.push({ kind: 'blind', x: right ? W - blindW : 0, y: y0, w: blindW, h: fh });
    if (dw > 0) {
      X.fronts.push({ kind: 'door', x: right ? er : W - er - dw, y: y0, w: dw, h: fh, pull: right !== !!c.hingeFlip ? 'right' : 'left', pv: 'bottom' });
      add('Door', 'box', fh, dw, 1, ALL, { note: 'hinged on the end away from the corner' });
      X.hw.hinges += hingeCount(fh);
      X.hw.pulls++;
      X.hw.doors++;
    }
    add('Corner filler', 'box', fh, F, 1, NO_BAND, { note: 'goes on the first upper of the other wall' });
    add('Filler cleat', 'box', fh, 3, 1, NO_BAND, { note: 'glued behind the filler, screwed to that cabinet' });
    shelves(upperShelves(H));
    X.corner = { type: 'blind', upper: true, W, D, F, blindX, blindW, dw, right, y0: D + t + F, flip: !!c.hingeFlip };
  } else if (c.type === 'upper') {
    doors(s.vReveal / 2, H - s.vReveal, 'bottom');
    shelves(upperShelves(H));
    if (c.gables) {
      const gH = dimOr(c.gableHeight, s.upperH);
      const gD = dimOr(c.gableDepth, s.upperD + t);
      add('Upper gable', 'box', gH, gD, 2, ONE_LONG, { note: 'one on each end, top flush with the uppers' });
      X.gab = { t, H: gH };
      X.EW = W + 2 * t;
    }
  } else if (c.type === 'tall') {
    const avail = H - s.vReveal;
    if ((c.tallRows ?? 2) === 2) {
      const lo = dimOr(c.lowerDoor, baseBoxHeight(s) - s.counterGap);
      const up = avail - lo - gap;
      doors(0, lo, 'top');
      doors(lo + gap, up, 'bottom');
    } else doors(0, avail, 'middle');
    shelves(4);
  }
  return X;
}

type Warn = (msg: string, lvl?: 'warn' | 'bad') => void;
type Add = (name: string, mat: Material, L: number, Wd: number, qty: number, band?: Band, extra?: { rot?: boolean; note?: string }) => void;

/** Diagonal corner upper: `W` is the length along each wall. */
function buildDiagonal(X: BuiltCabinet, c: CabinetInput, s: CabinetSettings, warn: Warn, add: Add): BuiltCabinet {
  const L = X.W;
  const d = X.D;
  const H = X.H;
  const t = s.boxT;
  const b = s.backT;
  const s2 = Math.SQRT2;
  const f = (x: number) => fmt(x, s.round);
  if (L < d + 2 * t + 4) {
    X.ok = false;
    warn(`A diagonal corner this deep needs more than ${f(d + 2 * t + 4)}″ along each wall.`, 'bad');
    return X;
  }
  const sideW = d + t - b;
  const sq = L - t - b;
  const clip = L - d - 2 * t;
  add('Corner side', 'box', H, sideW, 2, ONE_LONG, { note: 'front edge beveled 45°, long point on the inside face' });
  add('Corner top / bottom', 'box', sq, sq, 2, { l: 0, w: 0, x: clip * s2 }, {
    note: `cut square, then cut off one corner ${f(clip)} along each edge; band the cut edge`,
  });
  add('Rear nailer', 'box', L - t - b, s.nailerW, 2, NO_BAND, { note: 'on edge, first back, top and bottom' });
  add('Rear nailer', 'box', L - 2 * t - b, s.nailerW, 2, NO_BAND, { note: 'on edge, second back, butts the first nailer' });
  add('Back', 'back', H, L, 1, NO_BAND, { rot: s.rotBack, note: 'first wall, full length' });
  add('Back', 'back', H, L - b, 1, NO_BAND, { rot: s.rotBack, note: 'second wall, butts the first back' });
  const n = c.shelves === undefined ? upperShelves(H) : Math.max(0, count(c.shelves, 0));
  if (n) {
    const cl = s.shelfClear / 2;
    const ss = sq - cl;
    const sc = clip - cl + s.shelfSetback * s2;
    add('Corner shelf', 'box', ss, ss, n, { l: 0, w: 0, x: sc * s2 }, {
      note: `cut square, then cut off one corner ${f(sc)} along each edge; band the cut edge`,
    });
    X.hw.pins += 4 * n;
  }
  const diagW = s2 * (L - d);
  const dw = diagW - 2 * t;
  const dh = H - s.vReveal;
  add('Door', 'box', dh, dw, 1, ALL, { note: 'angled corner door' });
  X.fronts.push({ kind: 'door', x: t, y: s.vReveal / 2, w: dw, h: dh, pull: c.hingeFlip ? 'left' : 'right', pv: 'bottom' });
  X.hw.angleHinges += hingeCount(dh);
  X.hw.pulls++;
  X.hw.doors++;
  X.EW = diagW;
  X.corner = { type: 'diag', L, d, clip, diagW, dw, sideW };
  return X;
}
