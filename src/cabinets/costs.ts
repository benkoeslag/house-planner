/**
 * Consumables, plywood sheets with spares, material counts, and cost lines with tax. A port of the
 * prototype's `consumables`, `plyCost`, `MATS_UI`, `matCounts`, `money` and the cost loop in
 * `renderStats`; the rules are in docs/cabinet-rules.md → "Materials, counts and cost".
 */
import { bandInches, totalHardware, MATERIAL_ORDER, type CutGroup } from './cutlist';
import type { CabinetSettings } from './settings';
import { materialInfo, type MaterialInfo } from './sheets';
import type { BuiltCabinet, CabinetType, Material, Part } from './types';

export type ConsumableKey = 'ps' | 'psf' | 'brad' | 'join' | 'front' | 'glue' | 'bumper' | '2x4' | 'conscr' | 'wall' | 'shim' | 'finish';
export type Consumables = Record<ConsumableKey, { n: number; basis: string }>;

export interface ConsumablesInput {
  /** Every part, including toe kick strips. */
  parts: readonly Part[];
  /** Every cabinet: its type, what it built, and whether it is placed on a wall. */
  cabinets: readonly { type: CabinetType; built: BuiltCabinet; placed: boolean }[];
  /** Lengths of the runs of base cabinets and talls that sit on the platform (package 4 supplies them). */
  platformRuns: readonly number[];
}

const POCKET_34 = ['Bottom', 'Top / bottom', 'Front stretcher', 'Rear nailer', 'Fixed shelf', 'Drawer shelf', 'Drawer partition', 'Corner top / bottom', 'Top board'];

export function consumables(input: ConsumablesInput, s: CabinetSettings): Consumables {
  const named = (names: string[]) => input.parts.filter((p) => names.includes(p.name));
  const qtyOf = (name: string) => named([name]).reduce((a, p) => a + p.qty, 0);
  let ps = 0;
  let psf = 0;
  for (const p of named(POCKET_34)) ps += p.qty * 2 * Math.max(2, Math.ceil(p.W / 7));
  for (const p of named(['Drawer box front/back'])) psf += p.qty * 2 * Math.max(2, Math.ceil(p.W / 4));
  const brad = Math.ceil(named(['Back']).reduce((a, p) => a + (p.qty * 2 * (p.L + p.W)) / 4, 0));
  const cabsN = input.cabinets.filter((c) => c.built.ok && !['panel', 'gap', 'shelf'].includes(c.type)).length;
  const nailers = qtyOf('Rear nailer');
  const panels = input.cabinets.filter((c) => c.built.ok && c.built.panel && c.placed).length;
  const cleats = qtyOf('Filler cleat');
  const join = Math.max(0, cabsN - 1) * 4 + cleats * 6 + panels * 6 + named(['Upper gable']).reduce((a, p) => a + p.qty * 4, 0);
  const falseFronts = qtyOf('False front');
  const hw = totalHardware(input.cabinets.map((c) => c.built));
  const front = hw.drawers * 4 + falseFronts * 2;
  const bumper = (hw.doors + hw.drawers + falseFronts) * 2;
  let lf = 0;
  let crosses = 0;
  let runs = 0;
  const depth = Math.max(0, s.baseD - s.kickSetback);
  for (const L of input.platformRuns) {
    const c = Math.ceil(L / 16) + 1;
    lf += 2 * L + c * Math.max(0, depth - 3);
    crosses += c;
    runs++;
  }
  const boards = lf ? Math.ceil((lf * 1.1) / 96) : 0;
  const conscr = crosses * 4 + runs * 10;
  const wall = nailers * 2 + panels * 2;
  const area = input.parts.filter((p) => p.mat === 'box').reduce((a, p) => a + p.L * p.W * p.qty, 0) / 144;
  const gal = area ? Math.max(1, Math.ceil((area * 2 * 3) / 450)) : 0;
  const x10 = (n: number) => Math.ceil(n * 1.1);
  return {
    ps: { n: x10(ps), basis: 'Pocket holes in bottoms, tops, stretchers, nailers and fixed shelves: 2 per joint end, plus one for every 7″ of joint' },
    psf: { n: x10(psf), basis: 'Drawer box fronts and backs into the sides: 2 per end, more on tall drawers' },
    brad: { n: x10(brad), basis: 'Backs nailed every 4″ around the edge' },
    join: { n: x10(join), basis: '4 between each pair of neighboring boxes, 6 per filler cleat and placed panel, 4 per upper gable' },
    front: { n: x10(front), basis: '4 per drawer front, 2 per false front, driven from inside the drawer box' },
    glue: { n: cabsN ? Math.max(1, Math.ceil(cabsN / 6)) : 0, basis: 'About one 16 oz bottle per 6 cabinets' },
    bumper: { n: bumper, basis: '2 per door and drawer front' },
    '2x4': { n: boards, basis: `Front and back rails plus cross pieces every 16″ under ${runs} run${runs === 1 ? '' : 's'} of cabinets, plus 10%` },
    conscr: { n: x10(conscr), basis: '4 per platform cross piece, plus some to fasten each run down' },
    wall: { n: x10(wall), basis: '2 through each rear nailer into the studs, 2 per wall panel' },
    shim: { n: cabsN ? Math.max(1, Math.ceil(cabsN / 6)) : 0, basis: 'One bundle per 6 cabinets for leveling the platform and uppers' },
    finish: {
      n: gal,
      basis: `${Math.round(area)} sq ft of 3/4″ maple, both faces, 3 coats at about 450 sq ft a gallon. Set the price to 0 if your plywood is prefinished.`,
    },
  };
}

