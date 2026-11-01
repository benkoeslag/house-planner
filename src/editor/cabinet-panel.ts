/**
 * The side panel for a cabinet run: its name and start end, its corner, its base and upper rows of
 * cabinets with their sizes, positions and snaps, and its problems. Rendering is plain HTML; the
 * handlers turn panel events into cabinet edits (src/cabinets/ops.ts) for the editor to commit.
 */
import type { CabinetPlan, CornerLayout, PlacedItem, RunLayout } from '../cabinets/layout';
import {
  addDiagonal,
  addItem,
  defaultInput,
  moveItem,
  removeItem,
  removeRun,
  rowOfInput,
  setCornerOwner,
  updateItem,
  updateRun,
  type CabinetOp,
} from '../cabinets/ops';
import type { CabinetItem, CabinetsData, ItemPosition } from '../cabinets/project';
import { CABINET_TYPE_LABELS, type CabinetInput } from '../cabinets/types';
import type { IdMaker } from '../model/plan-ops';
import { formatFeetInches, formatFraction, parseLength } from '../model/units';

export interface RunSelection {
  kind: 'run';
  runId: string;
  row: 'base' | 'upper';
  open?: string;
}

export interface PanelContext {
  data: CabinetsData;
  planned: CabinetPlan;
  sel: RunSelection;
  /** Door and window kinds by id, for naming plan openings. */
  openingKinds: Map<string, string>;
}

export interface PanelActions {
  commit(data: CabinetsData): void;
  select(sel: RunSelection | null): void;
  say(message: string): void;
  ids: IdMaker;
}

const fmt = (n: number): string => formatFraction(n, 16);
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type AddKind =
  | 'base-doors' | 'base-drawers' | 'base-drawer-door' | 'sink' | 'base-blind' | 'tall' | 'dw' | 'fridge' | 'open-base' | 'stove' | 'panel'
  | 'upper' | 'upper-blind' | 'shelf' | 'open-upper';
const ADD: Record<'base' | 'upper', [AddKind, string][]> = {
  base: [
    ['base-doors', 'Doors'], ['base-drawers', 'Drawers'], ['base-drawer-door', 'Drawer + doors'], ['sink', 'Sink base'], ['base-blind', 'Blind corner'],
    ['tall', 'Tall'], ['dw', 'Dishwasher'], ['fridge', 'Fridge'], ['open-base', 'Open space'], ['stove', 'Stove space'], ['panel', 'End panel'],
  ],
  upper: [['upper', 'Upper'], ['upper-blind', 'Blind corner upper'], ['shelf', 'Open shelf'], ['open-upper', 'Open space']],
};

function inputFor(kind: AddKind): CabinetInput {
  switch (kind) {
    case 'sink':
      return { type: 'base-drawer-door', width: 36, falseFront: true, name: 'Sink base' };
    case 'dw':
      return defaultInput('gap');
    case 'fridge':
      return { type: 'gap', width: 36, gapKind: 'fridge', name: 'Fridge' };
    case 'open-base':
      return { type: 'gap', width: 12, gapKind: 'base', name: 'Open space' };
    case 'open-upper':
      return { type: 'gap', width: 12, gapKind: 'upper', name: 'Open space' };
    default:
      return defaultInput(kind);
  }
}

const isStove = (i: CabinetInput) => i.type === 'gap' && i.gapKind === 'stove';
function typeName(i: CabinetInput): string {
  if (i.type === 'gap') return { dw: 'Dishwasher space', fridge: 'Fridge space', base: 'Open space', upper: 'Open space', full: 'Open space, floor to top', stove: 'Stove space' }[i.gapKind ?? 'dw'];
  if (i.type === 'base-drawer-door' && i.falseFront) return 'Sink base';
  return CABINET_TYPE_LABELS[i.type];
}

// ---- rendering ---------------------------------------------------------------------------

