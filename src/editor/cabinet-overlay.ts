/**
 * Cabinet footprints on the plan, in world coordinates: one shape per placed cabinet, the diagonal
 * corner uppers, and a line along each run's wall face.
 */
import { add, cross, distanceToSegment, pointInPolygon, scale, sub } from '../model/geometry';
import type { Point } from '../model/types';
import type { WallGeometry } from '../model/walls';
import type { CabinetPlan, PlacedItem } from '../cabinets/layout';
import { runPoint } from '../cabinets/runs';
import type { CabinetSettings } from '../cabinets/settings';
import { BASE_TYPES, type DiagonalCorner } from '../cabinets/types';

export type ShapeKind = 'base' | 'tall' | 'upper' | 'stove' | 'gap' | 'panel' | 'corner';

export interface CabinetShape {
  points: Point[];
  kind: ShapeKind;
  label: string;
  itemId: string;
  /** The run it stands on; a corner cabinet names one of its corner's runs. */
  runId: string;
  /** It has a problem to fix. */
  bad: boolean;
}

export interface RunFace {
  runId: string;
  from: Point;
  to: Point;
}

export interface CabinetOverlay {
  shapes: CabinetShape[];
  faces: RunFace[];
}

function kindOf(p: PlacedItem): ShapeKind {
  const t = p.item.input.type;
  if (BASE_TYPES.has(t)) return 'base';
  if (t === 'tall') return 'tall';
  if (t === 'upper' || t === 'upper-blind' || t === 'shelf') return 'upper';
  if (t === 'panel') return 'panel';
  return p.item.input.gapKind === 'stove' ? 'stove' : 'gap';
}

function depthOf(p: PlacedItem, s: CabinetSettings): number {
  const i = p.item.input;
  if (i.type === 'panel') return i.width > 0 ? i.width : s.baseD;
  if (i.type === 'gap') {
    const k = i.gapKind ?? 'dw';
    return k === 'upper' ? s.upperD : k === 'fridge' || k === 'full' ? s.tallD : s.baseD;
  }
  return p.built.D > 0 ? p.built.D : s.baseD;
}

export function cabinetOverlay(planned: CabinetPlan, s: CabinetSettings): CabinetOverlay {
  const bad = new Set(planned.warns.filter((w) => w.lvl === 'bad').map((w) => w.id));
  const shapes: CabinetShape[] = [];
  const faces: RunFace[] = [];
  for (const w of planned.runs) {
    const g = w.geometry;
    faces.push({ runId: g.run.id, from: runPoint(g, 0), to: runPoint(g, g.length) });
    for (const p of [...w.items, ...w.stoves]) {
      const d = depthOf(p, s);
      shapes.push({
        points: [runPoint(g, p.a), runPoint(g, p.b), runPoint(g, p.b, d), runPoint(g, p.a, d)],
        kind: kindOf(p),
        label: p.label,
        itemId: p.item.id,
        runId: g.run.id,
        bad: bad.has(p.label),
      });
    }
  }
  for (const c of planned.corners) {
    const diag = c.diagonal;
    if (!diag) continue;
    const [r1, r2] = c.runIds.map((id) => planned.runs.find((w) => w.geometry.run.id === id)?.geometry);
    if (!r1 || !r2) continue;
    const { L, d } = diag.built.corner as DiagonalCorner;
    const O = r1.origin;
    const a = add(O, scale(r1.u, L));
    const b = add(O, scale(r2.u, L));
    shapes.push({ points: [O, a, add(a, scale(r1.n, d)), add(b, scale(r2.n, d)), b], kind: 'corner', label: diag.label, itemId: diag.item.id, runId: r1.run.id, bad: bad.has(diag.label) });
  }
  return { shapes, faces };
}

/** The cabinet under a point: uppers first when `upperFirst`, otherwise floor cabinets first. */
export function cabinetAt(o: CabinetOverlay, p: Point, upperFirst: boolean): CabinetShape | undefined {
  const isUpper = (sh: CabinetShape) => sh.kind === 'upper' || sh.kind === 'corner';
  const hits = o.shapes.filter((sh) => pointInPolygon(p, sh.points));
  return hits.find((sh) => isUpper(sh) === upperFirst) ?? hits[0];
}

/**
 * The wall face nearest a point, within `reach` inches in front of it (or on the wall itself):
 * the wall, which face (looking from its `a` to its `b`), and the distance.
 */
export function faceAt(geometry: Map<string, WallGeometry>, p: Point, reach: number): { wallId: string; face: 'left' | 'right' } | undefined {
  let best: { d: number; wallId: string; face: 'left' | 'right' } | undefined;
  for (const g of geometry.values()) {
    const t = (p.x - g.wall.a.x) * g.dir.x + (p.y - g.wall.a.y) * g.dir.y;
    if (t < 0 || t > g.length) continue;
    const d = Math.max(0, distanceToSegment(p, g.wall.a, g.wall.b) - g.wall.thickness / 2);
    if (d > reach) continue;
    const face = cross(g.dir, sub(p, g.wall.a)) >= 0 ? 'left' : 'right';
    if (!best || d < best.d) best = { d, wallId: g.wall.id, face };
  }
  return best && { wallId: best.wallId, face: best.face };
}
