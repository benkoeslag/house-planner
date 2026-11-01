/**
 * Inside corners between cabinet runs, found from the plan: two runs whose start corners are the
 * same point and whose walls face into the same corner. As in the prototype, a run has at most one
 * corner, at its start.
 */
import { dot, samePoint } from '../model/geometry';
import type { CabinetCorner } from './project';
import type { RunGeometry } from './runs';

export interface ResolvedCorner {
  id: string;
  runIds: [string, string];
  /** The run whose cabinets run into the corner when there is no blind corner cabinet. */
  owner: string;
  /** True when the corner and its owner come from the saved data. */
  saved: boolean;
}

const INSIDE = 1e-6;

/** Pairs of runs that start at the same inside corner. */
export function findCorners(runs: readonly RunGeometry[]): [RunGeometry, RunGeometry][] {
  const out: [RunGeometry, RunGeometry][] = [];
  const used = new Set<string>();
  for (let i = 0; i < runs.length; i++) {
    const p = runs[i]!;
    if (used.has(p.run.id)) continue;
    for (let j = i + 1; j < runs.length; j++) {
      const q = runs[j]!;
      if (used.has(q.run.id) || !samePoint(p.origin, q.origin)) continue;
      // Each run heads out into the room in front of the other.
      if (dot(q.u, p.n) > INSIDE && dot(p.u, q.n) > INSIDE) {
        out.push([p, q]);
        used.add(p.run.id);
        used.add(q.run.id);
        break;
      }
    }
  }
  return out;
}

/**
 * The corners to lay out: each found pair keeps its saved corner (and owner) if there is one.
 * Otherwise it gets a new corner owned by the run whose positions increase to the right as faced,
 * which is the prototype's default (its right wall). Saved corners whose runs no longer meet are
 * returned as stale.
 */
export function resolveCorners(saved: readonly CabinetCorner[], runs: readonly RunGeometry[]): { corners: ResolvedCorner[]; stale: CabinetCorner[] } {
  const pairs = findCorners(runs);
  const key = (a: string, b: string) => [a, b].sort().join('|');
  const byKey = new Map(saved.map((c) => [key(c.runIds[0], c.runIds[1]), c]));
  const usedSaved = new Set<CabinetCorner>();
  const corners = pairs.map(([p, q]): ResolvedCorner => {
    const s = byKey.get(key(p.run.id, q.run.id));
    if (s && s.runIds.includes(s.owner)) {
      usedSaved.add(s);
      return { id: s.id, runIds: [s.runIds[0], s.runIds[1]], owner: s.owner, saved: true };
    }
    const owner = p.rightward ? p.run.id : q.rightward ? q.run.id : p.run.id;
    if (s) usedSaved.add(s);
    return { id: s?.id ?? `corner:${key(p.run.id, q.run.id)}`, runIds: [p.run.id, q.run.id], owner, saved: false };
  });
  return { corners, stale: saved.filter((c) => !usedSaved.has(c)) };
}
