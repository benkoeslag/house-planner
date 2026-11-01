import {
  JOIN_TOLERANCE,
  add,
  angleOf,
  distance,
  distanceToSegment,
  dot,
  lineIntersection,
  normalize,
  perpLeft,
  pointInPolygon,
  samePoint,
  scale,
  signedArea,
  sub,
} from './geometry';
import type { Plan, Point } from './types';

export interface Room {
  /** Stable while the room's corners stay put; built from its corner coordinates. */
  key: string;
  /** Name from the room label inside the room, if any. */
  name?: string;
  labelId?: string;
  /** Room outline along the wall centerlines, counterclockwise. */
  centerline: Point[];
  /** Room outline along the inside faces of the walls, counterclockwise. */
  interior: Point[];
  /** Floor area inside the walls, in square inches. */
  area: number;
}

interface Edge {
  from: number;
  to: number;
  half: number;
}

const SQ_IN_PER_SQ_FT = 144;
export const toSquareFeet = (sqIn: number): number => sqIn / SQ_IN_PER_SQ_FT;

/**
 * Finds enclosed rooms. Walls are split wherever another wall ends on them, walls
 * that lead nowhere (free ends) are ignored, and every enclosed face of what is left
 * becomes a room.
 */
export function detectRooms(plan: Plan): Room[] {
  const walls = plan.walls.filter((w) => distance(w.a, w.b) > JOIN_TOLERANCE);
  const nodes: Point[] = [];
  const nodeIndex = (p: Point): number => {
    const i = nodes.findIndex((q) => samePoint(p, q));
    if (i >= 0) return i;
    nodes.push(p);
    return nodes.length - 1;
  };
  for (const w of walls) {
    nodeIndex(w.a);
    nodeIndex(w.b);
  }

  // Split each wall at every junction lying along it.
  const edges: Edge[] = [];
  for (const w of walls) {
    const u = normalize(sub(w.b, w.a));
    const stops = nodes
      .map((p, i) => ({ i, t: dot(sub(p, w.a), u), p }))
      .filter((s) => distanceToSegment(s.p, w.a, w.b) <= JOIN_TOLERANCE)
      .sort((s1, s2) => s1.t - s2.t);
    for (let k = 0; k + 1 < stops.length; k++) {
      const from = stops[k]!.i;
      const to = stops[k + 1]!.i;
      if (from !== to && !edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) {
        edges.push({ from, to, half: w.thickness / 2 });
      }
    }
  }

  // Drop walls with a free end, repeatedly, so stubs and partial walls do not distort rooms.
  let live = edges.slice();
  for (;;) {
    const degree = new Map<number, number>();
    for (const e of live) {
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    }
    const kept = live.filter((e) => degree.get(e.from)! > 1 && degree.get(e.to)! > 1);
    if (kept.length === live.length) break;
    live = kept;
  }

  // Half-edges, each with the room on its left. Outgoing half-edges per node sorted counterclockwise.
  interface Half {
    from: number;
    to: number;
    half: number;
    angle: number;
    used: boolean;
  }
  const halves: Half[] = [];
  for (const e of live) {
    const a = nodes[e.from]!;
    const b = nodes[e.to]!;
    halves.push({ from: e.from, to: e.to, half: e.half, angle: angleOf(sub(b, a)), used: false });
    halves.push({ from: e.to, to: e.from, half: e.half, angle: angleOf(sub(a, b)), used: false });
  }
  const outgoing = new Map<number, Half[]>();
  for (const h of halves) {
    const list = outgoing.get(h.from) ?? [];
    list.push(h);
    outgoing.set(h.from, list);
  }
  for (const list of outgoing.values()) list.sort((p, q) => p.angle - q.angle);

  const rooms: Room[] = [];
  for (const start of halves) {
    if (start.used) continue;
    const face: Half[] = [];
    let h: Half | undefined = start;
    while (h && !h.used) {
      h.used = true;
      face.push(h);
      // Next edge: at the far node, the outgoing edge just clockwise of the way back.
      const list: Half[] = outgoing.get(h.to)!;
      const back: number = list.findIndex((o) => o.to === h!.from);
      h = list[(back - 1 + list.length) % list.length];
    }
    const centerline = face.map((f) => nodes[f.from]!);
    if (face.length < 3 || signedArea(centerline) <= 1e-6) continue; // the outside of the building

    const interior = insetPolygon(centerline, face.map((f) => f.half));
    rooms.push({ key: roomKey(centerline), centerline, interior, area: signedArea(interior) });
  }

  for (const label of plan.roomLabels) {
    const room = rooms.find((r) => !r.labelId && pointInPolygon(label.at, r.centerline));
    if (room) {
      room.name = label.name;
      room.labelId = label.id;
    }
  }
  return rooms;
}

/** Moves each edge of a counterclockwise polygon inward by its own distance. */
function insetPolygon(poly: Point[], insets: number[]): Point[] {
  const n = poly.length;
  const line = (i: number) => {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const d = normalize(sub(b, a));
    return { p: add(a, scale(perpLeft(d), insets[i]!)), d };
  };
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = line((i - 1 + n) % n);
    const cur = line(i);
    out.push(lineIntersection(prev.p, prev.d, cur.p, cur.d) ?? cur.p);
  }
  return out;
}

function roomKey(poly: Point[]): string {
  const pts = poly.map((p) => `${Math.round(p.x * 64)},${Math.round(p.y * 64)}`);
  const first = pts.indexOf(pts.slice().sort()[0]!);
  return pts.slice(first).concat(pts.slice(0, first)).join(';');
}