export function renderRunPanel(ctx: PanelContext): string {
  const { data, planned, sel } = ctx;
  const run = data.runs.find((r) => r.id === sel.runId);
  if (!run) return '';
  const layout = planned.runs.find((w) => w.geometry.run.id === run.id);
  const broken = planned.brokenRuns.find((b) => b.runId === run.id);
  const labelOf = new Map(planned.built.map((b) => [b.item.id, b.label]));
  const placed = new Map<string, PlacedItem>([...(layout?.items ?? []), ...(layout?.stoves ?? [])].map((p) => [p.item.id, p]));
  const name = layout?.name ?? run.name ?? 'Cabinet run';
  const rowItems = (row: 'base' | 'upper') => data.items.filter((i) => i.runId === run.id && rowOfInput(i.input) === row);
  const corner = planned.corners.find((c) => c.runIds.includes(run.id));

  const parts: string[] = [];
  parts.push(`<h2>Cabinets: ${esc(name)}</h2>
    <label class="field"><span>Run name</span><input class="in" data-cabfield="runName" value="${esc(run.name ?? '')}" placeholder="e.g. Sink wall" autocomplete="off"></label>`);
  if (layout) {
    const g = layout.geometry;
    parts.push(`<p class="facts">Wall face ${formatFeetInches(g.length)} · measured from the ${corner ? 'corner' : 'highlighted end'} · bases end at ${fmt(layout.lowEnd)}″ · uppers end at ${fmt(layout.upEnd)}″</p>`);
  } else if (broken) parts.push(`<p class="problem">${esc(broken.reason)} Delete this run, or undo the change that removed its wall.</p>`);
  parts.push(`<div class="row wrap"><button class="btn" data-cab="flip">Measure from the other end</button><button class="btn danger" data-cab="removeRun">Delete run</button><button class="btn" data-cab="done">Done</button></div>`);

  if (corner) parts.push(renderCorner(ctx, corner, run.id, labelOf));

  const counts = { base: rowItems('base').length, upper: rowItems('upper').length };
  parts.push(`<div class="tabs" role="tablist" aria-label="Row">
    <button role="tab" aria-selected="${sel.row === 'base'}" data-cab="row" data-row="base">Base row (${counts.base})</button>
    <button role="tab" aria-selected="${sel.row === 'upper'}" data-cab="row" data-row="upper">Upper row (${counts.upper})</button></div>`);
  const items = rowItems(sel.row);
  parts.push(items.length ? `<ol class="cab-list">${items.map((it) => renderCard(ctx, it, labelOf.get(it.id) ?? '', placed.get(it.id), layout)).join('')}</ol>` : `<p class="facts">No ${sel.row === 'base' ? 'base cabinets' : 'uppers'} on this run yet. Add one below; it goes at the end of the row.</p>`);
  parts.push(`<h3>Add ${sel.row === 'base' ? 'to the base row' : 'to the upper row'}</h3><div class="add-grid">${ADD[sel.row].map(([k, l]) => `<button class="btn" data-cab="add" data-kind="${k}">${l}</button>`).join('')}</div>`);

  const runWarns = planned.warns.filter((w) => w.id === name);
  if (runWarns.length) parts.push(`<h3>Problems on this run</h3>${runWarns.map((w) => `<p class="${w.lvl === 'bad' ? 'problem' : 'advice'}">${esc(w.msg)}</p>`).join('')}`);
  return parts.join('');
}

function renderCorner(ctx: PanelContext, c: CornerLayout, runId: string, labelOf: Map<string, string>): string {
  const { planned, data, sel } = ctx;
  const otherId = c.runIds.find((r) => r !== runId)!;
  const other = planned.runs.find((w) => w.geometry.run.id === otherId)?.name ?? 'the other run';
  const me = planned.runs.find((w) => w.geometry.run.id === runId)?.name ?? 'this run';
  const diag = data.items.find((i) => i.cornerId === c.id && i.input.type === 'upper-diag');
  const owner = `<label class="field"><span>Without a blind corner cabinet, whose cabinets go into the corner?</span><select class="in" data-cabfield="cornerOwner">
      <option value="${runId}"${c.owner === runId ? ' selected' : ''}>${esc(me)} (this run)</option>
      <option value="${otherId}"${c.owner === otherId ? ' selected' : ''}>${esc(other)}</option></select></label>`;
  let diagHtml = `<button class="btn" data-cab="addDiagonal">Add a diagonal corner upper</button>`;
  if (diag) {
    const open = sel.open === diag.id;
    const warns = planned.warns.filter((w) => w.id === labelOf.get(diag.id));
    diagHtml = `<ol class="cab-list"><li class="cab-card${open ? ' open' : ''}">
      <div class="cab-head"><button class="cab-name" data-cab="open" data-id="${diag.id}">${esc(labelOf.get(diag.id) ?? '')} · Diagonal corner upper</button>
      <input class="in w" data-cabfield="width" data-id="${diag.id}" value="${fmt(diag.input.width)}" aria-label="Length along each wall" title="Length along each wall">
      <span class="cab-btns"><button class="icon" data-cab="remove" data-id="${diag.id}" title="Delete" aria-label="Delete">✕</button></span></div>
      ${open ? `<div class="cab-details">${detailFields(diag)}</div>` : ''}
      ${warns.map((w) => `<p class="${w.lvl === 'bad' ? 'problem' : 'advice'}">${esc(w.msg)}</p>`).join('')}</li></ol>`;
  }
  return `<h3>Corner with ${esc(other)}</h3>${owner}${diagHtml}`;
}

