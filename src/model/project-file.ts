import { emptyCabinets, type CabinetCorner, type CabinetItem, type CabinetRun, type CabinetsData, type ItemPosition, type SavedSheetLayout } from '../cabinets/project';
import { DEFAULT_CABINET_SETTINGS, type CabinetSettings } from '../cabinets/settings';
import type { CabinetInput, CabinetType } from '../cabinets/types';
import type { DoorSwing, Opening, Plan, Point, ProjectSettings, RoomLabel, Wall } from './types';

/** Identifies house planner project files. */
export const FILE_FORMAT = 'house-planner';
/** Current project file version. Bump it, and add a migration, whenever the saved shape changes. */
export const FILE_VERSION = 2;

export interface Project {
  name: string;
  settings: ProjectSettings;
  plan: Plan;
  /** Cabinet runs, corners, items, cabinet settings and prices (file version 2, ADR-003). */
  cabinets: CabinetsData;
}

/** The saved shape: cabinet settings sit in `settings.cabinets`, the rest in a top-level `cabinets`. */
export interface ProjectFile {
  format: typeof FILE_FORMAT;
  version: number;
  units: 'in';
  name: string;
  settings: ProjectSettings & { cabinets: CabinetSettings };
  plan: Plan;
  cabinets: Omit<CabinetsData, 'settings'>;
}

export const DEFAULT_SETTINGS: ProjectSettings = { wallThickness: 4.5, wallHeight: 96 };

