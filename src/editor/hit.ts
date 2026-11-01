import { along, distance, distanceToSegment, pointInPolygon } from '../model/geometry';
import type { Plan, Point } from '../model/types';
import type { WallGeometry } from '../model/walls';

export type Hit =
  | { kind: 'endpoint'; point: Point }
  | { kind: 'opening'; id: string }
  | { kind: 'wall'; id: string; at: number }
  | null;

/**
 * What is under the pointer, in order of priority: a wall end, a door or window, a wall.
 * `tol` is in inches (the editor converts a few screen pixels into inches).
 */
export function hitTest(plan: Plan, geometry: Map<string, WallGeometry>, p: Point, tol: number): Hit {
  let end: { d: number; point: Point } | null = null;
  for (const w of plan.walls) {
    for (const q of [w.a, w.b]) {
      const d = distance(p, q);
      if (d <= tol && (!end || d < end.d)) end = { d, point: q };
    }
  }
  if (end) return { kind: 'endpoint', point: { ...end.point } };

  for (const o of plan.openings) {
    const g = geometry.get(o.wallId);
    if (!g) continue;
    const t = along(p, g.wall.a, g.dir);
    const off = Math.abs((p.x - g.wall.a.x) * -g.dir.y + (p.y - g.wall.a.y) * g.dir.x);
    if (t >= o.offset - tol / 2 && t <= o.offset + o.width + tol / 2 && off <= g.wall.thickness / 2 + tol) {
      return { kind: 'opening', id: o.id };
    }
  }

  let best: { d: number; id: string; at: number } | null = null;
  for (const g of geometry.values()) {
    const inside = pointInPolygon(p, g.outline);
    const d = inside ? 0 : distanceToSegment(p, g.wall.a, g.wall.b) - g.wall.thickness / 2;
    if (d <= tol && (!best || d < best.d)) best = { d, id: g.wall.id, at: along(p, g.wall.a, g.dir) };
  }
  return best ? { kind: 'wall', id: best.id, at: best.at } : null;
}
