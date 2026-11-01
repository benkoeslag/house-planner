/**
 * Lays out cabinets on runs: row starts at corners, openings and stove spaces, fixed positions,
 * flow, snapping, the leftover gaps and every layout warning, then the countertop, toe kick strips
 * and platform runs. A port of the prototype's `layoutWalls`, the countertop in `renderWall`, and
 * `addToeKick`, generalized from its two walls to runs on the plan (ADR-003); the rules are in
 * docs/cabinet-rules.md → "Wall layout", "Countertop" and "Toe kick and platform".
 */
import type { Plan } from '../model/types';
import { wallGeometry } from '../model/walls';
import { buildCabinet } from './build';
import { resolveCorners, type ResolvedCorner } from './corners';
import { fmt } from './format';
import { itemLabels, type CabinetCorner, type CabinetItem, type CabinetsData } from './project';
import { runGeometry, type RunGeometry } from './runs';
import type { CabinetSettings } from './settings';
import { BASE_TYPES, type BlindCorner, type BuiltCabinet, type CabinetWarning, type DiagonalCorner, type Part } from './types';

export type Row = 'base' | 'full' | 'upper' | 'corner';

export interface PlacedItem {
  item: CabinetItem;
  built: BuiltCabinet;
  /** Display label, for example `B1`. */
  label: string;
  row: Row;
  /** Start and end along the run. */
  a: number;
  b: number;
  fixed: boolean;
}

export interface RowGap {
  row: 'base' | 'upper';
  a: number;
  b: number;
  /** What comes after the gap: a label, or `stove`, `window`, `door`, `opening`, `tall cabinet`. */
  before: string;
  /** The gap is at the row start: the corner spare. */
  corner: boolean;
}

export interface RunLayout {
  geometry: RunGeometry;
  name: string;
  /** Where the base and upper rows start, from the run's start corner. */
  lowStart: number;
  upStart: number;
  lowEnd: number;
  upEnd: number;
  /** Placed items in layout order: the base row (with full-height items), then the upper row. */
  items: PlacedItem[];
  /** Stove spaces on this run. */
  stoves: PlacedItem[];
  gaps: RowGap[];
  /** Center of the first window, when there is a sink base to check against it. */
  winCenter?: number;
  /** How far the sink base's center is from the window center (positive: farther from the corner). */
  sinkOff?: number;
  /** Countertop pieces, including the end overhangs. */
  counters: { a: number; b: number }[];
  /** Runs of base cabinets and talls (toe kick and platform). */
  kickRuns: { a: number; b: number }[];
}

export interface CornerLayout extends ResolvedCorner {
  blind?: PlacedItem;
  blindUpper?: PlacedItem;
  diagonal?: { item: CabinetItem; built: BuiltCabinet; label: string };
  /** How far the blind corner cabinet sits from the corner. */
  blindGap?: number;
  blindUpperGap?: number;
}

export interface CabinetPlan {
  /** Every item built, in list order. */
  built: { item: CabinetItem; built: BuiltCabinet; label: string }[];
  runs: RunLayout[];
  corners: CornerLayout[];
  /** Runs that could not be placed (their walls are gone), and saved corners whose runs no longer meet. */
  brokenRuns: { runId: string; reason: string }[];
  staleCorners: CabinetCorner[];
  /** Every part, including toe kick strips. */
  parts: Part[];
  /** Build warnings in list order, then layout warnings. */
  warns: CabinetWarning[];
  /** Lengths of the platform runs (for consumables). */
  platformRuns: number[];
}

const EPS = 1e-6;
const okDim = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const widthOf = (x: BuiltCabinet) => x.EW || x.W;

function rowOf(item: CabinetItem, x: BuiltCabinet, s: CabinetSettings): Row | 'stove' | null {
  const t = item.input.type;
  if (BASE_TYPES.has(t)) return 'base';
  if (t === 'tall') return 'full';
  if (t === 'upper' || t === 'upper-blind' || t === 'shelf') return 'upper';
  if (t === 'upper-diag') return 'corner';
  if (t === 'gap') {
    const k = item.input.gapKind ?? 'dw';
    return k === 'dw' ? 'base' : k === 'fridge' ? 'full' : k === 'stove' ? 'stove' : k;
  }
  if (t === 'panel') return x.H > s.counterH + 2 ? 'full' : 'base';
  return null;
}