/** Upgrades a raw document from version `n` to `n + 1`. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** Migrations keyed by the version they upgrade from. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Version 2 adds cabinets (ADR-003): an empty cabinets section and the default cabinet settings.
  1: (doc) => {
    const settings = isObj(doc.settings) ? doc.settings : {};
    return {
      ...doc,
      settings: { ...settings, cabinets: { ...DEFAULT_CABINET_SETTINGS, slideLengths: [...DEFAULT_CABINET_SETTINGS.slideLengths] } },
      cabinets: { runs: [], corners: [], items: [], grainFree: [], sheetLayouts: [] },
    };
  },
};

export type ParseResult = { ok: true; project: Project; migratedFrom?: number } | { ok: false; error: string };

export function serializeProject(project: Project): string {
  const file: ProjectFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    units: 'in',
    name: project.name,
    settings: { ...project.settings, cabinets: project.cabinets.settings },
    plan: project.plan,
    cabinets: {
      runs: project.cabinets.runs,
      corners: project.cabinets.corners,
      items: project.cabinets.items,
      grainFree: project.cabinets.grainFree,
      sheetLayouts: project.cabinets.sheetLayouts,
    },
  };
  return JSON.stringify(file, null, 2) + '\n';
}

class FileError extends Error {}

const fail = (msg: string): never => {
  throw new FileError(msg);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, where: string, opts: { min?: number; positive?: boolean } = {}): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${where} must be a number.`);
  const n = v as number;
  if (opts.positive && !(n > 0)) fail(`${where} must be more than 0.`);
  if (opts.min !== undefined && n < opts.min) fail(`${where} cannot be less than ${opts.min}.`);
  return n;
}
function str(v: unknown, where: string): string {
  if (typeof v !== 'string' || !v) fail(`${where} must be text.`);
  return v as string;
}
function point(v: unknown, where: string): Point {
  if (!isObj(v)) fail(`${where} must be a point.`);
  const p = v as Record<string, unknown>;
  return { x: num(p.x, `${where}.x`), y: num(p.y, `${where}.y`) };
}
function list(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(`${where} must be a list.`);
  return v as unknown[];
}

function readWall(v: unknown, where: string): Wall {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const w = v as Record<string, unknown>;
  return {
    id: str(w.id, `${where}.id`),
    a: point(w.a, `${where}.a`),
    b: point(w.b, `${where}.b`),
    thickness: num(w.thickness, `${where}.thickness`, { positive: true }),
    height: num(w.height, `${where}.height`, { positive: true }),
  };
}

function readOpening(v: unknown, where: string): Opening {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== 'door' && kind !== 'window' && kind !== 'opening') fail(`${where}.kind must be door, window or opening.`);
  const out: Opening = {
    id: str(o.id, `${where}.id`),
    wallId: str(o.wallId, `${where}.wallId`),
    kind: kind as Opening['kind'],
    offset: num(o.offset, `${where}.offset`, { min: 0 }),
    width: num(o.width, `${where}.width`, { positive: true }),
    height: num(o.height, `${where}.height`, { positive: true }),
    sill: num(o.sill, `${where}.sill`, { min: 0 }),
  };
  if (o.swing !== undefined) {
    if (!isObj(o.swing)) fail(`${where}.swing must be an object.`);
    const s = o.swing as Record<string, unknown>;
    if (s.hinge !== 'start' && s.hinge !== 'end') fail(`${where}.swing.hinge must be start or end.`);
    if (s.side !== 'left' && s.side !== 'right') fail(`${where}.swing.side must be left or right.`);
    out.swing = { hinge: s.hinge, side: s.side } as DoorSwing;
  }
  return out;
}

function readLabel(v: unknown, where: string): RoomLabel {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const l = v as Record<string, unknown>;
  return { id: str(l.id, `${where}.id`), name: str(l.name, `${where}.name`), at: point(l.at, `${where}.at`) };
}

// ---- cabinets (version 2)

const ZERO_OK = new Set(['trim', 'grooveD', 'btmClear', 'counterGap', 'kickSetback', 'shelfClear', 'shelfSetback', 'counterOverhang', 'spareBox']);
function oneOf<T extends string | number>(v: unknown, where: string, options: readonly T[]): T {
  if (!options.includes(v as T)) fail(`${where} must be one of ${options.join(', ')}.`);
  return v as T;
}
function bool(v: unknown, where: string): boolean {
  if (typeof v !== 'boolean') fail(`${where} must be true or false.`);
  return v as boolean;
}
function text(v: unknown, where: string): string {
  if (typeof v !== 'string') fail(`${where} must be text.`);
  return v as string;
}

function readCabinetSettings(v: unknown, where: string): CabinetSettings {
  if (v === undefined) return { ...DEFAULT_CABINET_SETTINGS, slideLengths: [...DEFAULT_CABINET_SETTINGS.slideLengths] };
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, def] of Object.entries(DEFAULT_CABINET_SETTINGS)) {
    const x = o[k];
    const at = `${where}.${k}`;
    if (x === undefined) out[k] = Array.isArray(def) ? [...def] : def;
    else if (k === 'slideLengths') out[k] = list(x, at).map((n, i) => num(n, `${at}[${i}]`, { positive: true }));
    else if (k === 'drawerGrain') out[k] = oneOf(x, at, ['horizontal', 'vertical'] as const);
    else if (k === 'round') out[k] = oneOf(x, at, [16, 32] as const);
    else if (k === 'gapAt') out[k] = oneOf(x, at, ['corner', 'fixed'] as const);
    else if (typeof def === 'boolean') out[k] = bool(x, at);
    else if (k.startsWith('price') || k === 'taxRate' || ZERO_OK.has(k)) out[k] = num(x, at, { min: 0 });
    else out[k] = num(x, at, { positive: true });
  }
  return out as unknown as CabinetSettings;
}

const CABINET_TYPES: readonly CabinetType[] = ['base-doors', 'base-drawers', 'base-drawer-door', 'base-blind', 'upper', 'upper-diag', 'upper-blind', 'shelf', 'tall', 'gap', 'panel'];
const NUMBER_FIELDS = ['height', 'depth', 'shelves', 'drawers', 'topFront', 'lowerDoor', 'filler', 'gableDepth', 'gableHeight', 'shelfAt', 'quantity', 'length'] as const;
const BOOL_FIELDS = ['falseFront', 'hingeFlip', 'gables', 'withTop'] as const;

function readInput(v: unknown, where: string): CabinetInput {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const out: CabinetInput = { type: oneOf(o.type, `${where}.type`, CABINET_TYPES), width: num(o.width, `${where}.width`) };
  if (o.name !== undefined) out.name = text(o.name, `${where}.name`);
  for (const k of NUMBER_FIELDS) if (o[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = num(o[k], `${where}.${k}`);
  for (const k of BOOL_FIELDS) if (o[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = bool(o[k], `${where}.${k}`);
  if (o.doors !== undefined) out.doors = oneOf(o.doors, `${where}.doors`, ['auto', 'none', 'left', 'right', 'pair'] as const);
  if (o.tallRows !== undefined) out.tallRows = oneOf(o.tallRows, `${where}.tallRows`, [1, 2] as const);
  if (o.blindSide !== undefined) out.blindSide = oneOf(o.blindSide, `${where}.blindSide`, ['left', 'right'] as const);
  if (o.blindTop !== undefined) out.blindTop = oneOf(o.blindTop, `${where}.blindTop`, ['drawer', 'false', 'none'] as const);
  if (o.gapKind !== undefined) out.gapKind = oneOf(o.gapKind, `${where}.gapKind`, ['dw', 'fridge', 'base', 'upper', 'full', 'stove'] as const);
  if (o.material !== undefined) out.material = oneOf(o.material, `${where}.material`, ['box', 'back', 'drw'] as const);
  if (o.band !== undefined) out.band = oneOf(o.band, `${where}.band`, ['none', '1L', '2L', '1L1W', 'all'] as const);
  return out;
}

function readPosition(v: unknown, where: string): ItemPosition {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const mode = oneOf(o.mode, `${where}.mode`, ['flow', 'opening', 'follow', 'at', 'align'] as const);
  if (mode === 'opening') return { mode, openingId: str(o.openingId, `${where}.openingId`) };
  if (mode === 'at') return { mode, at: num(o.at, `${where}.at`) };
  if (mode === 'align') return { mode, itemId: str(o.itemId, `${where}.itemId`), side: oneOf(o.side, `${where}.side`, ['left', 'right', 'center'] as const) };
  return { mode };
}

function readRun(v: unknown, where: string): CabinetRun {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const wallIds = list(o.wallIds, `${where}.wallIds`).map((x, i) => str(x, `${where}.wallIds[${i}]`));
  if (!wallIds.length) fail(`${where}.wallIds must name at least one wall.`);
  return {
    id: str(o.id, `${where}.id`),
    kind: oneOf(o.kind, `${where}.kind`, ['wall'] as const),
    ...(o.name !== undefined ? { name: text(o.name, `${where}.name`) } : {}),
    wallIds,
    face: oneOf(o.face, `${where}.face`, ['left', 'right'] as const),
    from: oneOf(o.from, `${where}.from`, ['a', 'b'] as const),
  };
}

function readCorner(v: unknown, where: string): CabinetCorner {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const runIds = list(o.runIds, `${where}.runIds`).map((x, i) => str(x, `${where}.runIds[${i}]`));
  if (runIds.length !== 2 || runIds[0] === runIds[1]) fail(`${where}.runIds must name two different runs.`);
  const owner = str(o.owner, `${where}.owner`);
  if (!runIds.includes(owner)) fail(`${where}.owner must be one of its two runs.`);
  return { id: str(o.id, `${where}.id`), runIds: [runIds[0]!, runIds[1]!], owner };
}

function readItem(v: unknown, where: string): CabinetItem {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const runId = o.runId === undefined ? undefined : str(o.runId, `${where}.runId`);
  const cornerId = o.cornerId === undefined ? undefined : str(o.cornerId, `${where}.cornerId`);
  if (runId !== undefined && cornerId !== undefined) fail(`${where} cannot be both on a run and in a corner.`);
  return {
    id: str(o.id, `${where}.id`),
    ...(runId !== undefined ? { runId } : {}),
    ...(cornerId !== undefined ? { cornerId } : {}),
    input: readInput(o.input, `${where}.input`),
    position: readPosition(o.position ?? { mode: 'flow' }, `${where}.position`),
    snap: o.snap === undefined ? 'auto' : oneOf(o.snap, `${where}.snap`, ['auto', 'left', 'right'] as const),
  };
}

function readSheetLayout(v: unknown, where: string): SavedSheetLayout {
  if (!isObj(v)) fail(`${where} must be an object.`);
  const o = v as Record<string, unknown>;
  const sheets = list(o.sheets, `${where}.sheets`).map((sh, i) => {
    const at = `${where}.sheets[${i}]`;
    if (!isObj(sh)) fail(`${at} must be an object.`);
    const so = sh as Record<string, unknown>;
    const strips = list(so.strips, `${at}.strips`).map((st, j) => {
      const sa = `${at}.strips[${j}]`;
      if (!isObj(st)) fail(`${sa} must be an object.`);
      const t = st as Record<string, unknown>;
      const parts = list(t.parts, `${sa}.parts`).map((p, k) => {
        const pa = `${sa}.parts[${k}]`;
        if (!isObj(p)) fail(`${pa} must be an object.`);
        const q = p as Record<string, unknown>;
        return { x: num(q.x, `${pa}.x`), y: num(q.y, `${pa}.y`), L: num(q.L, `${pa}.L`, { positive: true }), W: num(q.W, `${pa}.W`, { positive: true }), num: num(q.num, `${pa}.num`, { min: 1 }) };
      });
      return {
        y: num(t.y, `${sa}.y`),
        w: num(t.w, `${sa}.w`, { positive: true }),
        ...(t.used !== undefined ? { used: num(t.used, `${sa}.used`) } : {}),
        ...(t.usedL !== undefined ? { usedL: num(t.usedL, `${sa}.usedL`) } : {}),
        parts,
      };
    });
    return { strips, area: num(so.area, `${at}.area`, { min: 0 }), yield: num(so.yield, `${at}.yield`, { min: 0 }) };
  });
  return { mat: oneOf(o.mat, `${where}.mat`, ['box', 'back', 'drw'] as const), signature: text(o.signature, `${where}.signature`), sheets };
}

/**
 * Reads the cabinets section. References inside it (an item's run or corner, a corner's runs, a
 * line-up target) must exist. References to the plan are allowed to dangle: a wall or window can be
 * deleted in the editor, and the layout reports the cabinets it affects instead of losing them.
 */
