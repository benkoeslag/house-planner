/**
 * Cabinet edits for the editor. Each takes the project's cabinets and returns new ones (nothing is
 * changed in place), so the editor can keep them in its undo history. Every result keeps the
 * references inside the cabinets valid, so it always saves and opens.
 */
import { dot, distance, samePoint } from '../model/geometry';
import type { IdMaker } from '../model/plan-ops';
import { randomIds } from '../model/plan-ops';
import type { Plan, Point } from '../model/types';
import { wallGeometry } from '../model/walls';
import { findCorners, type ResolvedCorner } from './corners';
import { removeRuns, withoutItems, type CabinetItem, type CabinetRun, type CabinetsData, type ItemPosition } from './project';
import { runGeometry, type RunGeometry } from './runs';
import { BASE_TYPES, type CabinetInput, type CabinetType } from './types';

export type CabinetOp = { ok: true; data: CabinetsData; id?: string } | { ok: false; error: string };
const ok = (data: CabinetsData, id?: string): CabinetOp => ({ ok: true, data, ...(id ? { id } : {}) });
const fail = (error: string): CabinetOp => ({ ok: false, error });

/** A new cabinet's inputs, as the prototype's new cabinets. */
export function defaultInput(type: CabinetType | 'stove'): CabinetInput {
  switch (type) {
    case 'base-drawers':
      return { type, width: 18, drawers: 3, topFront: 6 };
    case 'base-blind':
      return { type, width: 42 };
    case 'upper':
    case 'upper-blind':
      return { type, width: 30 };
    case 'upper-diag':
      return { type, width: 24 };
    case 'shelf':
      return { type, width: 36, name: 'Shelf over fridge', withTop: true };
    case 'gap':
      return { type, width: 24, gapKind: 'dw', name: 'Dishwasher' };
    case 'stove':
      return { type: 'gap', width: 30, gapKind: 'stove', name: 'Stove' };
    case 'panel':
      return { type, width: 24.71875, length: 34.5, name: 'Finished end panel' };
    default:
      return { type, width: 24 };
  }
}

/**
 * Which row of the editor a cabinet is listed in: base (with talls, fridges, open spaces and custom
 * parts, which flow with the bases), upper, or the corner.
 */
export function rowOfInput(input: CabinetInput): 'base' | 'upper' | 'corner' {
  const t = input.type;
  if (BASE_TYPES.has(t) || t === 'tall') return 'base';
  if (t === 'upper' || t === 'upper-blind' || t === 'shelf') return 'upper';
  if (t === 'upper-diag') return 'corner';
  if (t === 'gap') return input.gapKind === 'upper' ? 'upper' : 'base';
  return 'base';
}

const insideCornerAt = (plan: Pick<Plan, 'walls'>, g: RunGeometry): boolean =>
  plan.walls.some((w) => {
    if (g.wallIds.includes(w.id)) return false;
    const at = samePoint(w.a, g.startJoint) ? w.b : samePoint(w.b, g.startJoint) ? w.a : null;
    if (!at) return false;
    const d = { x: at.x - g.startJoint.x, y: at.y - g.startJoint.y };
    return dot(d, g.n) > 1e-6;
  });

/**
 * The run on a wall face: the existing one, or a new one. A new run is measured from an end where
 * another run already starts at an inside corner, otherwise from an inside corner, otherwise from
 * the end nearer the click.
 */
export function runForFace(plan: Pick<Plan, 'walls' | 'openings'>, data: CabinetsData, wallId: string, face: 'left' | 'right', click: Point, ids: IdMaker = randomIds): CabinetOp & { created?: boolean } {
  const geometry = wallGeometry(plan);
  const wg = geometry.get(wallId);
  if (!wg) return fail('That wall does not exist.');
  const probe = (from: 'a' | 'b'): RunGeometry | null => {
    const g = runGeometry(plan, { id: '?', kind: 'wall', wallIds: [wallId], face, from }, geometry);
    return g.ok ? g : null;
  };
  const a = probe('a');
  const b = probe('b');
  if (!a || !b) return fail('That wall does not exist.');
  const existing = data.runs
    .map((r) => runGeometry(plan, r, geometry))
    .filter((g): g is RunGeometry => g.ok)
    .find((g) => g.wallIds.includes(wallId) && dot(g.n, a.n) > 0.9);
  if (existing) return { ...ok(data, existing.run.id), created: false };

  const others = data.runs.map((r) => runGeometry(plan, r, geometry)).filter((g): g is RunGeometry => g.ok);
  const meetsRun = (g: RunGeometry) => findCorners([g, ...others]).some(([p, q]) => p === g || q === g);
  const pick = [a, b].find(meetsRun) ?? ([a, b].filter((g) => insideCornerAt(plan, g)).length === 1 ? [a, b].find((g) => insideCornerAt(plan, g)) : undefined) ?? (distance(click, a.origin) <= distance(click, b.origin) ? a : b);
  const used = new Set(data.runs.map((r) => r.name));
  let n = data.runs.length + 1;
  while (used.has(`Run ${n}`)) n++;
  const run: CabinetRun = { id: ids('run'), kind: 'wall', name: `Run ${n}`, wallIds: [wallId], face, from: pick.run.from };
  return { ...ok({ ...data, runs: [...data.runs, run] }, run.id), created: true };
}