export interface PlywoodRow {
  m: Material;
  mi: MaterialInfo;
  /** Sheets in the layout in use. */
  layout: number;
  spare: number;
  /** Sheets to buy. */
  n: number;
  price: number;
}

/**
 * Plywood to buy: the sheets in the layout in use (optimized if current, otherwise quick) for each
 * material that has parts, plus the spare 3/4″ sheets. The total is rounded to the dollar.
 */
export function plywoodCost(layoutSheets: Partial<Record<Material, number>>, s: CabinetSettings): { rows: PlywoodRow[]; total: number } {
  const price: Record<Material, number> = { box: s.priceBox, back: s.priceBack, drw: s.priceDrw };
  const rows = MATERIAL_ORDER.filter((m) => layoutSheets[m] !== undefined).map((m) => {
    const layout = layoutSheets[m]!;
    const spare = m === 'box' ? Math.round(s.spareBox) : 0;
    return { m, mi: materialInfo(m, s), layout, spare, n: layout + spare, price: price[m] };
  });
  return { rows, total: Math.round(rows.reduce((a, r) => a + r.n * r.price, 0)) };
}

export type PriceKey = { [K in keyof CabinetSettings]: K extends `price${string}` ? K : never }[keyof CabinetSettings];

export interface MaterialLine {
  group: string;
  key: string;
  label: string;
  unit: string;
  priceKey: PriceKey;
  /** Sold in packs of this many. */
  per?: number;
  suffix?: string;
  /** A lump sum, not counted. */
  lump?: boolean;
}

