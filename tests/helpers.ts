import { expect } from 'vitest';
import type { Plan, Point, Wall } from '../src/model';

export function expectPoint(actual: Point, x: number, y: number, digits = 6): void {
  expect(actual.x).toBeCloseTo(x, digits);
  expect(actual.y).toBeCloseTo(y, digits);
}

export const wall = (id: string, ax: number, ay: number, bx: number, by: number, thickness = 4.5, height = 96): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness,
  height,
});

export const plan = (walls: Wall[], extra: Partial<Plan> = {}): Plan => ({ walls, openings: [], roomLabels: [], ...extra });

/** A counterclockwise rectangle of walls with its lower-left corner at the origin. */
export function rectangle(w: number, h: number, thickness = 4.5): Wall[] {
  return [
    wall('s', 0, 0, w, 0, thickness),
    wall('e', w, 0, w, h, thickness),
    wall('n', w, h, 0, h, thickness),
    wall('w', 0, h, 0, 0, thickness),
  ];
}

/** Rounds every number to 1e-9 so the comparison ignores floating-point noise only. */
export function settle(v: unknown): unknown {
  if (typeof v === 'number') return Math.round(v * 1e9) / 1e9 + 0;
  if (Array.isArray(v)) return v.map(settle);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = settle(x);
    return out;
  }
  return v;
}
