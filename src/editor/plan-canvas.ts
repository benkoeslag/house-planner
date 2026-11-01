import { add, normalize, perpLeft, pointInPolygon, scale, sub } from '../model/geometry';
import { validateOpenings } from '../model/openings';
import { detectRooms, toSquareFeet } from '../model/rooms';
import type { Opening, Plan, Point } from '../model/types';
import { formatFeetInches } from '../model/units';
import type { WallGeometry } from '../model/walls';
import type { Snap } from './snap';

export interface View {
  /** World point at the middle of the canvas. */
  cx: number;
  cy: number;
  /** Screen pixels per inch. */
  s: number;
}

export type Selection = { kind: 'wall'; id: string } | { kind: 'opening'; id: string } | { kind: 'room'; at: Point } | null;

export interface DrawState {
  plan: Plan;
  geometry: Map<string, WallGeometry>;
  view: View;
  width: number;
  height: number;
  selection: Selection;
  /** Show draggable corner handles. */
  handles: boolean;
  /** Wall highlighted under the pointer (door and window tools). */
  hoverWall?: string;
  draft?: { start: Point; end: Point | null; thickness: number };
  snap?: Snap;
}

export function toScreen(v: View, w: number, h: number, p: Point): Point {
  return { x: w / 2 + (p.x - v.cx) * v.s, y: h / 2 - (p.y - v.cy) * v.s };
}

export function toWorld(v: View, w: number, h: number, p: Point): Point {
  return { x: v.cx + (p.x - w / 2) / v.s, y: v.cy - (p.y - h / 2) / v.s };
}