export const MATERIAL_LINES: readonly MaterialLine[] = [
  { group: 'Sheet goods', key: 'box', label: '3/4″ maple sheets', unit: 'sheet', priceKey: 'priceBox' },
  { group: 'Sheet goods', key: 'back', label: '1/4″ maple sheets', unit: 'sheet', priceKey: 'priceBack' },
  { group: 'Sheet goods', key: 'drw', label: '1/2″ maple sheets', unit: 'sheet', priceKey: 'priceDrw' },
  { group: 'Sheet goods', key: 'band', label: 'Edge banding', unit: 'ft', priceKey: 'priceBand', suffix: ' ft' },
  { group: 'Hardware', key: 'hinge', label: 'Hinges', unit: 'each', priceKey: 'priceHinge' },
  { group: 'Hardware', key: 'angle', label: '+45° corner hinges', unit: 'each', priceKey: 'priceAngle' },
  { group: 'Hardware', key: 'slide', label: 'Drawer slides', unit: 'pair', priceKey: 'priceSlide', suffix: ' pr' },
  { group: 'Hardware', key: 'pull', label: 'Pulls', unit: 'each', priceKey: 'pricePull' },
  { group: 'Hardware', key: 'pin', label: 'Shelf pins', unit: 'each', priceKey: 'pricePin' },
  { group: 'Hardware', key: 'bumper', label: 'Door and drawer bumpers', unit: '100', per: 100, priceKey: 'priceBumper' },
  { group: 'Fasteners and glue', key: 'ps', label: 'Pocket screws 1 1/4″ coarse', unit: '100', per: 100, priceKey: 'pricePS' },
  { group: 'Fasteners and glue', key: 'psf', label: 'Pocket screws 1″ (drawers)', unit: '100', per: 100, priceKey: 'pricePSF' },
  { group: 'Fasteners and glue', key: 'brad', label: 'Brads 1″ (backs)', unit: '1000', per: 1000, priceKey: 'priceBrad' },
  { group: 'Fasteners and glue', key: 'join', label: 'Screws 1 1/4″ (joining boxes, fillers, panels)', unit: '100', per: 100, priceKey: 'priceJoin' },
  { group: 'Fasteners and glue', key: 'front', label: 'Screws 1″ (drawer fronts)', unit: '100', per: 100, priceKey: 'priceFrontScr' },
  { group: 'Fasteners and glue', key: 'glue', label: 'Wood glue, 16 oz', unit: 'bottle', priceKey: 'priceGlue' },
  { group: 'Platform and install', key: '2x4', label: '2×4×8′ for the platform', unit: 'board', priceKey: 'price2x4' },
  { group: 'Platform and install', key: 'conscr', label: 'Construction screws 3″', unit: '100', per: 100, priceKey: 'priceConScr' },
  { group: 'Platform and install', key: 'wall', label: 'Cabinet screws 3″ (into studs)', unit: '100', per: 100, priceKey: 'priceWallScr' },
  { group: 'Platform and install', key: 'shim', label: 'Shims', unit: 'bundle', priceKey: 'priceShim' },
  { group: 'Finish and supplies', key: 'finish', label: 'Water-based finish', unit: 'gallon', priceKey: 'priceFinish', suffix: ' gal' },
  { group: 'Finish and supplies', key: 'misc', label: 'Sandpaper, filler, rags', unit: 'total', priceKey: 'priceMisc', lump: true },
];

/** How many of each material line to buy. */
export function materialCounts(input: {
  plywood: { rows: PlywoodRow[] };
  groups: readonly CutGroup[];
  cabinets: readonly BuiltCabinet[];
  consumables: Consumables;
}): Record<string, number> {
  const sheets = (m: Material) => input.plywood.rows.find((r) => r.m === m)?.n ?? 0;
  const hw = totalHardware(input.cabinets);
  const out: Record<string, number> = {
    box: sheets('box'),
    back: sheets('back'),
    drw: sheets('drw'),
    band: Math.ceil((bandInches(input.groups) * 1.1) / 12),
    hinge: hw.hinges,
    angle: hw.angleHinges,
    slide: Object.values(hw.slides).reduce((a, q) => a + q, 0),
    pull: hw.pulls + hw.falsePulls,
    pin: hw.pins,
    misc: 1,
  };
  for (const [k, v] of Object.entries(input.consumables)) out[k] = v.n;
  return out;
}

export interface CostLine {
  line: MaterialLine;
  count: number;
  /** Packs to buy for items sold in packs, otherwise the count. */
  packs: number;
  subtotal: number;
  tax: number;
  total: number;
  /** Nothing to buy (shown hidden in the prototype). */
  hidden: boolean;
}

/** Each material line's cost with tax, and the totals. */
export function costLines(counts: Record<string, number>, s: CabinetSettings): { lines: CostLine[]; subtotal: number; tax: number; total: number } {
  let subtotal = 0;
  const lines = MATERIAL_LINES.map((line) => {
    const count = counts[line.key] ?? 0;
    const packs = line.per ? Math.ceil(count / line.per) : count;
    const cost = packs * (s[line.priceKey] || 0);
    subtotal += cost;
    return { line, count, packs, subtotal: cost, tax: (cost * s.taxRate) / 100, total: cost * (1 + s.taxRate / 100), hidden: !line.lump && !count };
  });
  const tax = (subtotal * s.taxRate) / 100;
  return { lines, subtotal, tax, total: subtotal + tax };
}

/** Money to the cent, for example `$1,234.50`. */
export const money = (v: number): string =>
  '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A line's count as shown, for example `1,320` or `370 ft`; a lump sum reads "Lump sum". */
export const countText = (c: CostLine): string => (c.line.lump ? 'Lump sum' : c.count.toLocaleString('en-US') + (c.line.suffix ?? ''));

/** "3 packs of 100" for items sold in packs, otherwise empty. */
export const packsText = (c: CostLine): string => (c.line.per && c.count ? `${c.packs} pack${c.packs === 1 ? '' : 's'} of ${c.line.per}` : '');
