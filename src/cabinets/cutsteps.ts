/**
 * Readable cut steps for one sheet: rip a strip, then crosscut it, and rip pieces where a segment
 * holds several parts. A port of the prototype's `cutPlanHtml` that returns data instead of HTML,
 * plus plain text in the prototype's wording. The rules are in docs/cabinet-rules.md → "Cut steps".
 */
import { fmt } from './format';
import type { CabinetSettings } from './settings';
import type { MaterialInfo, PlacedPart, SheetLayout } from './sheets';

const E = 1e-6;

export interface CutPartRef {
  num: number;
  name: string;
  L: number;
  W: number;
}

export type CutLine =
  /** Crosscut `count` pieces at `at`, each giving one part (ripped or trimmed if smaller). */
  | { kind: 'crosscut'; count: number; at: number; ripTo?: number; trimTo?: number; part: CutPartRef }
  /** Crosscut a piece at `at`, then rip it into several parts. */
  | { kind: 'crosscut-rip'; at: number; pieces: number; rips: (CutPartRef & { count: number; trimTo?: number })[] };

export interface StripSteps {
  /** 1-based, in rip order (from the sheet edge). */
  index: number;
  width: number;
  lines: CutLine[];
  /** Leftover over 2″ at the end of the strip: length × strip width. */
  leftover?: { L: number; W: number };
}

export interface SheetSteps {
  strips: StripSteps[];
  /** Leftover over 2″ along the sheet edge: usable length × remaining width. */
  edgeLeftover?: { L: number; W: number };
}

export function cutSteps(sheet: SheetLayout, mat: Pick<MaterialInfo, 'L' | 'W'>, s: Pick<CabinetSettings, 'trim' | 'kerf'>, names: ReadonlyMap<number, string>): SheetSteps {
  const SL = mat.L - 2 * s.trim;
  const SW = mat.W - 2 * s.trim;
  const name = (n: number) => names.get(n) || 'Part';
  let usedW = 0;
  const strips = sheet.strips
    .slice()
    .sort((p, q) => p.y - q.y)
    .map((st, si): StripSteps => {
      usedW = Math.max(usedW, st.y + st.w);
      const segs: { x: number; L: number; items: PlacedPart[] }[] =
        st.segs ?? st.parts.slice().sort((p, q) => p.x - q.x).map((p) => ({ x: p.x, L: p.L, items: [p] }));
      const lines: CutLine[] = [];
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i]!;
        if (sg.items.length === 1) {
          const p = sg.items[0]!;
          let n = 1;
          while (
            i + n < segs.length &&
            segs[i + n]!.items.length === 1 &&
            segs[i + n]!.items[0]!.num === p.num &&
            Math.abs(segs[i + n]!.L - sg.L) < E &&
            Math.abs(segs[i + n]!.items[0]!.W - p.W) < E
          ) n++;
          lines.push({
            kind: 'crosscut',
            count: n,
            at: sg.L,
            ...(p.W < st.w - E ? { ripTo: p.W } : {}),
            ...(p.L < sg.L - E ? { trimTo: p.L } : {}),
            part: { num: p.num, name: name(p.num), L: p.L, W: p.W },
          });
          i += n - 1;
        } else {
          const groups: (CutPartRef & { count: number; trimTo?: number })[] = [];
          for (const p of sg.items.slice().sort((a, b) => a.y - b.y)) {
            const g = groups.find((x) => x.num === p.num && Math.abs(x.W - p.W) < E && Math.abs(x.L - p.L) < E);
            if (g) g.count++;
            else groups.push({ num: p.num, name: name(p.num), L: p.L, W: p.W, count: 1, ...(p.L < sg.L - E ? { trimTo: p.L } : {}) });
          }
          lines.push({ kind: 'crosscut-rip', at: sg.L, pieces: sg.items.length, rips: groups });
        }
      }
      const used = st.usedL !== undefined ? st.usedL : (st.used ?? 0);
      const rem = SL - used + s.kerf;
      return { index: si + 1, width: st.w, lines, ...(rem > 2 ? { leftover: { L: rem, W: st.w } } : {}) };
    });
  const restW = SW - usedW;
  return { strips, ...(restW > 2 ? { edgeLeftover: { L: SL, W: restW } } : {}) };
}

/** One sheet's cut steps as plain text lines, in the prototype's wording. */
export function cutStepsText(steps: SheetSteps, s: Pick<CabinetSettings, 'round'>): string[] {
  const f = (x: number, den: number = s.round) => fmt(x, den);
  const sz = (L: number, W: number) => `${f(L)} × ${f(W)}`;
  const out: string[] = [];
  for (const st of steps.strips) {
    out.push(`${st.index}. Rip a strip ${f(st.width)}″ wide`);
    for (const ln of st.lines) {
      if (ln.kind === 'crosscut') {
        const how = (ln.ripTo !== undefined ? `, rip to ${f(ln.ripTo)}″ wide` : '') + (ln.trimTo !== undefined ? `, trim to ${f(ln.trimTo)}″ long` : '');
        const act = (ln.count > 1 ? `Crosscut ${ln.count} pieces at ${f(ln.at)}″` : `Crosscut ${f(ln.at)}″`) + how;
        out.push(`   ${act}: #${ln.part.num} ${ln.part.name}${ln.count > 1 ? ` ×${ln.count}` : ''} ${sz(ln.part.L, ln.part.W)}`);
      } else {
        out.push(`   Crosscut ${f(ln.at)}″, then rip that piece into ${ln.pieces}:`);
        for (const r of ln.rips) {
          const how = `${r.count > 1 ? `${r.count} at ` : ''}${f(r.W)}″ wide${r.trimTo !== undefined ? `, trim to ${f(r.trimTo)}″ long` : ''}`;
          out.push(`      #${r.num} ${r.name}${r.count > 1 ? ` ×${r.count}` : ''} ${how} ${sz(r.L, r.W)}`);
        }
      }
    }
    if (st.leftover) out.push(`   Leftover from this strip: ${f(st.leftover.L, 8)} × ${f(st.leftover.W)}`);
  }
  if (steps.edgeLeftover) out.push(`Leftover along the edge: ${f(steps.edgeLeftover.L, 8)} × ${f(steps.edgeLeftover.W, 8)}`);
  return out;
}
