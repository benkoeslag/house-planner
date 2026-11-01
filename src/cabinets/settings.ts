/**
 * Cabinet construction settings, sheet sizes and prices. Keys and defaults are the cabinet planner
 * prototype's (`DEF` in docs/prototype/cabinet-planner.html), so every rule in
 * docs/cabinet-rules.md can be traced to them. Differences from the prototype:
 * - `slideLens` (text) is `slideLengths` (numbers);
 * - the room keys (wall lengths, stove, window, corner owner) are gone: they come from the plan;
 * - `grainFree` (per-line grain choices) is kept with the project's cabinets, not here.
 * All lengths are inches.
 */
export interface CabinetSettings {
  // materials
  boxT: number;
  backT: number;
  drwT: number;
  sheetBoxL: number;
  sheetBoxW: number;
  sheetBackL: number;
  sheetBackW: number;
  sheetDrwL: number;
  sheetDrwW: number;
  rotBack: boolean;
  rotDrw: boolean;
  rotBox: boolean;
  spareBox: number;
  kerf: number;
  trim: number;
  // heights
  counterH: number;
  counterT: number;
  counterOverhang: number;
  platformH: number;
  kickStrips: boolean;
  kickSetback: number;
  upperTop: number;
  upperH: number;
  // depths, box with back
  baseD: number;
  upperD: number;
  tallD: number;
  // box parts
  stretcherW: number;
  nailerW: number;
  baseLowerNailer: boolean;
  tallFixedShelf: boolean;
  // doors and drawer fronts
  edgeReveal: number;
  frontGap: number;
  counterGap: number;
  vReveal: number;
  pairOver: number;
  drawerGrain: 'horizontal' | 'vertical';
  // shelves
  shelfSetback: number;
  shelfClear: number;
  // drawer boxes
  slideClear: number;
  drwDeduct: number;
  slideLengths: number[];
  grooveD: number;
  btmClear: number;
  // hardware and output
  pullLen: number;
  pullDoubleOver: number;
  round: 16 | 32;
  // wall layout
  gapAt: 'corner' | 'fixed';
  // prices, before tax
  priceBox: number;
  priceBack: number;
  priceDrw: number;
  priceBand: number;
  priceHinge: number;
  priceAngle: number;
  priceSlide: number;
  pricePull: number;
  pricePin: number;
  priceBumper: number;
  pricePS: number;
  pricePSF: number;
  priceBrad: number;
  priceJoin: number;
  priceFrontScr: number;
  priceGlue: number;
  price2x4: number;
  priceConScr: number;
  priceWallScr: number;
  priceShim: number;
  priceFinish: number;
  priceMisc: number;
  taxRate: number;
}

export const DEFAULT_CABINET_SETTINGS: Readonly<CabinetSettings> = Object.freeze({
  boxT: 23 / 32,
  backT: 1 / 4,
  drwT: 1 / 2,
  sheetBoxL: 96,
  sheetBoxW: 48,
  sheetBackL: 96,
  sheetBackW: 48,
  sheetDrwL: 96,
  sheetDrwW: 48,
  rotBack: false,
  rotDrw: true,
  rotBox: false,
  spareBox: 1,
  kerf: 1 / 8,
  trim: 0,
  counterH: 36,
  counterT: 1.5,
  counterOverhang: 1 / 8,
  platformH: 3.5,
  kickStrips: true,
  kickSetback: 3,
  upperTop: 84,
  upperH: 30,
  baseD: 23.875,
  upperD: 12,
  tallD: 24,
  stretcherW: 4,
  nailerW: 4,
  baseLowerNailer: true,
  tallFixedShelf: true,
  edgeReveal: 1 / 16,
  frontGap: 1 / 8,
  counterGap: 1 / 8,
  vReveal: 1 / 8,
  pairOver: 24,
  drawerGrain: 'horizontal',
  shelfSetback: 1 / 4,
  shelfClear: 1 / 16,
  slideClear: 1 / 2,
  drwDeduct: 1,
  slideLengths: Object.freeze([12, 14, 16, 18, 20, 22]) as unknown as number[],
  grooveD: 1 / 4,
  btmClear: 1 / 16,
  pullLen: 5,
  pullDoubleOver: 30,
  round: 32,
  gapAt: 'corner',
  priceBox: 110,
  priceBack: 55,
  priceDrw: 85,
  priceBand: 0.15,
  priceHinge: 6,
  priceAngle: 12,
  priceSlide: 20,
  pricePull: 6,
  pricePin: 0.1,
  priceBumper: 6,
  pricePS: 9,
  pricePSF: 9,
  priceBrad: 10,
  priceJoin: 8,
  priceFrontScr: 7,
  priceGlue: 7,
  price2x4: 4.5,
  priceConScr: 12,
  priceWallScr: 15,
  priceShim: 5,
  priceFinish: 55,
  priceMisc: 40,
  taxRate: 13,
});

/** A full settings object: the defaults with `overrides` applied. */
export function cabinetSettings(overrides: Partial<CabinetSettings> = {}): CabinetSettings {
  return { ...DEFAULT_CABINET_SETTINGS, slideLengths: [...DEFAULT_CABINET_SETTINGS.slideLengths], ...overrides };
}

/** Base box height: countertop height − countertop thickness − platform height. */
export const baseBoxHeight = (s: CabinetSettings): number => s.counterH - s.counterT - s.platformH;
/** Tall box height: top of uppers − platform height. */
export const tallBoxHeight = (s: CabinetSettings): number => s.upperTop - s.platformH;
