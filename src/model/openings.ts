import type { Opening, Plan } from './types';
import { wallGeometry, type WallGeometry } from './walls';

export type OpeningProblemKind =
  | 'missing-wall'
  | 'bad-size'
  | 'past-wall-end'
  | 'into-corner'
  | 'into-abutting-wall'
  | 'overlaps-opening'
  | 'taller-than-wall';

export interface OpeningProblem {
  openingId: string;
  kind: OpeningProblemKind;
  message: string;
}

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000);

/** Checks every opening against its wall: inside the wall, clear of corners and walls that butt into it, and not overlapping other openings. */
export function validateOpenings(plan: Plan, geometry: Map<string, WallGeometry> = wallGeometry(plan)): OpeningProblem[] {
  const problems: OpeningProblem[] = [];
  const add = (o: Opening, kind: OpeningProblemKind, message: string) => problems.push({ openingId: o.id, kind, message });

  for (const o of plan.openings) {
    const g = geometry.get(o.wallId);
    if (!g) {
      add(o, 'missing-wall', 'This opening is on a wall that no longer exists.');
      continue;
    }
    if (!(o.width > 0) || !(o.height > 0) || o.sill < 0 || o.offset < 0) {
      add(o, 'bad-size', 'Width and height must be more than 0, and the offset and sill cannot be negative.');
      continue;
    }
    const from = o.offset;
    const to = o.offset + o.width;
    if (to > g.length + 1e-6) {
      add(o, 'past-wall-end', `It runs ${fmt(to - g.length)}" past the end of the wall.`);
    } else if (from < g.clear.from - 1e-6 || to > g.clear.to + 1e-6) {
      add(o, 'into-corner', `It cuts into the corner. Keep it between ${fmt(g.clear.from)}" and ${fmt(g.clear.to)}" along the wall.`);
    }
    for (const ab of g.abutments) {
      if (from < ab.to - 1e-6 && to > ab.from + 1e-6) {
        add(o, 'into-abutting-wall', `It runs into the wall that meets this one between ${fmt(ab.from)}" and ${fmt(ab.to)}".`);
      }
    }
    for (const other of plan.openings) {
      if (other.id === o.id || other.wallId !== o.wallId) continue;
      if (from < other.offset + other.width - 1e-6 && to > other.offset + 1e-6) {
        add(o, 'overlaps-opening', 'It overlaps another opening on the same wall.');
      }
    }
    if (o.sill + o.height > g.wall.height + 1e-6) {
      add(o, 'taller-than-wall', `Its top is ${fmt(o.sill + o.height - g.wall.height)}" above the top of the wall.`);
    }
  }
  return problems;
}