function readCabinets(doc: Record<string, unknown>, settingsDoc: Record<string, unknown>): CabinetsData {
  const settings = readCabinetSettings(settingsDoc.cabinets, 'settings.cabinets');
  if (doc.cabinets === undefined) return emptyCabinets(settings);
  if (!isObj(doc.cabinets)) fail('cabinets must be an object.');
  const c = doc.cabinets as Record<string, unknown>;
  const runs = list(c.runs ?? [], 'cabinets.runs').map((r, i) => readRun(r, `cabinets.runs[${i}]`));
  const corners = list(c.corners ?? [], 'cabinets.corners').map((r, i) => readCorner(r, `cabinets.corners[${i}]`));
  const items = list(c.items ?? [], 'cabinets.items').map((r, i) => readItem(r, `cabinets.items[${i}]`));
  const grainFree = list(c.grainFree ?? [], 'cabinets.grainFree').map((g, i) => text(g, `cabinets.grainFree[${i}]`));
  const sheetLayouts = list(c.sheetLayouts ?? [], 'cabinets.sheetLayouts').map((l, i) => readSheetLayout(l, `cabinets.sheetLayouts[${i}]`));

  const ids = new Set<string>();
  for (const x of [...runs, ...corners, ...items]) {
    if (ids.has(x.id)) fail(`The cabinet id "${x.id}" is used more than once.`);
    ids.add(x.id);
  }
  const runIds = new Set(runs.map((r) => r.id));
  const cornerIds = new Set(corners.map((r) => r.id));
  const itemIds = new Set(items.map((r) => r.id));
  for (const k of corners) for (const r of k.runIds) if (!runIds.has(r)) fail(`Corner "${k.id}" names a run that does not exist.`);
  items.forEach((it, i) => {
    const where = `cabinets.items[${i}]`;
    if (it.runId !== undefined && !runIds.has(it.runId)) fail(`${where} is on a run that does not exist.`);
    if (it.cornerId !== undefined && !cornerIds.has(it.cornerId)) fail(`${where} is in a corner that does not exist.`);
    if (it.position.mode === 'align' && !itemIds.has(it.position.itemId)) fail(`${where}.position lines up with a cabinet that does not exist.`);
  });
  return { settings, runs, corners, items, grainFree, sheetLayouts };
}

