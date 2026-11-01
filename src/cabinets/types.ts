/**
 * Cabinet engine types. Field names follow the prototype (docs/prototype/cabinet-planner.html) and
 * docs/cabinet-rules.md: W, H, D are width, height and depth in inches; a part is L × W, with L
 * running with the grain.
 */

export type CabinetType =
  | 'base-doors'
  | 'base-drawers'
  | 'base-drawer-door'
  | 'base-blind'
  | 'upper'
  | 'upper-diag'
  | 'upper-blind'
  | 'shelf'
  | 'tall'
  | 'gap'
  | 'panel';

export const CABINET_TYPE_LABELS: Readonly<Record<CabinetType, string>> = {
  'base-doors': 'Base · doors',
  'base-drawers': 'Base · drawers',
  'base-drawer-door': 'Base · drawer + doors',
  'base-blind': 'Base · blind corner',
  upper: 'Upper',
  'upper-diag': 'Upper · diagonal corner',
  'upper-blind': 'Upper · blind corner',
  shelf: 'Shelf',
  tall: 'Tall',
  gap: 'Open space / appliance',
  panel: 'Custom part',
};

export const BASE_TYPES: ReadonlySet<CabinetType> = new Set(['base-doors', 'base-drawers', 'base-drawer-door', 'base-blind']);
export const UPPER_TYPES: ReadonlySet<CabinetType> = new Set(['upper', 'upper-diag', 'upper-blind']);

/** `auto` gives a pair above the pair threshold, otherwise one door hinged on the left. */
export type DoorMode = 'auto' | 'none' | 'left' | 'right' | 'pair';
export type Material = 'box' | 'back' | 'drw';
export type BandCode = 'none' | '1L' | '2L' | '1L1W' | 'all';
/** `stove` is a stove space: it takes its width plus the countertop overhang on each side (not in the prototype's list; see docs/cabinet-rules.md). */
export type GapKind = 'dw' | 'fridge' | 'base' | 'upper' | 'full' | 'stove';
export type BlindTop = 'drawer' | 'false' | 'none';

/**
 * One cabinet's inputs. Optional numbers left `undefined` (or not a positive number) use the
 * default, exactly where the prototype falls back to its defaults.
 */
export interface CabinetInput {
  type: CabinetType;
  name?: string;
  /** Box width; for a diagonal corner, the length along each wall; for a custom part, its width. */
  width: number;
  /** Box height override. Not used by open shelves (see `shelfAt`) or custom parts (see `length`). */
  height?: number;
  /** Box depth override, including the back. For an open shelf, the shelf depth (default 24″). */
  depth?: number;
  /** Default `auto`. */
  doors?: DoorMode;
  /** Adjustable shelf count. `undefined` uses the type's default. */
  shelves?: number;
  /** Drawer count for a drawer base, 1 to 8. Default 3. */
  drawers?: number;
  /** Top drawer front height. Drawer bases split equally without it; drawer + doors and blind corners default to 6″. */
  topFront?: number;
  /** Drawer + doors: the top front is a fixed false front (a sink base). */
  falseFront?: boolean;
  /** Tall cabinets: 1 or 2 rows of doors. Default 2. */
  tallRows?: 1 | 2;
  /** Tall cabinets with 2 rows: lower door height. Default base box height − countertop gap. */
  lowerDoor?: number;
  /** Blind corners: which end, as you face the cabinet, is blind (toward the corner). Default `right`. */
  blindSide?: 'left' | 'right';
  /** Blind corners: corner filler width. Default 3″. */
  filler?: number;
  /** Base blind corner: what goes above the door. Default `drawer`. */
  blindTop?: BlindTop;
  /** Swap the hinge side of blind corner and diagonal corner doors. */
  hingeFlip?: boolean;
  /** Uppers: add a gable on each end. */
  gables?: boolean;
  /** Default upper depth + box thickness. */
  gableDepth?: number;
  /** Default upper height. */
  gableHeight?: number;
  /** Open shelf: add a top board between the gable tops. */
  withTop?: boolean;
  /** Open shelf: shelf height from the floor. Default 72″. */
  shelfAt?: number;
  /** Open space or appliance kind. Default `dw` (dishwasher). */
  gapKind?: GapKind;
  /** Custom part material. Default `box`. */
  material?: Material;
  /** Custom part quantity. Default 1. */
  quantity?: number;
  /** Custom part banding. Default `1L`. */
  band?: BandCode;
  /** Custom part length (along the grain). */
  length?: number;
}

export interface Band {
  /** Long edges banded (0–2). */
  l: number;
  /** Short edges banded (0–2). */
  w: number;
  /** Extra banding length, for cut corners. */
  x?: number;
}

export interface Part {
  /** Display id of the cabinet it belongs to, for example `B1`. */
  cab: string;
  name: string;
  mat: Material;
  /** Length, along the grain. */
  L: number;
  W: number;
  qty: number;
  band: Band;
  /** May ignore grain (be turned on the sheet). */
  rot: boolean;
  note: string;
}

export interface Front {
  kind: 'door' | 'drawer' | 'false' | 'blind';
  /** From the cabinet's left edge as faced. */
  x: number;
  /** From the cabinet's bottom. */
  y: number;
  w: number;
  h: number;
  /** Doors: the pull's side (away from the hinge). */
  pull?: 'left' | 'right';
  /** Doors: where the pull sits vertically. */
  pv?: 'top' | 'bottom' | 'middle';
}

export interface Hardware {
  hinges: number;
  angleHinges: number;
  pulls: number;
  falsePulls: number;
  /** Slide pairs by slide length, keyed by the length as text (for example `"22"`). */
  slides: Record<string, number>;
  pins: number;
  doors: number;
  drawers: number;
}

export interface CabinetWarning {
  id: string;
  msg: string;
  /** `bad` is a problem to fix; `warn` is advice. */
  lvl: 'warn' | 'bad';
}

export interface BlindCorner {
  type: 'blind';
  upper?: true;
  W: number;
  D: number;
  F: number;
  blindX: number;
  blindW: number;
  dw: number;
  /** The blind end is on the right as faced. */
  right: boolean;
  /** Where the other wall's row starts, from the corner. */
  y0: number;
  topMode?: BlindTop;
  flip: boolean;
}

export interface DiagonalCorner {
  type: 'diag';
  L: number;
  d: number;
  clip: number;
  diagW: number;
  dw: number;
  sideW: number;
}

export interface BuiltCabinet {
  id: string;
  label: string;
  parts: Part[];
  fronts: Front[];
  warns: CabinetWarning[];
  /** False when the cabinet could not be built (a `bad` warning says why). */
  ok: boolean;
  W: number;
  H: number;
  D: number;
  hw: Hardware;
  /** Width taken along the wall, when different from W (gables, diagonal corner). */
  EW?: number;
  gab?: { t: number; H: number };
  corner?: BlindCorner | DiagonalCorner;
  shelfN?: number;
  isShelf?: true;
  shelfAt?: number;
  topAt?: number;
  gap?: true;
  panel?: true;
}