/** Lays out every run of the project and gathers parts and warnings. */
export function planCabinets(plan: Pick<Plan, 'walls' | 'openings'>, data: CabinetsData): CabinetPlan {
  const s = data.settings;
  const f = (x: number, den?: number) => fmt(x, den ?? s.round);
  const labels = itemLabels(data.items);
  const geometry = wallGeometry(plan);
  const runResults = data.runs.map((r) => runGeometry(plan, r, geometry));
  const goodRuns = runResults.filter((r): r is RunGeometry => r.ok);
  const brokenRuns = runResults.filter((r) => !r.ok).map((r) => ({ runId: r.run.id, reason: (r as { reason: string }).reason }));
  const runById = new Map(goodRuns.map((g) => [g.run.id, g]));
  const { corners: resolved, stale: staleCorners } = resolveCorners(data.corners, goodRuns);
  const cornerOfRun = new Map<string, ResolvedCorner>();
  for (const c of resolved) for (const id of c.runIds) cornerOfRun.set(id, c);

  // ---- build every item
  const warns: CabinetWarning[] = [];
  const built = data.items.map((item) => {
    const label = labels.get(item.id)!;
    const g = item.runId ? runById.get(item.runId) : undefined;
    const input = g && (item.input.type === 'base-blind' || item.input.type === 'upper-blind') ? { ...item.input, blindSide: g.rightward ? ('left' as const) : ('right' as const) } : item.input;
    const x = buildCabinet(input, s, label);
    warns.push(...x.warns);
    return { item, built: x, label };
  });
  const parts: Part[] = built.flatMap((b) => b.built.parts);
  const layoutWarns: CabinetWarning[] = [];
  const warn = (id: string, msg: string, lvl: 'warn' | 'bad' = 'warn') => layoutWarns.push({ id, msg, lvl });
  for (const b of built) {
    if (b.item.runId && !runById.has(b.item.runId)) warn(b.label, "This cabinet's wall is gone. Put it on another wall or delete it.", 'bad');
  }

  type P = { item: CabinetItem; built: BuiltCabinet; label: string; row: Row | 'stove' };
  const placed: P[] = [];
  for (const b of built) {
    if (!b.built.ok || !b.item.runId || !runById.has(b.item.runId)) continue;
    const row = rowOf(b.item, b.built, s);
    if (row && row !== 'corner') placed.push({ ...b, row });
  }

  // ---- corners: which cabinets make them, and where each run's rows start
  const corners: CornerLayout[] = resolved.map((c) => {
    const on = (p: P) => c.runIds.includes(p.item.runId!);
    const blind = placed.find((p) => on(p) && p.item.input.type === 'base-blind');
    const blindU = placed.find((p) => on(p) && p.item.input.type === 'upper-blind');
    const diag = built.find((b) => b.built.ok && b.item.input.type === 'upper-diag' && b.item.cornerId === c.id);
    return {
      ...c,
      ...(blind ? { blind: { ...blind, row: 'base' as Row, a: 0, b: 0, fixed: false } } : {}),
      ...(blindU ? { blindUpper: { ...blindU, row: 'upper' as Row, a: 0, b: 0, fixed: false } } : {}),
      ...(diag ? { diagonal: diag } : {}),
    };
  });
  const cornerLayout = new Map(corners.map((c) => [c.id, c]));

  const runs: RunLayout[] = goodRuns.map((g, ri) => {
    const name = g.run.name || `Run ${ri + 1}`;
    const c = cornerOfRun.get(g.run.id);
    const cl = c ? cornerLayout.get(c.id)! : undefined;
    let lowStart = 0;
    let upStart = 0;
    if (cl) {
      const blind = cl.blind;
      const lowOwner = blind ? blind.item.runId : cl.owner;
      lowStart = g.run.id === lowOwner ? 0 : blind ? (blind.built.corner as BlindCorner).y0 : s.baseD + s.boxT;
      const diag = cl.diagonal;
      const bu = cl.blindUpper;
      upStart = diag
        ? (diag.built.corner as DiagonalCorner).L
        : bu
          ? g.run.id === bu.item.runId
            ? 0
            : (bu.built.corner as BlindCorner).y0
          : g.run.id === cl.owner
            ? 0
            : s.upperD + s.boxT;
    }
    return { geometry: g, name, lowStart, upStart, lowEnd: 0, upEnd: 0, items: [], stoves: [], gaps: [], counters: [], kickRuns: [] };
  });

  // ---- each run
  for (const w of runs) {
    const g = w.geometry;
    const runId = g.run.id;
    const len = g.length;
    // Stove spaces: fixed blocks the base row jumps past, like the prototype's stove opening.
    for (const p of placed.filter((x) => x.item.runId === runId && x.row === 'stove')) {
      const pos = p.item.position;
      if (pos.mode !== 'at' || !(pos.at === 0 || okDim(pos.at))) {
        warn(p.label, 'Set how far from the corner the stove space starts.', 'bad');
        continue;
      }
      w.stoves.push({ item: p.item, built: p.built, label: p.label, row: 'base', a: pos.at, b: pos.at + widthOf(p.built), fixed: true });
    }
    const baseOpenings: { a: number; b: number; name: string }[] = w.stoves.map((st) => ({ a: st.a, b: st.b, name: 'stove' }));
    const upperOpenings: { a: number; b: number; name: string }[] = [];
    for (const o of g.openings) {
      const blk = { a: o.a, b: o.b, name: o.kind };
      if (o.kind === 'window') {
        upperOpenings.push(blk);
        if (o.sill < s.counterH) {
          baseOpenings.push(blk);
          warn(w.name, `The window at ${f(o.a)}″ has its sill below the countertop, so base cabinets stay clear of it.`);
        }
      } else {
        baseOpenings.push(blk);
        upperOpenings.push(blk);
      }
    }
    const fulls: { a: number; b: number; name: string }[] = [];

    const flow = (rows: Row[], openBlocks: { a: number; b: number; name: string }[], start: number, rowName: 'base' | 'upper'): number => {
      const mine = placed.filter((x) => x.item.runId === runId && rows.includes(x.row as Row));
      const fixed = new Map<P, { x: P; a: number; b: number }>();
      let lastFixed: { x: P; a: number; b: number } | null = null;
      for (const x of mine) {
        const wd = widthOf(x.built);
        const pos = x.item.position;
        let a: number | null = null;
        if (pos.mode === 'opening') {
          const op = g.openings.find((o) => o.id === pos.openingId);
          if (op) a = (op.a + op.b) / 2 - wd / 2;
          else {
            const elsewhere = plan.openings.find((o) => o.id === pos.openingId);
            if (elsewhere) warn(x.label, `Set to center on the ${elsewhere.kind}, but the ${elsewhere.kind} is not on this wall.`, 'bad');
            else warn(x.label, 'The door or window this was centered on is gone.', 'bad');
          }
        } else if (pos.mode === 'at') {
          const v = pos.at;
          if (v === 0 || okDim(v)) a = v;
          else warn(x.label, 'Enter how far from the corner this piece starts.', 'bad');
        } else if (pos.mode === 'align') {
          const target = w.items.find((i) => i.row !== 'upper' && i.item.id === pos.itemId) ?? w.stoves.find((st) => st.item.id === pos.itemId);
          const targetItem = data.items.find((i) => i.id === pos.itemId);
          if (!target) {
            if (targetItem?.input.type === 'gap' && targetItem.input.gapKind === 'stove') warn(x.label, 'Set to center on the stove, but the stove is not on this wall.', 'bad');
            else warn(x.label, 'Pick the base cabinet this upper lines up with. It has to be on the same wall.', 'bad');
          } else if (pos.side === 'center') a = (target.a + target.b) / 2 - wd / 2;
          else a = (pos.side === 'right') === g.rightward ? target.b - wd : target.a;
        } else if (pos.mode === 'follow') {
          if (lastFixed) a = lastFixed.b;
          else warn(x.label, 'Set to sit right after a fixed piece, but there is no fixed piece above it in the list on this wall.', 'bad');
        }
        if (a !== null) {
          const fx: { x: P; a: number; b: number } = { x, a, b: a + wd };
          fixed.set(x, fx);
          lastFixed = fx;
        }
      }
      const blocks: { a: number; b: number; name: string; fx?: boolean }[] = openBlocks.slice();
      const fl = [...fixed.values()];
      fl.forEach((fp, i) => {
        if (fp.a < start - EPS) warn(fp.x.label, `This fixed piece starts ${f(start - fp.a)}″ inside the corner space.`, 'bad');
        for (const o of openBlocks) if (fp.a < o.b - EPS && fp.b > o.a + EPS) warn(fp.x.label, `This fixed piece overlaps the ${o.name}.`, 'bad');
        for (const q of fl.slice(i + 1)) if (fp.a < q.b - EPS && fp.b > q.a + EPS) warn(fp.x.label, `This fixed piece overlaps ${q.x.label}.`, 'bad');
        blocks.push({ a: fp.a, b: fp.b, name: fp.x.label, fx: true });
      });
      let cur = start;
      const here: PlacedItem[] = [];
      for (const x of mine) {
        const wd = widthOf(x.built);
        const fp = fixed.get(x);
        if (fp) {
          here.push({ item: x.item, built: x.built, label: x.label, row: x.row as Row, a: fp.a, b: fp.b, fixed: true });
          cur = Math.max(cur, fp.b);
          continue;
        }
        let a = cur;
        let moved = true;
        while (moved) {
          moved = false;
          for (const bl of blocks)
            if (!bl.fx && a < bl.b - EPS && a + wd > bl.a + EPS) {
              a = bl.b;
              moved = true;
            }
        }
        const hitFx = blocks.find((bl) => bl.fx && a < bl.b - EPS && a + wd > bl.a + EPS);
        if (hitFx) warn(x.label, `${x.label} runs ${f(a + wd - hitFx.a)}″ into ${hitFx.name}, which is fixed. Make ${x.label} or a cabinet before it narrower.`, 'bad');
        here.push({ item: x.item, built: x.built, label: x.label, row: x.row as Row, a, b: a + wd, fixed: false });
        cur = a + wd;
      }
      {
        // One leftover gap per stretch between anchors; snapping decides which side of it each cabinet sits.
        const anchors = blocks;
        const groups = new Map<(typeof anchors)[number] | 'END', PlacedItem[]>();
        for (const it of here) {
          if (it.fixed) continue;
          const nxt = anchors.filter((an) => an.a >= it.a + EPS).sort((p, q) => p.a - q.a)[0] ?? 'END';
          if (!groups.has(nxt)) groups.set(nxt, []);
          groups.get(nxt)!.push(it);
        }
        const plans: { its: PlacedItem[]; segStart: number; segEnd: number; k: number }[] = [];
        for (const [nxt, its] of groups) {
          const segStart = Math.max(start, ...anchors.filter((an) => an.b <= its[0]!.a + EPS).map((an) => an.b));
          const segEnd = nxt === 'END' ? len : nxt.a;
          const total = its.reduce((t, i) => t + (i.b - i.a), 0);
          if (total > segEnd - segStart + EPS) continue;
          const dir = (it: PlacedItem) => {
            const sn = it.item.snap;
            if (sn !== 'left' && sn !== 'right') return null;
            return g.rightward === (sn === 'left') ? 'c' : 'a';
          };
          let lo = 0;
          let hi = its.length;
          its.forEach((it, i) => {
            const d = dir(it);
            if (d === 'c') lo = Math.max(lo, i + 1);
            if (d === 'a') hi = Math.min(hi, i);
          });
          if (lo > hi) {
            warn(
              its[hi]!.label,
              `${its[hi]!.label} snaps away from the corner but a cabinet after it snaps toward the corner. Only one gap fits between them, so the snap toward the corner wins.`,
            );
            hi = lo;
          }
          const def = nxt === 'END' ? its.length : s.gapAt === 'fixed' ? its.length : 0;
          plans.push({ its, segStart, segEnd, k: Math.min(hi, Math.max(lo, def)) });
        }
        for (const { its, segStart, segEnd, k: split } of plans) {
          let c2 = segStart;
          for (let i = 0; i < split; i++) {
            const it = its[i]!;
            const wd = it.b - it.a;
            it.a = c2;
            it.b = c2 + wd;
            c2 += wd;
          }
          c2 = segEnd;
          for (let i = its.length - 1; i >= split; i--) {
            const it = its[i]!;
            const wd = it.b - it.a;
            it.b = c2;
            it.a = c2 - wd;
            c2 -= wd;
          }
        }
      }
      w.items.push(...here);
      for (const it of here) {
        if (it.row === 'full' && !(it.built.gap && it.item.input.gapKind === 'fridge')) fulls.push({ a: it.a, b: it.b, name: it.built.panel ? it.label : 'tall cabinet' });
      }
      const end = here.length ? Math.max(...here.map((i) => i.b)) : start;
      const occ = here.map((i) => ({ a: i.a, b: i.b, name: i.label })).concat(blocks).sort((p, q) => p.a - q.a);
      let c2 = start;
      for (const iv of occ) {
        if (iv.a > end + EPS || !here.length) break;
        if (iv.a > c2 + EPS) w.gaps.push({ row: rowName, a: c2, b: iv.a, before: iv.name, corner: Math.abs(c2 - start) < EPS });
        c2 = Math.max(c2, iv.b);
      }
      return end;
    };

    w.lowEnd = flow(['base', 'full'], baseOpenings, w.lowStart, 'base');
    w.upEnd = flow(['upper'], upperOpenings.concat(fulls), w.upStart, 'upper');
    w.upEnd = Math.max(w.upEnd, ...fulls.map((x) => x.b));
    for (const st of w.stoves) if (st.b > len + EPS) warn(w.name, 'The stove runs past the end of the wall. Check the room sizes.', 'bad');
    for (const o of g.openings) if (o.b > len + EPS) warn(w.name, `The ${o.kind} runs past the end of the wall. Check the room sizes.`, 'bad');
    const win = g.openings.find((o) => o.kind === 'window');
    const sink = w.items.find((i) => i.item.input.type === 'base-drawer-door' && i.item.input.falseFront);
    if (win && sink) {
      w.winCenter = (win.a + win.b) / 2;
      w.sinkOff = (sink.a + sink.b) / 2 - w.winCenter;
      if (Math.abs(w.sinkOff) > 1 / 32) {
        const off = Math.abs(w.sinkOff);
        warn(
          sink.label,
          `The sink base is ${f(off)}″ ${w.sinkOff > 0 ? 'farther from' : 'closer to'} the corner than the window center. Make the cabinets between the corner and the sink ${f(off)}″ ${w.sinkOff > 0 ? 'narrower' : 'wider'} in total, or change the corner filler by that much.`,
        );
      }
    }
    const lowOver = w.lowEnd - len;
    const upOver = w.upEnd - len;
    if (lowOver > EPS) warn(w.name, `Base cabinets run ${f(lowOver)}″ past the end of the wall.`, 'bad');
    if (upOver > EPS) warn(w.name, `Upper cabinets run ${f(upOver)}″ past the end of the wall.`, 'bad');
    for (const gp of w.gaps) {
      if (gp.corner) {
        if (gp.b - gp.a > 3) {
          warn(
            w.name,
            `There's an empty ${f(gp.b - gp.a)}″ space in the ${gp.row === 'upper' ? 'uppers' : 'base cabinets'} between the corner and the first ${gp.row === 'upper' ? 'upper' : 'base cabinet'}. A little space there is your hidden wiggle room, but this is big enough for a cabinet: add one about ${f(Math.max(0, gp.b - gp.a - 0.5), 8)}″ wide at the start of the list, or widen the one next to the corner.`,
          );
        }
      } else {
        warn(
          w.name,
          `${f(gp.b - gp.a)}″ gap in the ${gp.row === 'upper' ? 'uppers' : 'bases'} at ${f(gp.a)}″ from the corner, before ${['stove', 'window', 'tall cabinet'].includes(gp.before) ? 'the ' : ''}${gp.before}. Fill it with a filler strip or adjust a cabinet width.`,
        );
      }
    }
  }

  // ---- corner checks, in the prototype's order
  const runOf = new Map(runs.map((w) => [w.geometry.run.id, w]));
  for (const c of corners) {
    const bu = c.blindUpper;
    if (bu && !c.diagonal) {
      const bw = runOf.get(bu.item.runId!)!;
      const first = bw.items.find((i) => i.row === 'upper');
      if (first && first.item !== bu.item) warn(bu.label, 'The blind corner upper should be the first upper on its wall. Move it up the list.', 'bad');
      const bit = bw.items.find((i) => i.item === bu.item);
      c.blindUpperGap = bit ? Math.max(0, bit.a - bw.upStart) : 0;
      if (c.blindUpperGap > s.upperD - 2) {
        warn(bu.label, `The blind corner upper sits ${f(c.blindUpperGap)}″ from the corner, so its blind end no longer reaches behind the other wall's uppers. Make it wider.`, 'bad');
      }
    }
  }
  for (const w of runs) {
    for (const it of w.items) {
      if (it.row !== 'upper') continue;
      const bottom = it.built.isShelf ? it.built.shelfAt! - s.boxT : s.upperTop - it.built.H;
      const fr = w.items.find((x) => x.built.gap && x.item.input.gapKind === 'fridge' && x.a < it.b - EPS && x.b > it.a + EPS);
      if (fr && bottom < fr.built.H + 1) {
        warn(it.label, `Its bottom is ${f(bottom)}″ off the floor, which leaves less than 1″ above the ${fr.built.H}″ fridge. Raise it or check your fridge's real height.`);
      }
    }
  }
  for (const c of corners) {
    if (c.diagonal && c.blindUpper) warn(c.blindUpper.label, 'You have both a diagonal corner upper and a blind corner upper. Use one or the other.', 'bad');
    const blind = c.blind;
    if (blind) {
      const bw = runOf.get(blind.item.runId!)!;
      const first = bw.items.find((i) => i.row !== 'upper');
      if (first && first.item !== blind.item) warn(blind.label, 'The blind corner should be the first base cabinet on its wall. Move it up the list.', 'bad');
      const bit = bw.items.find((i) => i.item === blind.item);
      c.blindGap = bit ? Math.max(0, bit.a - bw.lowStart) : 0;
      if (c.blindGap > s.baseD - 3) {
        warn(blind.label, `The blind corner sits ${f(c.blindGap)}″ from the corner, so its blind end no longer reaches behind the other wall's cabinets. Make it wider.`, 'bad');
      }
    }
  }

  // ---- countertop, toe kick and platform runs
  const platformRuns: number[] = [];
  for (const w of runs) {
    const ct = [{ a: 0, b: w.lowStart }];
    for (const it of w.items) {
      if (it.row === 'base' && (BASE_TYPES.has(it.item.input.type) || it.built.gap || it.built.panel)) ct.push({ a: it.a, b: it.b });
    }
    ct.sort((p, q) => p.a - q.a);
    const merged: { a: number; b: number }[] = [];
    for (const iv of ct) {
      const r = merged[merged.length - 1];
      if (r && iv.a <= r.b + 3) r.b = Math.max(r.b, iv.b);
      else merged.push({ a: iv.a, b: iv.b });
    }
    const stops = w.items.filter((i) => i.row === 'full' && !(i.built.gap && i.item.input.gapKind === 'fridge')).map((i) => [i.a, i.b] as const);
    const touches = (v: number) => stops.some(([p, q]) => Math.abs(p - v) < 0.5 || Math.abs(q - v) < 0.5);
    for (const r of merged) {
      if (r.b - r.a <= 0.01) continue;
      const a = r.a <= 0.01 || touches(r.a) ? r.a : r.a - s.counterOverhang;
      const b = touches(r.b) ? r.b : r.b + s.counterOverhang;
      w.counters.push({ a, b });
    }

    const iv = w.items.filter((i) => i.row !== 'upper' && (BASE_TYPES.has(i.item.input.type) || i.item.input.type === 'tall')).map((i) => [i.a, i.b] as [number, number]).sort((p, q) => p[0] - q[0]);
    for (const [a, b] of iv) {
      const m = w.kickRuns[w.kickRuns.length - 1];
      if (m && a <= m.b + 1) m.b = Math.max(m.b, b);
      else w.kickRuns.push({ a, b });
    }
    for (const r of w.kickRuns) platformRuns.push(r.b - r.a);
  }
  if (s.kickStrips) {
    const maxL = s.sheetBoxL - 2 * s.trim - 1;
    for (const w of runs) {
      for (const { a, b } of w.kickRuns) {
        const L = b - a;
        const n = Math.ceil(L / maxL);
        parts.push({
          cab: 'Kick',
          name: 'Toe kick',
          mat: 'box',
          L: L / n,
          W: s.platformH,
          qty: n,
          band: { l: 0, w: 0 },
          rot: false,
          note: `${w.name}: ${f(L, 16)}″ run${n > 1 ? ` in ${n} pieces` : ''}, cut to fit on site`,
        });
      }
    }
  }

  return { built, runs, corners, brokenRuns, staleCorners, parts, warns: [...warns, ...layoutWarns], platformRuns };
}