/** Applies migrations until the document reaches `target`. Exposed with injectable migrations for testing. */
export function migrate(
  doc: Record<string, unknown>,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = FILE_VERSION,
): Record<string, unknown> {
  let current = doc;
  let version = num(current.version, 'version');
  if (!Number.isInteger(version) || version < 0) fail('version must be a whole number.');
  if (version > target) {
    fail(`This file was saved by a newer version of House Planner (file version ${version}; this app reads up to ${target}). Update the app to open it.`);
  }
  while (version < target) {
    const step = migrations[version];
    if (!step) fail(`Files from version ${version} can no longer be opened.`);
    current = step!(current);
    version += 1;
    current = { ...current, version };
  }
  return current;
}

/** Reads a project file, upgrading older versions. Never throws; problems come back as a readable message. */
export function parseProject(
  text: string,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = FILE_VERSION,
): ParseResult {
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: 'This is not a House Planner project file (it is not valid JSON).' };
    }
    if (!isObj(raw) || raw.format !== FILE_FORMAT) {
      return { ok: false, error: 'This is not a House Planner project file.' };
    }
    if (raw.units !== undefined && raw.units !== 'in') fail('Only inch units are supported.');
    const fromVersion = num(raw.version, 'version');
    const doc = migrate(raw, migrations, target);

    const name = typeof doc.name === 'string' ? doc.name : 'Untitled';
    const s = isObj(doc.settings) ? doc.settings : {};
    const settings: ProjectSettings = {
      wallThickness: s.wallThickness === undefined ? DEFAULT_SETTINGS.wallThickness : num(s.wallThickness, 'settings.wallThickness', { positive: true }),
      wallHeight: s.wallHeight === undefined ? DEFAULT_SETTINGS.wallHeight : num(s.wallHeight, 'settings.wallHeight', { positive: true }),
    };
    if (!isObj(doc.plan)) fail('plan is missing.');
    const p = doc.plan as Record<string, unknown>;
    const plan: Plan = {
      walls: list(p.walls, 'plan.walls').map((w, i) => readWall(w, `plan.walls[${i}]`)),
      openings: list(p.openings ?? [], 'plan.openings').map((o, i) => readOpening(o, `plan.openings[${i}]`)),
      roomLabels: list(p.roomLabels ?? [], 'plan.roomLabels').map((l, i) => readLabel(l, `plan.roomLabels[${i}]`)),
    };

    const cabinets = readCabinets(doc, s);

    const ids = new Set<string>();
    for (const item of [...plan.walls, ...plan.openings, ...plan.roomLabels]) {
      if (ids.has(item.id)) fail(`The id "${item.id}" is used more than once.`);
      ids.add(item.id);
    }
    const wallIds = new Set(plan.walls.map((w) => w.id));
    for (const o of plan.openings) if (!wallIds.has(o.wallId)) fail(`Opening "${o.id}" is on a wall that does not exist.`);

    return { ok: true, project: { name, settings, plan, cabinets }, ...(fromVersion < target ? { migratedFrom: fromVersion } : {}) };
  } catch (e) {
    if (e instanceof FileError) return { ok: false, error: `This project file could not be opened: ${e.message}` };
    throw e;
  }
}