const r1 = (n: number): string => (Math.round(n * 10) / 10).toString();
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** SVG markup for the plan, in screen coordinates. */
export function drawPlan(st: DrawState): string {
  const { plan, geometry, view, width: W, height: H } = st;
  const S = (p: Point) => toScreen(view, W, H, p);
  const pts = (poly: Point[]) => poly.map((p) => { const q = S(p); return `${r1(q.x)},${r1(q.y)}`; }).join(' ');
  const out: string[] = [];

  // Grid: a line every foot, darker every 10 feet, when they are far enough apart to read.
  const spacing = 12 * view.s;
  if (spacing >= 6) {
    const tl = toWorld(view, W, H, { x: 0, y: 0 });
    const br = toWorld(view, W, H, { x: W, y: H });
    const lines: string[] = [];
    const major: string[] = [];
    for (let x = Math.floor(tl.x / 12) * 12; x <= br.x; x += 12) {
      const sx = r1(S({ x, y: 0 }).x);
      (x % 120 === 0 ? major : lines).push(`M${sx} 0V${H}`);
    }
    for (let y = Math.floor(br.y / 12) * 12; y <= tl.y; y += 12) {
      const sy = r1(S({ x: 0, y }).y);
      (y % 120 === 0 ? major : lines).push(`M0 ${sy}H${W}`);
    }
    out.push(`<path class="grid" d="${lines.join('')}"/><path class="grid major" d="${major.join('')}"/>`);
  }

  // Rooms
  const rooms = detectRooms(plan);
  for (const room of rooms) {
    const selected = st.selection?.kind === 'room' && pointInPolygon(st.selection.at, room.centerline);
    out.push(`<polygon class="floor${selected ? ' selected' : ''}" points="${pts(room.interior)}"/>`);
  }

  // Walls
  for (const g of geometry.values()) {
    const sel = st.selection?.kind === 'wall' && st.selection.id === g.wall.id;
    const hover = st.hoverWall === g.wall.id;
    out.push(`<polygon class="wall${sel ? ' selected' : ''}${hover ? ' hover' : ''}" points="${pts(g.outline)}"/>`);
  }

  // Openings
  const problems = new Set(validateOpenings(plan, geometry).map((p) => p.openingId));
  for (const o of plan.openings) {
    const g = geometry.get(o.wallId);
    if (g) out.push(drawOpening(o, g, S, st.selection?.kind === 'opening' && st.selection.id === o.id, problems.has(o.id)));
  }

  // Wall face lengths, on each side of every wall.
  if (view.s >= 0.6) {
    for (const g of geometry.values()) out.push(drawFaceLengths(g, S));
  }

  // Room names and areas
  for (const room of rooms) {
    const at = room.labelId ? plan.roomLabels.find((l) => l.id === room.labelId)!.at : centroid(room.interior);
    const q = S(at);
    const area = `${(Math.round(toSquareFeet(room.area) * 10) / 10).toFixed(1)} sq ft`;
    out.push(
      `<text class="room-name" x="${r1(q.x)}" y="${r1(q.y - 2)}">${esc(room.name ?? 'Unnamed room')}</text>` +
        `<text class="room-area" x="${r1(q.x)}" y="${r1(q.y + 14)}">${area}</text>`,
    );
  }

  // Corner handles
  if (st.handles) {
    const seen: Point[] = [];
    for (const w of plan.walls) {
      for (const p of [w.a, w.b]) {
        if (seen.some((q) => q.x === p.x && q.y === p.y)) continue;
        seen.push(p);
        const q = S(p);
        out.push(`<circle class="handle" cx="${r1(q.x)}" cy="${r1(q.y)}" r="4"/>`);
      }
    }
  }

  // Wall being drawn
  if (st.draft) {
    const { start, end, thickness } = st.draft;
    const qs = S(start);
    out.push(`<circle class="draft-start" cx="${r1(qs.x)}" cy="${r1(qs.y)}" r="5"/>`);
    if (end) {
      const u = normalize(sub(end, start));
      const n = scale(perpLeft(u), thickness / 2);
      out.push(`<polygon class="draft" points="${pts([sub(start, n), sub(end, n), add(end, n), add(start, n)])}"/>`);
      const len = Math.hypot(end.x - start.x, end.y - start.y);
      const mid = S({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
      out.push(`<text class="draft-length" x="${r1(mid.x)}" y="${r1(mid.y - 12)}">${formatFeetInches(len)}</text>`);
    }
  }

  // Snap marker
  if (st.snap && st.snap.kind !== 'grid') {
    const q = S(st.snap.point);
    out.push(
      st.snap.kind === 'endpoint'
        ? `<circle class="snap" cx="${r1(q.x)}" cy="${r1(q.y)}" r="7"/>`
        : `<rect class="snap" x="${r1(q.x - 5)}" y="${r1(q.y - 5)}" width="10" height="10"/>`,
    );
  }
  return out.join('');
}

function drawOpening(o: Opening, g: WallGeometry, S: (p: Point) => Point, selected: boolean, problem: boolean): string {
  const u = g.dir;
  const n = perpLeft(u);
  const half = g.wall.thickness / 2;
  const at = (t: number, side: number) => add(add(g.wall.a, scale(u, t)), scale(n, side));
  const p0 = o.offset;
  const p1 = o.offset + o.width;
  const poly = [at(p0, -half), at(p1, -half), at(p1, half), at(p0, half)].map(S);
  const ptsStr = poly.map((q) => `${r1(q.x)},${r1(q.y)}`).join(' ');
  const cls = `opening ${o.kind}${selected ? ' selected' : ''}${problem ? ' problem' : ''}`;
  const parts = [`<polygon class="gap" points="${ptsStr}"/>`];
  const line = (a: Point, b: Point, c: string) => {
    const qa = S(a);
    const qb = S(b);
    return `<line class="${c}" x1="${r1(qa.x)}" y1="${r1(qa.y)}" x2="${r1(qb.x)}" y2="${r1(qb.y)}"/>`;
  };
  parts.push(line(at(p0, -half), at(p0, half), 'jamb'), line(at(p1, -half), at(p1, half), 'jamb'));
  if (o.kind === 'window') {
    parts.push(line(at(p0, -half / 3), at(p1, -half / 3), 'glass'), line(at(p0, half / 3), at(p1, half / 3), 'glass'));
  } else if (o.kind === 'door') {
    const swing = o.swing ?? { hinge: 'start', side: 'left' };
    const side = swing.side === 'left' ? 1 : -1;
    const hingeT = swing.hinge === 'start' ? p0 : p1;
    const freeT = swing.hinge === 'start' ? p1 : p0;
    const hinge = at(hingeT, side * half);
    const leafEnd = add(hinge, scale(n, side * o.width));
    const closed = at(freeT, side * half);
    parts.push(line(hinge, leafEnd, 'leaf'));
    const c = S(hinge);
    const a = S(leafEnd);
    const b = S(closed);
    const sweep = (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x) > 0 ? 1 : 0;
    const rad = Math.hypot(a.x - c.x, a.y - c.y);
    parts.push(`<path class="swing" d="M${r1(a.x)} ${r1(a.y)}A${r1(rad)} ${r1(rad)} 0 0 ${sweep} ${r1(b.x)} ${r1(b.y)}"/>`);
  }
  return `<g class="${cls}">${parts.join('')}</g>`;
}

function drawFaceLengths(g: WallGeometry, S: (p: Point) => Point): string {
  const u = g.dir;
  const n = perpLeft(u);
  const half = g.wall.thickness / 2;
  const out: string[] = [];
  for (const [face, side] of [[g.faces.left, 1], [g.faces.right, -1]] as const) {
    const len = face.to - face.from;
    if (len < 6) continue;
    const mid = add(add(g.wall.a, scale(u, (face.from + face.to) / 2)), scale(n, side * half));
    const q = S(mid);
    // Push the label off the face by a few pixels, on that face's side.
    const sn = S(add(mid, n));
    const dx = sn.x - q.x;
    const dy = sn.y - q.y;
    const dl = Math.hypot(dx, dy) || 1;
    const x = q.x + (dx / dl) * side * 9;
    const y = q.y + (dy / dl) * side * 9;
    let deg = (Math.atan2(S(add(mid, u)).y - q.y, S(add(mid, u)).x - q.x) * 180) / Math.PI;
    if (deg > 90) deg -= 180;
    if (deg < -90) deg += 180;
    out.push(`<text class="dim" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(deg)})" dy="0.35em">${formatFeetInches(len)}</text>`);
  }
  return out.join('');
}

function centroid(poly: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}