export function updateRun(data: CabinetsData, runId: string, patch: { name?: string; from?: 'a' | 'b' }): CabinetOp {
  if (!data.runs.some((r) => r.id === runId)) return fail('That cabinet run does not exist.');
  const clean = { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() || undefined } : {}) };
  return ok({ ...data, runs: data.runs.map((r) => (r.id === runId ? dropUndefined({ ...r, ...clean }) : r)) });
}

/** Removes a run with its cabinets, its corner, and a diagonal upper in that corner. */
export function removeRun(data: CabinetsData, runId: string): CabinetOp {
  if (!data.runs.some((r) => r.id === runId)) return fail('That cabinet run does not exist.');
  return ok(removeRuns(data, new Set([runId])).data);
}

/** Adds a cabinet at the end of the list (as the prototype). */
export function addItem(data: CabinetsData, item: Omit<CabinetItem, 'id'>, ids: IdMaker = randomIds): CabinetOp {
  if (item.runId !== undefined && !data.runs.some((r) => r.id === item.runId)) return fail('That cabinet run does not exist.');
  if (item.cornerId !== undefined && !data.corners.some((c) => c.id === item.cornerId)) return fail('That corner does not exist.');
  const it: CabinetItem = { ...item, id: ids('cab') };
  return ok({ ...data, items: [...data.items, it] }, it.id);
}

export function updateItem(data: CabinetsData, id: string, patch: { input?: CabinetInput; position?: ItemPosition; snap?: CabinetItem['snap'] }): CabinetOp {
  const it = data.items.find((x) => x.id === id);
  if (!it) return fail('That cabinet does not exist.');
  if (patch.position?.mode === 'align') {
    const target = patch.position.itemId;
    if (target === id) return fail('A cabinet cannot line up with itself.');
    if (!data.items.some((x) => x.id === target)) return fail('That cabinet does not exist.');
  }
  return ok({ ...data, items: data.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
}

/** Moves a cabinet one place up (-1) or down (1) among the cabinets in the same run and row. */
export function moveItem(data: CabinetsData, id: string, dir: -1 | 1): CabinetOp {
  const i = data.items.findIndex((x) => x.id === id);
  const it = data.items[i];
  if (!it) return fail('That cabinet does not exist.');
  if (it.runId === undefined) return ok(data);
  const row = rowOfInput(it.input);
  let j = i + dir;
  while (j >= 0 && j < data.items.length) {
    const o = data.items[j]!;
    if (o.runId === it.runId && rowOfInput(o.input) === row) break;
    j += dir;
  }
  if (j < 0 || j >= data.items.length) return ok(data);
  const items = data.items.slice();
  items[i] = items[j]!;
  items[j] = it;
  return ok({ ...data, items });
}

export function removeItem(data: CabinetsData, id: string): CabinetOp {
  if (!data.items.some((x) => x.id === id)) return fail('That cabinet does not exist.');
  return ok({ ...data, items: withoutItems(data.items, new Set([id])) });
}

/** Saves a found corner (so it can keep an owner or hold a diagonal upper). */
function saveCorner(data: CabinetsData, corner: Pick<ResolvedCorner, 'id' | 'runIds' | 'owner'>): CabinetsData {
  if (data.corners.some((c) => c.id === corner.id)) return data;
  if (!corner.runIds.every((r) => data.runs.some((x) => x.id === r))) return data;
  return { ...data, corners: [...data.corners, { id: corner.id, runIds: [corner.runIds[0], corner.runIds[1]], owner: corner.owner }] };
}

/** Which run's cabinets run into the corner when there is no blind corner cabinet. */
export function setCornerOwner(data: CabinetsData, corner: Pick<ResolvedCorner, 'id' | 'runIds' | 'owner'>, owner: string): CabinetOp {
  if (!corner.runIds.includes(owner)) return fail('The owner must be one of the corner’s two runs.');
  const saved = saveCorner(data, corner);
  if (!saved.corners.some((c) => c.id === corner.id)) return fail('That corner’s runs no longer exist.');
  return ok({ ...saved, corners: saved.corners.map((c) => (c.id === corner.id ? { ...c, owner } : c)) });
}

/** Puts a diagonal corner upper in the corner (one per corner). */
export function addDiagonal(data: CabinetsData, corner: Pick<ResolvedCorner, 'id' | 'runIds' | 'owner'>, ids: IdMaker = randomIds): CabinetOp {
  if (data.items.some((x) => x.cornerId === corner.id && x.input.type === 'upper-diag')) return fail('This corner already has a diagonal corner upper.');
  const saved = saveCorner(data, corner);
  if (!saved.corners.some((c) => c.id === corner.id)) return fail('That corner’s runs no longer exist.');
  return addItem(saved, { cornerId: corner.id, input: defaultInput('upper-diag'), position: { mode: 'flow' }, snap: 'auto' }, ids);
}

function dropUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