function renderCard(ctx: PanelContext, it: CabinetItem, label: string, p: PlacedItem | undefined, layout: RunLayout | undefined): string {
  const { planned, sel, data } = ctx;
  const open = sel.open === it.id;
  const warns = planned.warns.filter((w) => w.id === label);
  const bad = warns.some((w) => w.lvl === 'bad');
  const where = p ? `${fmt(p.a)}″ to ${fmt(p.b)}″${p.fixed ? ' · fixed' : ''}` : 'not placed';
  const snap = it.snap === 'auto' ? '' : ` · pulls ${it.snap}`;
  const widthLabel = it.input.type === 'panel' ? 'Panel width (depth on the wall)' : isStove(it.input) ? 'Stove space width' : 'Width';
  return `<li class="cab-card${open ? ' open' : ''}${bad ? ' bad' : ''}">
    <div class="cab-head">
      <button class="cab-name" data-cab="open" data-id="${it.id}" aria-expanded="${open}">${esc(label)} · ${esc(it.input.name || typeName(it.input))}</button>
      <input class="in w" data-cabfield="width" data-id="${it.id}" value="${fmt(it.input.width)}" inputmode="decimal" autocomplete="off" aria-label="${esc(label)} ${widthLabel.toLowerCase()}" title="${widthLabel}">
      <span class="cab-btns">
        <button class="icon" data-cab="up" data-id="${it.id}" title="Move up the list" aria-label="Move up">↑</button>
        <button class="icon" data-cab="down" data-id="${it.id}" title="Move down the list" aria-label="Move down">↓</button>
        <button class="icon" data-cab="remove" data-id="${it.id}" title="Delete" aria-label="Delete">✕</button>
      </span>
    </div>
    <div class="cab-sub">${esc(typeName(it.input))} · ${where}${snap}</div>
    ${open ? `<div class="cab-details">${detailFields(it)}${positionFields(it, layout, data, ctx)}</div>` : ''}
    ${warns.map((w) => `<p class="${w.lvl === 'bad' ? 'problem' : 'advice'}">${esc(w.msg)}</p>`).join('')}
  </li>`;
}

const lenField = (it: CabinetItem, key: string, label: string, value: number | undefined, placeholder = 'default') =>
  `<label class="field"><span>${label}</span><input class="in" data-cabfield="${key}" data-id="${it.id}" value="${value === undefined ? '' : fmt(value)}" placeholder="${placeholder}" inputmode="decimal" autocomplete="off"></label>`;
const countField = (it: CabinetItem, key: string, label: string, value: number | undefined, placeholder = 'default') =>
  `<label class="field"><span>${label}</span><input class="in short" data-cabfield="${key}" data-id="${it.id}" value="${value === undefined ? '' : value}" placeholder="${placeholder}" inputmode="numeric" autocomplete="off"></label>`;
