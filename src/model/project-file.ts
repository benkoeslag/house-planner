import type { DoorSwing, Opening, Plan, Point, ProjectSettings, RoomLabel, Wall } from './types';

/** Identifies house planner project files. */
export const FILE_FORMAT = 'house-planner';
/** Current project file version. Bump it, and add a migration, whenever the saved shape changes. */
export const FILE_VERSION = 1;

export interface Project {
  name: string;
  settings: ProjectSettings;
  plan: Plan;
}

export interface ProjectFile extends Project {
  format: typeof FILE_FORMAT;
  version: number;
  units: 'in';
}

export const DEFAULT_SETTINGS: ProjectSettings = { wallThickness: 4.5, wallHeight: 96 };

/** Upgrades a raw document from version `n` to `n + 1`. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** Migrations keyed by the version they upgrade from. Version 1 is the first released format, so there are none yet. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type ParseResult = { ok: true; project: Project; migratedFrom?: number } | { ok: false; error: string };

export function serializeProject(project: Project): string {
  const file: ProjectFile = {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    units: 'in',
    name: project.name,
    settings: project.settings,
    plan: project.plan,
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

    const ids = new Set<string>();
    for (const item of [...plan.walls, ...plan.openings, ...plan.roomLabels]) {
      if (ids.has(item.id)) fail(`The id "${item.id}" is used more than once.`);
      ids.add(item.id);
    }
    const wallIds = new Set(plan.walls.map((w) => w.id));
    for (const o of plan.openings) if (!wallIds.has(o.wallId)) fail(`Opening "${o.id}" is on a wall that does not exist.`);

    return { ok: true, project: { name, settings, plan }, ...(fromVersion < target ? { migratedFrom: fromVersion } : {}) };
  } catch (e) {
    if (e instanceof FileError) return { ok: false, error: `This project file could not be opened: ${e.message}` };
    throw e;
  }
}
