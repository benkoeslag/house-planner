/**
 * The cabinet data saved with a project (ADR-003): runs on wall faces, corners, one ordered list
 * of items, grain choices, and accepted optimized sheet layouts. Positions along a run are inches
 * from the run's start face corner.
 */
import { cabinetSettings, type CabinetSettings } from './settings';
import type { SheetLayout } from './sheets';
import { BASE_TYPES, UPPER_TYPES, type CabinetInput, type CabinetType, type Material } from './types';

/** A straight stretch along one face of one or more collinear walls. */
export interface CabinetRun {
  id: string;
  /** Only wall runs exist in file version 2. Islands will be a new kind. */
  kind: 'wall';
  /** Shown in messages, for example "Left wall". */
  name?: string;
  /**
   * The walls the run was created on. The run spans the whole straight face through them: every
   * collinear wall of the same thickness joined end to end, up to where another wall meets the face.
   */
  wallIds: string[];
  /** Which face of the first wall, looking from its `a` toward its `b`. */
  face: 'left' | 'right';
  /** The end positions are measured from: the start of the face toward `a` or toward `b` of the first wall. */
  from: 'a' | 'b';
}

/**
 * An inside corner where two runs start. The owner is the run whose cabinets run into the corner
 * when there is no blind corner cabinet. The corner's style comes from its cabinets: a blind
 * cabinet first on either run, or a diagonal upper placed in the corner.
 */
export interface CabinetCorner {
  id: string;
  runIds: [string, string];
  owner: string;
}

export type ItemPosition =
  /** In list order. */
  | { mode: 'flow' }
  /** Fixed, centered on a door, window or opening of the plan on the same run. */
  | { mode: 'opening'; openingId: string }
  /** Fixed, right after the fixed piece above it in the list on the same run. */
  | { mode: 'follow' }
  /** Fixed, its start this far from the run's start corner. */
  | { mode: 'at'; at: number }
  /** Fixed, lined up with a base-row item on the same run (side as faced). */
  | { mode: 'align'; itemId: string; side: 'left' | 'right' | 'center' };

export interface CabinetItem {
  id: string;
  /** The run it stands on. Exactly one of `runId` and `cornerId` is set. */
  runId?: string;
  /** A diagonal corner upper stands in a corner. */
  cornerId?: string;
  /** What it is. A blind corner's blind side is worked out from the run, so `input.blindSide` is ignored on a run. */
  input: CabinetInput;
  position: ItemPosition;
  /** Which way it packs within its stretch, as faced. */
  snap: 'auto' | 'left' | 'right';
}

/** An accepted optimized layout for one material, used only while its signature still matches. */
export interface SavedSheetLayout {
  mat: Material;
  signature: string;
  sheets: SheetLayout[];
}

export interface CabinetsData {
  settings: CabinetSettings;
  runs: CabinetRun[];
  corners: CabinetCorner[];
  /** One ordered list: list order on each run is the order here. */
  items: CabinetItem[];
  /** Grain keys of cut list lines the owner allowed to ignore grain. */
  grainFree: string[];
  sheetLayouts: SavedSheetLayout[];
}

export function emptyCabinets(settings: CabinetSettings = cabinetSettings()): CabinetsData {
  return { settings, runs: [], corners: [], items: [], grainFree: [], sheetLayouts: [] };
}

/** Display label prefix: B base, U upper, T tall, O open space, S shelf, P custom part. */
export function labelPrefix(type: CabinetType): string {
  return BASE_TYPES.has(type) ? 'B' : UPPER_TYPES.has(type) ? 'U' : type === 'tall' ? 'T' : type === 'gap' ? 'O' : type === 'shelf' ? 'S' : 'P';
}

/** Display labels (B1, B2, U1…) in list order, as the prototype numbers its cabinets. Keyed by item id. */
export function itemLabels(items: readonly Pick<CabinetItem, 'id' | 'input'>[]): Map<string, string> {
  const n: Record<string, number> = {};
  const out = new Map<string, string>();
  for (const it of items) {
    const p = labelPrefix(it.input.type);
    n[p] = (n[p] ?? 0) + 1;
    out.set(it.id, p + n[p]);
  }
  return out;
}

/**
 * Removes runs, with their items and corners and the diagonal uppers in those corners. Items that
 * lined up with a removed item go back to list order.
 */
export function removeRuns(data: CabinetsData, runIds: ReadonlySet<string>): { data: CabinetsData; removed: { runs: CabinetRun[]; corners: CabinetCorner[]; items: CabinetItem[] } } {
  const deadRuns = data.runs.filter((r) => runIds.has(r.id));
  if (!deadRuns.length) return { data, removed: { runs: [], corners: [], items: [] } };
  const deadCorners = data.corners.filter((c) => c.runIds.some((id) => runIds.has(id)));
  const deadCornerIds = new Set(deadCorners.map((c) => c.id));
  const deadItems = data.items.filter((it) => (it.runId !== undefined && runIds.has(it.runId)) || (it.cornerId !== undefined && deadCornerIds.has(it.cornerId)));
  const deadItemIds = new Set(deadItems.map((it) => it.id));
  return {
    data: {
      ...data,
      runs: data.runs.filter((r) => !runIds.has(r.id)),
      corners: data.corners.filter((c) => !deadCornerIds.has(c.id)),
      items: withoutItems(data.items, deadItemIds),
    },
    removed: { runs: deadRuns, corners: deadCorners, items: deadItems },
  };
}

/** The items without the given ones; line-ups with a removed item go back to list order. */
export function withoutItems(items: readonly CabinetItem[], ids: ReadonlySet<string>): CabinetItem[] {
  return items
    .filter((it) => !ids.has(it.id))
    .map((it) => (it.position.mode === 'align' && ids.has(it.position.itemId) ? { ...it, position: { mode: 'flow' as const } } : it));
}

/** Drops runs whose walls are all gone (see `removeRuns`). Returns what was dropped so the editor can say so. */
export function pruneCabinets(
  plan: { walls: readonly { id: string }[] },
  data: CabinetsData,
): { data: CabinetsData; removed: { runs: CabinetRun[]; corners: CabinetCorner[]; items: CabinetItem[] } } {
  const wallIds = new Set(plan.walls.map((w) => w.id));
  return removeRuns(data, new Set(data.runs.filter((r) => !r.wallIds.some((id) => wallIds.has(id))).map((r) => r.id)));
}