const selectField = (it: CabinetItem, key: string, label: string, options: [string, string][], value: string) =>
  `<label class="field"><span>${label}</span><select class="in" data-cabfield="${key}" data-id="${it.id}">${options.map(([v, l]) => `<option value="${v}"${v === value ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
const checkField = (it: CabinetItem, key: string, label: string, checked: boolean | undefined) =>
  `<label class="check"><input type="checkbox" data-cabfield="${key}" data-id="${it.id}"${checked ? ' checked' : ''}> ${label}</label>`;

function detailFields(it: CabinetItem): string {
  const i = it.input;
  const f: string[] = [`<label class="field"><span>Name</span><input class="in" data-cabfield="name" data-id="${it.id}" value="${esc(i.name ?? '')}" placeholder="${esc(typeName(i))}" autocomplete="off"></label>`];
  const doors = () => selectField(it, 'doors', 'Doors', [['auto', 'Automatic (a pair over 24″)'], ['left', 'One, hinged left'], ['right', 'One, hinged right'], ['pair', 'A pair'], ['none', 'None (open)']], i.doors ?? 'auto');
  const box = () => f.push(lenField(it, 'height', 'Height', i.height), lenField(it, 'depth', 'Depth (with back)', i.depth));
  switch (i.type) {
    case 'base-doors':
      box();
      f.push(doors(), countField(it, 'shelves', 'Shelves', i.shelves));
      break;
    case 'base-drawers':
      box();
      f.push(countField(it, 'drawers', 'Drawers', i.drawers, '3'), lenField(it, 'topFront', 'Top drawer front', i.topFront, 'all equal'));
      break;
    case 'base-drawer-door':
      box();
      f.push(lenField(it, 'topFront', 'Top front', i.topFront, '6'), checkField(it, 'falseFront', 'Top front is a fixed false front (sink base)', i.falseFront), doors(), countField(it, 'shelves', 'Shelves', i.shelves));
      break;
    case 'base-blind':
      box();
      f.push(
        lenField(it, 'filler', 'Corner filler', i.filler, '3'),
        selectField(it, 'blindTop', 'Above the door', [['drawer', 'A drawer'], ['false', 'A false front'], ['none', 'Nothing (full door)']], i.blindTop ?? 'drawer'),
        lenField(it, 'topFront', 'Top front', i.topFront, '6'),
        checkField(it, 'hingeFlip', 'Swap the hinge side', i.hingeFlip),
        countField(it, 'shelves', 'Shelves', i.shelves),
      );
      break;
    case 'upper':
      box();
      f.push(doors(), countField(it, 'shelves', 'Shelves', i.shelves), checkField(it, 'gables', 'A gable on each end', i.gables));
      if (i.gables) f.push(lenField(it, 'gableDepth', 'Gable depth', i.gableDepth), lenField(it, 'gableHeight', 'Gable height', i.gableHeight));
      break;
    case 'upper-blind':
      box();
      f.push(lenField(it, 'filler', 'Corner filler', i.filler, '3'), checkField(it, 'hingeFlip', 'Swap the hinge side', i.hingeFlip), countField(it, 'shelves', 'Shelves', i.shelves));
      break;
    case 'upper-diag':
      box();
      f.push(checkField(it, 'hingeFlip', 'Swap the hinge side', i.hingeFlip), countField(it, 'shelves', 'Shelves', i.shelves));
      break;
    case 'tall':
      box();
      f.push(selectField(it, 'tallRows', 'Door rows', [['2', 'Two (lower doors line up with the bases)'], ['1', 'One']], String(i.tallRows ?? 2)), doors(), countField(it, 'shelves', 'Shelves', i.shelves));
      if ((i.tallRows ?? 2) === 2) f.push(lenField(it, 'lowerDoor', 'Lower door height', i.lowerDoor));
      break;
    case 'shelf':
      f.push(lenField(it, 'depth', 'Depth', i.depth, '24'), lenField(it, 'shelfAt', 'Shelf height from the floor', i.shelfAt, '72'), checkField(it, 'withTop', 'A top board level with the uppers', i.withTop));
      break;
    case 'gap':
      if (!isStove(i)) f.push(selectField(it, 'gapKind', 'What goes here', [['dw', 'Dishwasher'], ['fridge', 'Fridge (floor to top)'], ['base', 'Open space, base row'], ['upper', 'Open space, upper row'], ['full', 'Open space, floor to top']], i.gapKind ?? 'dw'));
      break;
    case 'panel':
      f.push(
        lenField(it, 'length', 'Length (height)', i.length, ''),
        selectField(it, 'material', 'Material', [['box', '3/4″ maple'], ['back', '1/4″ maple'], ['drw', '1/2″ maple']], i.material ?? 'box'),
        countField(it, 'quantity', 'How many', i.quantity, '1'),
        selectField(it, 'band', 'Edge banding', [['none', 'None'], ['1L', '1 long edge'], ['2L', '2 long edges'], ['1L1W', '1 long + 1 short'], ['all', 'All 4 edges']], i.band ?? '1L'),
      );
      break;
  }
  return f.join('');
}

function positionFields(it: CabinetItem, layout: RunLayout | undefined, data: CabinetsData, ctx: PanelContext): string {
  const pos = it.position;
  const overhang = data.settings.counterOverhang;
  if (isStove(it.input)) {
    const at = pos.mode === 'at' ? pos.at + overhang : undefined;
    return `<label class="field"><span>Stove space starts this far from the corner</span><input class="in" data-cabfield="stoveAt" data-id="${it.id}" value="${at === undefined ? '' : fmt(at)}" inputmode="decimal" autocomplete="off"></label><p class="note">Measured to the countertop edge. The cabinets beside it sit back by the ${fmt(overhang)}″ overhang.</p>`;
  }
  const row = rowOfInput(it.input);
  const options: [string, string][] = [
    ['flow', 'In list order'],
    ['follow', 'Right after the fixed piece above it'],
    ['at', 'At a distance from the corner'],
  ];
  for (const o of layout?.geometry.openings ?? []) options.push([`opening:${o.id}`, `Centered on the ${ctx.openingKinds.get(o.id) ?? o.kind} at ${fmt(o.a)}″`]);
  if (row === 'upper' && layout) {
    for (const p of [...layout.items.filter((x) => x.row !== 'upper'), ...layout.stoves]) options.push([`align:${p.item.id}`, `Lined up with ${p.label}${isStove(p.item.input) ? ' (stove)' : ''}`]);
  }
  const value = pos.mode === 'opening' ? `opening:${pos.openingId}` : pos.mode === 'align' ? `align:${pos.itemId}` : pos.mode;
  if (!options.some(([v]) => v === value)) options.push([value, pos.mode === 'opening' ? 'Centered on a door or window that is gone' : 'Lined up with a cabinet not on this run']);
  const out = [selectField(it, 'position', 'Position', options, value)];
  if (pos.mode === 'at') out.push(lenField(it, 'at', 'Distance from the corner to its start', pos.at, ''));
  if (pos.mode === 'align') out.push(selectField(it, 'alignSide', 'Line up', [['left', 'Left sides (as you face it)'], ['right', 'Right sides'], ['center', 'Centers']], pos.side));
  out.push(selectField(it, 'snap', 'Pull toward', [['auto', 'Automatic (spare room goes to the corner)'], ['left', 'The left (as you face the wall)'], ['right', 'The right']], it.snap));
  return out.join('');
}

// ---- events ------------------------------------------------------------------------------

function apply(r: CabinetOp, act: PanelActions): string | undefined {
  if (!r.ok) {
    act.say(r.error);
    return undefined;
  }
  act.commit(r.data);
  return r.id ?? '';
}

export function onRunPanelClick(ctx: PanelContext, el: HTMLElement, act: PanelActions): void {
  const { data, sel } = ctx;
  const id = el.dataset.id ?? '';
  switch (el.dataset.cab) {
    case 'done':
      act.select(null);
      return;
    case 'row':
      act.select({ ...sel, row: el.dataset.row === 'upper' ? 'upper' : 'base', open: undefined });
      return;
    case 'open':
      act.select({ ...sel, open: sel.open === id ? undefined : id });
      return;
    case 'up':
    case 'down':
      apply(moveItem(data, id, el.dataset.cab === 'up' ? -1 : 1), act);
      return;
    case 'remove':
      apply(removeItem(data, id), act);
      return;
    case 'flip': {
      const run = data.runs.find((r) => r.id === sel.runId);
      if (run) apply(updateRun(data, run.id, { from: run.from === 'a' ? 'b' : 'a' }), act);
      return;
    }
    case 'removeRun':
      if (apply(removeRun(data, sel.runId), act) !== undefined) {
        act.select(null);
        act.say('Deleted the cabinet run and its cabinets. Undo brings them back.');
      }
      return;
    case 'addDiagonal': {
      const corner = ctx.planned.corners.find((c) => c.runIds.includes(sel.runId));
      if (!corner) return;
      const newId = apply(addDiagonal(data, corner, act.ids), act);
      if (newId) act.select({ ...sel, row: 'upper', open: newId });
      return;
    }
    case 'add': {
      const kind = el.dataset.kind as AddKind;
      const input = inputFor(kind);
      const layout = ctx.planned.runs.find((w) => w.geometry.run.id === sel.runId);
      let position: ItemPosition = { mode: 'flow' };
      if (kind === 'stove') position = { mode: 'at', at: layout ? Math.max(0, layout.lowEnd) : 0 };
      if (kind === 'sink') {
        const win = layout?.geometry.openings.find((o) => o.kind === 'window');
        if (win) position = { mode: 'opening', openingId: win.id };
      }
      const newId = apply(addItem(data, { runId: sel.runId, input, position, snap: 'auto' }, act.ids), act);
      if (newId) act.select({ ...sel, row: rowOfInput(input) === 'upper' ? 'upper' : 'base', open: newId });
    }
  }
}

const OPTIONAL_LENGTHS = ['height', 'depth', 'topFront', 'filler', 'gableDepth', 'gableHeight', 'lowerDoor', 'shelfAt', 'length'] as const;
const OPTIONAL_COUNTS = ['shelves', 'drawers', 'quantity'] as const;

export function onRunPanelChange(ctx: PanelContext, el: HTMLInputElement | HTMLSelectElement, act: PanelActions): void {
  const { data, sel } = ctx;
  const field = el.dataset.cabfield!;
  const value = el.value;
  if (field === 'runName') {
    apply(updateRun(data, sel.runId, { name: value }), act);
    return;
  }
  if (field === 'cornerOwner') {
    const corner = ctx.planned.corners.find((c) => c.runIds.includes(sel.runId));
    if (corner) apply(setCornerOwner(data, corner, value), act);
    return;
  }
  const it = data.items.find((x) => x.id === el.dataset.id);
  if (!it) return;
  const setInput = (patch: Partial<CabinetInput>, clear: string[] = []) => {
    const input = { ...it.input, ...patch } as Record<string, unknown>;
    for (const k of clear) delete input[k];
    apply(updateItem(data, it.id, { input: input as unknown as CabinetInput }), act);
  };
  const length = (allowZero = false): number | null => {
    const v = parseLength(value);
    if (v === null || v < 0 || (!allowZero && v === 0)) {
      act.say(`"${value}" is not a length. Try 24, 2' or 23 7/8.`);
      return null;
    }
    return v;
  };
  if (field === 'width') {
    const v = length();
    if (v !== null) setInput({ width: v });
  } else if ((OPTIONAL_LENGTHS as readonly string[]).includes(field)) {
    if (value.trim() === '') setInput({}, [field]);
    else {
      const v = length();
      if (v !== null) setInput({ [field]: v });
    }
  } else if ((OPTIONAL_COUNTS as readonly string[]).includes(field)) {
    if (value.trim() === '') setInput({}, [field]);
    else {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) act.say(`"${value}" is not a whole number.`);
      else setInput({ [field]: n });
    }
  } else if (field === 'name') {
    if (value.trim() === '') setInput({}, ['name']);
    else setInput({ name: value.trim() });
  } else if (['falseFront', 'hingeFlip', 'gables', 'withTop'].includes(field)) {
    setInput({ [field]: (el as HTMLInputElement).checked });
  } else if (field === 'tallRows') {
    setInput({ tallRows: value === '1' ? 1 : 2 });
  } else if (['doors', 'blindTop', 'gapKind', 'material', 'band'].includes(field)) {
    setInput({ [field]: value } as Partial<CabinetInput>);
    if (field === 'gapKind') act.select({ ...sel, row: rowOfInput({ ...it.input, gapKind: value as CabinetInput['gapKind'] }) === 'upper' ? 'upper' : 'base', open: it.id });
  } else if (field === 'snap') {
    apply(updateItem(data, it.id, { snap: value as CabinetItem['snap'] }), act);
  } else if (field === 'position') {
    let position: ItemPosition;
    if (value.startsWith('opening:')) position = { mode: 'opening', openingId: value.slice(8) };
    else if (value.startsWith('align:')) {
      const target = data.items.find((x) => x.id === value.slice(6));
      position = { mode: 'align', itemId: value.slice(6), side: target && isStove(target.input) ? 'center' : 'left' };
    } else if (value === 'at') {
      const layout = ctx.planned.runs.find((w) => w.geometry.run.id === sel.runId);
      const p = layout && [...layout.items, ...layout.stoves].find((x) => x.item.id === it.id);
      position = { mode: 'at', at: p ? Math.max(0, Math.round(p.a * 16) / 16) : 0 };
    } else position = { mode: value === 'follow' ? 'follow' : 'flow' };
    apply(updateItem(data, it.id, { position }), act);
  } else if (field === 'at') {
    const v = length(true);
    if (v !== null) apply(updateItem(data, it.id, { position: { mode: 'at', at: v } }), act);
  } else if (field === 'stoveAt') {
    const v = length(true);
    if (v !== null) apply(updateItem(data, it.id, { position: { mode: 'at', at: Math.max(0, v - data.settings.counterOverhang) } }), act);
  } else if (field === 'alignSide' && it.position.mode === 'align') {
    apply(updateItem(data, it.id, { position: { ...it.position, side: value as 'left' | 'right' | 'center' } }), act);
  }
}
