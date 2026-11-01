// Generates tests/fixtures/prototype-cabinets.json and prototype-sheets.json by running the cabinet planner prototype
// (docs/prototype/cabinet-planner.html, unchanged) in headless Chromium.
//
// The fixtures are the reference numbers for the cabinet engine's golden tests: each case is a
// cabinet input in the engine's typed form, optional setting overrides, and exactly what the
// prototype's buildCab produced for it. A second set records the prototype's grouped cut list.
//
// Manual developer script, not run in CI. Needs Playwright with a Chromium browser:
//   node scripts/prototype-fixtures.mjs
// Re-run it only when cases are added; the prototype itself never changes.

import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const protoPath = join(root, 'docs/prototype/cabinet-planner.html');
const outPath = join(root, 'tests/fixtures/prototype-cabinets.json');
const sheetsPath = join(root, 'tests/fixtures/prototype-sheets.json');

// Expose the prototype's internals for reading. The source file is not modified: a copy with one
// added line goes to a temporary directory.
const src = readFileSync(protoPath, 'utf8');
const end = src.lastIndexOf('})();');
if (end < 0) throw new Error('Unexpected prototype layout');
const exposed =
  src.slice(0, end) +
  'window.__proto = {buildCab, newCab, finalize, S, DEF, fullCompute, nest, matInfo, consumables, plyCost, matCounts, MATS_UI, MAT_ORDER, BASE, workerMain, cutPlanHtml, sigFor};\n' +
  src.slice(end);
const dir = mkdtempSync(join(tmpdir(), 'proto-fixtures-'));
const page = join(dir, 'proto.html');
writeFileSync(page, exposed);

// ---- cases: engine inputs and setting overrides -------------------------------------------
const c = (name, input, settings) => ({ name, input, ...(settings ? { settings } : {}) });
const CASES = [
  // base, doors
  c('base doors 24', { type: 'base-doors', width: 24 }),
  c('base doors 30 auto pair', { type: 'base-doors', width: 30 }),
  c('base doors 12', { type: 'base-doors', width: 12 }),
  c('base doors 26 single wide warning', { type: 'base-doors', width: 26, doors: 'left' }),
  c('base doors 15 forced pair narrow warning', { type: 'base-doors', width: 15, doors: 'pair' }),
  c('base doors hinged right', { type: 'base-doors', width: 21, doors: 'right' }),
  c('base doors none, 3 shelves', { type: 'base-doors', width: 24, doors: 'none', shelves: 3 }),
  c('base doors no shelves', { type: 'base-doors', width: 24, shelves: 0 }),
  c('base doors 40 sag warning', { type: 'base-doors', width: 40 }),
  c('base doors height and depth overrides', { type: 'base-doors', width: 24, height: 28.5, depth: 12 }),
  c('base doors one lower nailer', { type: 'base-doors', width: 24 }, { baseLowerNailer: false }),
  c('base doors 3/4 box, 3 1/2 stretcher', { type: 'base-doors', width: 24 }, { boxT: 0.75, stretcherW: 3.5, nailerW: 3 }),
  c('base doors pair over 30', { type: 'base-doors', width: 30 }, { pairOver: 30 }),
  c('base doors reveals', { type: 'base-doors', width: 30 }, { edgeReveal: 0.125, frontGap: 0.0625, counterGap: 0.25 }),
  c('base doors counter 34 1/2', { type: 'base-doors', width: 24 }, { counterH: 34.5, platformH: 4 }),
  c('base doors base depth 24', { type: 'base-doors', width: 24 }, { baseD: 24, shelfClear: 0.125, shelfSetback: 0.5 }),
  c('base doors round 1/16 messages', { type: 'base-doors', width: 15.03125, doors: 'pair' }, { round: 16 }),
  // base, drawers
  c('drawers 18 x3 top 6', { type: 'base-drawers', width: 18, drawers: 3, topFront: 6 }),
  c('drawers 13 7/8 x3 top 6', { type: 'base-drawers', width: 13.875, drawers: 3, topFront: 6 }),
  c('drawers 24 x4 equal', { type: 'base-drawers', width: 24, drawers: 4 }),
  c('drawers 24 x1', { type: 'base-drawers', width: 24, drawers: 1, topFront: 6 }),
  c('drawers 24 x8 too short', { type: 'base-drawers', width: 24, drawers: 8, topFront: 6 }),
  c('drawers 36 two pulls', { type: 'base-drawers', width: 36, drawers: 2, topFront: 10 }),
  c('drawers top front taller than room', { type: 'base-drawers', width: 18, drawers: 2, topFront: 30 }),
  c('drawers shallow, no slide fits', { type: 'base-drawers', width: 18, depth: 12, drawers: 3, topFront: 6 }),
  c('drawers 15 deep, 12 slide', { type: 'base-drawers', width: 18, depth: 15, drawers: 3, topFront: 6 }),
  c('drawers vertical grain', { type: 'base-drawers', width: 18, drawers: 3, topFront: 6 }, { drawerGrain: 'vertical' }),
  c('drawers no groove', { type: 'base-drawers', width: 18, drawers: 3, topFront: 6 }, { grooveD: 0 }),
  c('drawers slide list 18 21', { type: 'base-drawers', width: 18, drawers: 3, topFront: 6 }, { slideLengths: [18, 21] }),
  c('drawers slide clearance, deduct, 5/8 stock', { type: 'base-drawers', width: 18, drawers: 3, topFront: 6 }, { slideClear: 0.5625, drwDeduct: 0.75, drwT: 0.625, btmClear: 0.125, grooveD: 0.375 }),
  c('drawers drawer parts keep grain', { type: 'base-drawers', width: 18, drawers: 2, topFront: 6 }, { rotDrw: false }),
  c('drawers two pulls over 20', { type: 'base-drawers', width: 24, drawers: 2, topFront: 6 }, { pullDoubleOver: 20 }),
  // base, drawer + doors
  c('drawer door 24', { type: 'base-drawer-door', width: 24 }),
  c('drawer door 18', { type: 'base-drawer-door', width: 18 }),
  c('drawer door 20 15/16', { type: 'base-drawer-door', width: 20.9375 }),
  c('sink 36 false front', { type: 'base-drawer-door', width: 36, falseFront: true }),
  c('drawer door top 8', { type: 'base-drawer-door', width: 24, topFront: 8 }),
  c('sink vertical grain', { type: 'base-drawer-door', width: 36, falseFront: true }, { drawerGrain: 'vertical' }),
  // base, blind corner
  c('blind 42 right drawer', { type: 'base-blind', width: 42, blindSide: 'right' }),
  c('blind 42 left drawer', { type: 'base-blind', width: 42, blindSide: 'left' }),
  c('blind 42 right false front', { type: 'base-blind', width: 42, blindSide: 'right', blindTop: 'false' }),
  c('blind 42 right no top', { type: 'base-blind', width: 42, blindSide: 'right', blindTop: 'none' }),
  c('blind 42 right hinge swapped', { type: 'base-blind', width: 42, blindSide: 'right', hingeFlip: true }),
  c('blind 45 left filler 2 top 7', { type: 'base-blind', width: 45, blindSide: 'left', filler: 2, topFront: 7 }),
  c('blind 36 narrow door', { type: 'base-blind', width: 36, blindSide: 'right' }),
  c('blind 28 no door', { type: 'base-blind', width: 28, blindSide: 'right', blindTop: 'none' }),
  c('blind 42 base depth 24', { type: 'base-blind', width: 42, blindSide: 'right' }, { baseD: 24 }),
  // uppers
  c('upper 30', { type: 'upper', width: 30 }),
  c('upper 15', { type: 'upper', width: 15 }),
  c('upper 31 1/4', { type: 'upper', width: 31.25 }),
  c('upper 27', { type: 'upper', width: 27 }),
  c('upper 24 tall 24 one shelf', { type: 'upper', width: 24, height: 24 }),
  c('upper 36 tall 42 three shelves', { type: 'upper', width: 36, height: 42 }),
  c('upper 30x18 gables', { type: 'upper', width: 30, height: 18, gables: true }),
  c('upper gables custom', { type: 'upper', width: 30, height: 18, gables: true, gableDepth: 14, gableHeight: 36 }),
  c('upper 30 upper height 36 depth 13', { type: 'upper', width: 30 }, { upperH: 36, upperD: 13, vReveal: 0.25 }),
  // upper blind
  c('upper blind 30 right', { type: 'upper-blind', width: 30, blindSide: 'right' }),
  c('upper blind 30 left', { type: 'upper-blind', width: 30, blindSide: 'left' }),
  c('upper blind 30 left swapped', { type: 'upper-blind', width: 30, blindSide: 'left', hingeFlip: true }),
  c('upper blind 24 narrow', { type: 'upper-blind', width: 24, blindSide: 'right' }),
  c('upper blind 30 filler 1 1/2, tall 42', { type: 'upper-blind', width: 30, blindSide: 'right', filler: 1.5, height: 42 }),
  // diagonal corner
  c('diagonal 24', { type: 'upper-diag', width: 24 }),
  c('diagonal 26 tall 42', { type: 'upper-diag', width: 26, height: 42 }),
  c('diagonal 24 swapped no shelves', { type: 'upper-diag', width: 24, hingeFlip: true, shelves: 0 }),
  c('diagonal 16 too small', { type: 'upper-diag', width: 16 }),
  c('diagonal 24 depth 13 settings', { type: 'upper-diag', width: 24 }, { upperD: 13, shelfClear: 0.125, shelfSetback: 0.5 }),
  // tall
  c('tall 24 two rows', { type: 'tall', width: 24 }),
  c('tall 24 one row', { type: 'tall', width: 24, tallRows: 1 }),
  c('tall 30 pair lower 20', { type: 'tall', width: 30, lowerDoor: 20, shelves: 2 }),
  c('tall 18 no fixed shelf', { type: 'tall', width: 18 }, { tallFixedShelf: false }),
  c('tall 24 depth 25', { type: 'tall', width: 24, depth: 25 }, { upperTop: 90 }),
  // open shelf
  c('shelf 36', { type: 'shelf', width: 36 }),
  c('shelf 36 with top', { type: 'shelf', width: 36, withTop: true }),
  c('shelf with top, close to top', { type: 'shelf', width: 33, withTop: true, shelfAt: 82, depth: 14 }),
  c('shelf missing width', { type: 'shelf', width: 0 }),
  // open spaces
  c('dishwasher', { type: 'gap', width: 24, gapKind: 'dw', name: 'Dishwasher' }),
  c('fridge', { type: 'gap', width: 36, gapKind: 'fridge', name: 'Fridge' }),
  c('open base', { type: 'gap', width: 12, gapKind: 'base' }),
  c('open upper', { type: 'gap', width: 12, gapKind: 'upper' }),
  c('open full', { type: 'gap', width: 12, gapKind: 'full' }),
  c('open space missing width', { type: 'gap', width: 0 }),
  // custom parts
  c('end panel', { type: 'panel', width: 24.71875, length: 34.5, name: 'Dishwasher end panel' }),
  c('panel back stock', { type: 'panel', width: 20, length: 30, material: 'back', band: 'none' }),
  c('panel drawer stock x3', { type: 'panel', width: 6, length: 22, material: 'drw', quantity: 3, band: 'all' }),
  c('panel back stock may ignore grain', { type: 'panel', width: 20, length: 30, material: 'back', band: '2L' }, { rotBack: true }),
  c('panel quantity 0', { type: 'panel', width: 20, length: 30, quantity: 0, band: '1L1W' }),
  c('panel missing length', { type: 'panel', width: 20, length: 0 }),
  // refused boxes
  c('box too narrow', { type: 'base-doors', width: 3 }),
  c('box too shallow', { type: 'upper', width: 24, depth: 2 }),
  c('box missing width', { type: 'upper', width: 0 }),
  // backs may ignore grain
  c('base doors backs ignore grain', { type: 'base-doors', width: 24 }, { rotBack: true }),
];

// The starter kitchen's cabinets (the prototype's example list), for the cut list fixtures.
const STARTER = [
  ['B1', { type: 'base-blind', width: 42, blindSide: 'right', name: 'Blind corner' }],
  ['B2', { type: 'base-drawers', width: 13.875, drawers: 3, topFront: 6, name: 'Drawer base' }],
  ['B3', { type: 'base-drawer-door', width: 18, name: 'Base' }],
  ['B4', { type: 'base-drawers', width: 18, drawers: 3, topFront: 6, name: 'Drawer base' }],
  ['B5', { type: 'base-drawer-door', width: 20.9375, name: 'Base' }],
  ['B6', { type: 'base-drawer-door', width: 36, falseFront: true, name: 'Sink base' }],
  ['O1', { type: 'gap', width: 24, gapKind: 'dw', name: 'Dishwasher' }],
  ['P1', { type: 'panel', width: 24.71875, length: 34.5, name: 'Dishwasher end panel' }],
  ['U1', { type: 'upper-diag', width: 24, name: 'Corner upper' }],
  ['U2', { type: 'upper', width: 31.25, name: 'Upper' }],
  ['U3', { type: 'upper', width: 30, height: 18, gables: true, name: 'Over stove' }],
  ['U4', { type: 'upper', width: 30, name: 'Upper' }],
  ['U5', { type: 'upper', width: 30, name: 'Upper' }],
  ['U6', { type: 'upper', width: 15, name: 'Upper' }],
  ['U7', { type: 'upper', width: 27, name: 'Upper' }],
];
const CUTLISTS = [
  { name: 'starter, defaults' },
  { name: 'starter, all box parts ignore grain', settings: { rotBox: true } },
  { name: 'starter, round 1/16', settings: { round: 16 } },
  { name: 'starter, grain ticked on two lines', grainFree: ['box|Side|31|23.625', 'back|Back|31|18'] },
];

const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(pathToFileURL(page).href);
await tab.waitForFunction(() => window.__proto);

const result = await tab.evaluate(({ CASES, STARTER, CUTLISTS }) => {
  const P = window.__proto;
  const DOORS = { auto: 'auto', none: '0', left: '1L', right: '1R', pair: '2' };
  const str = (v) => (v === undefined ? '' : String(v));
  // Engine input -> the prototype's text fields.
  function toProto(i) {
    const o = { name: i.name ?? '', wall: '', w: str(i.width) };
    if (i.type === 'shelf') {
      o.h = str(i.shelfAt);
      o.d = str(i.depth);
    } else if (i.type === 'panel') {
      o.h = str(i.length);
    } else {
      o.h = str(i.height);
      o.d = str(i.depth);
    }
    if (i.doors !== undefined) o.doors = DOORS[i.doors];
    o.shelves = str(i.shelves);
    if (i.drawers !== undefined) o.drawers = String(i.drawers);
    o.topFront = str(i.topFront);
    o.falseFront = !!i.falseFront;
    if (i.tallRows !== undefined) o.rows = String(i.tallRows);
    o.lowerDoor = str(i.lowerDoor);
    if (i.blindSide !== undefined) o.blindSide = i.blindSide;
    if (i.filler !== undefined) o.filler = String(i.filler);
    if (i.blindTop !== undefined) o.topMode = i.blindTop;
    o.hingeFlip = !!i.hingeFlip;
    o.gables = !!i.gables;
    o.gableD = str(i.gableDepth);
    o.gableH = str(i.gableHeight);
    o.withTop = !!i.withTop;
    if (i.gapKind !== undefined) o.gapRow = i.gapKind;
    if (i.material !== undefined) o.mat = i.material;
    if (i.quantity !== undefined) o.qty = String(i.quantity);
    if (i.band !== undefined) o.band = i.band;
    return P.newCab(i.type, o);
  }
  function applySettings(s) {
    for (const k of Object.keys(P.S)) delete P.S[k];
    Object.assign(P.S, P.DEF, { grainFree: {} });
    for (const [k, v] of Object.entries(s || {})) {
      if (k === 'slideLengths') P.S.slideLens = v.join(', ');
      else P.S[k] = v;
    }
  }
  const plain = (x) => JSON.parse(JSON.stringify(x));
  function snapshot(x) {
    const { c: _c, ...rest } = x;
    return plain(rest);
  }

  const cases = CASES.map((k) => {
    applySettings(k.settings);
    return { ...k, expected: snapshot(P.buildCab(toProto(k.input), 'X1')) };
  });

  const cutlists = CUTLISTS.map((k) => {
    applySettings(k.settings);
    if (k.grainFree) for (const g of k.grainFree) P.S.grainFree[g] = true;
    const R = { cabs: [], parts: [], warns: [], groups: [], byMat: {}, nests: {} };
    for (const [id, input] of STARTER) {
      const x = P.buildCab(toProto(input), id);
      R.cabs.push(x);
      R.parts.push(...x.parts);
    }
    P.finalize(R);
    const groups = R.groups.map((g) => ({
      num: g.num, key: g.key, gk: g.gk, mat: g.mat, name: g.name, L: g.L, W: g.W, band: g.band,
      rot: g.rot, baseRot: g.baseRot, qty: g.qty, cabs: [...g.cabs.entries()], notes: [...g.notes],
    }));
    const band = R.groups.reduce((a, g) => a + (g.band.l * g.L + g.band.w * g.W + (g.band.x || 0)) * g.qty, 0);
    return { ...k, groups, bandInches: band };
  });
  applySettings({});
  return { defaults: plain(P.DEF), cases, starter: STARTER, cutlists };
}, { CASES, STARTER, CUTLISTS });

// ---- sheets, optimizer, cut steps, consumables and costs -----------------------------------
// The page loads with the prototype's example list (the starter kitchen) and default settings, and
// renders its totals; those are read from the page before anything is changed.
await tab.reload();
await tab.waitForFunction(() => window.__proto);
const sheets = await tab.evaluate(async () => {
  const P = window.__proto;
  const plain = (x) => JSON.parse(JSON.stringify(x));
  const text = (id) => { const e = document.getElementById(id); return e ? e.textContent : null; };
  const page = {
    lines: Object.fromEntries(P.MATS_UI.map((m) => [m.k, { count: text('mc-' + m.k), packs: text('ms-' + m.k), subtotal: text('mt-' + m.k), tax: text('mx-' + m.k), total: text('mz-' + m.k), hidden: document.getElementById('mb-' + m.k).hidden }])),
    subtotal: text('mt-total'), tax: text('mx-total'), total: text('mz-total'),
  };
  function applySettings(s) {
    for (const k of Object.keys(P.S)) delete P.S[k];
    Object.assign(P.S, P.DEF, { grainFree: {} });
    Object.assign(P.S, s || {});
  }
  // Cut steps as text lines: S = strip heading, C = crosscut (=> result), R = rip result, O = strip leftover, E = edge leftover.
  function stepsText(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    const out = [];
    for (const node of d.children) {
      if (node.classList.contains('strip')) {
        out.push('S ' + node.querySelector('.strip-h').textContent);
        for (const li of node.querySelectorAll(':scope > ol.cuts > li')) {
          const act = li.querySelector(':scope > .act').textContent;
          const res = li.querySelector(':scope > .res');
          if (res) out.push('C ' + act + ' => ' + res.textContent);
          else {
            out.push('C ' + act);
            for (const r of li.querySelectorAll(':scope > ul.rips > li')) out.push('R ' + r.textContent);
          }
        }
        const off = node.querySelector(':scope > .off');
        if (off) out.push('O ' + off.textContent);
      } else if (node.classList.contains('off')) out.push('E ' + node.textContent);
    }
    return out;
  }
  // Platform runs: base cabinets and talls on each wall, merged within 1 inch (as consumables does).
  function platformRuns(R) {
    const runs = [];
    for (const k of ['L', 'R']) {
      const iv = R.walls[k].items.filter((i) => i.row !== 'upper' && (P.BASE.has(i.x.c.type) || i.x.c.type === 'tall')).map((i) => [i.a, i.b]).sort((p, q) => p[0] - q[0]);
      const merged = [];
      for (const [a, b] of iv) { const m = merged[merged.length - 1]; if (m && a <= m[1] + 1) m[1] = Math.max(m[1], b); else merged.push([a, b]); }
      for (const [a, b] of merged) runs.push(b - a);
    }
    return runs;
  }
  const groupOut = (g) => ({ num: g.num, name: g.name, mat: g.mat, L: g.L, W: g.W, qty: g.qty, rot: g.rot });
  function optimize(R) {
    const mats = P.MAT_ORDER.filter((m) => R.nests[m] && R.nests[m].sheets.length);
    const jobs = mats.map((m) => {
      const mi = R.nests[m].mat, items = [];
      for (const g of R.byMat[m]) for (let i = 0; i < g.qty; i++) items.push({ num: g.num, L: g.L, W: g.W, rot: g.rot });
      return { mat: m, SL: mi.L - 2 * P.S.trim, SW: mi.W - 2 * P.S.trim, kerf: P.S.kerf, items };
    });
    const w = new Worker(URL.createObjectURL(new Blob(['(' + P.workerMain.toString() + ')()'], { type: 'text/javascript' })));
    // A negative budget stops after the 40 fixed tries plus the first random one: repeatable.
    return new Promise((resolve) => {
      w.onmessage = (e) => { if (e.data.type === 'done') { w.terminate(); resolve({ jobs, out: e.data.out }); } };
      w.postMessage({ jobs, budget: -1 });
    });
  }
  async function scenario(name, settings) {
    applySettings(settings);
    const R = P.fullCompute();
    const info = new Map(R.groups.map((g) => [g.num, g]));
    const quick = {};
    for (const m of Object.keys(R.nests)) {
      const N = R.nests[m];
      quick[m] = { mat: N.mat, sheets: N.sheets, failed: N.failed, steps: N.sheets.map((sh) => stepsText(P.cutPlanHtml(sh, N.mat, info))), signature: P.sigFor(R, m) };
    }
    const { jobs, out } = await optimize(R);
    const optimized = {};
    for (const job of jobs) {
      const o = out[job.mat], mi = R.nests[job.mat].mat;
      const area = mi.L * mi.W;
      const accepted = o.sheets.map((sh) => {
        const strips = sh.strips.map((st) => ({ ...st, parts: st.segs.flatMap((sg) => sg.items) }));
        const used = strips.reduce((a, st) => a + st.parts.reduce((b, p) => b + p.L * p.W, 0), 0);
        return { strips, area: used, yield: used / area };
      });
      optimized[job.mat] = { job, raw: o.sheets, iters: o.iters, sheets: accepted, steps: accepted.map((sh) => stepsText(P.cutPlanHtml(sh, mi, info))) };
    }
    const kickParts = R.parts.filter((p) => p.cab === 'Kick');
    const cabinets = R.cabs.map((x) => ({ id: x.id, type: x.c.type, placed: x.c.wall === 'L' || x.c.wall === 'R' }));
    return plain({
      name, settings: settings || {},
      groups: R.groups.map(groupOut), warns: R.warns,
      quick, optimized,
      consumablesInput: { kickParts, cabinets, platformRuns: platformRuns(R) },
      consumables: P.consumables(R), counts: P.matCounts(R), plyCost: P.plyCost(R),
    });
  }
  const scenarios = [await scenario('starter, defaults'), await scenario('starter, all box parts ignore grain', { rotBox: true }), await scenario('starter, kerf 3/16 and trim 1/4', { kerf: 0.1875, trim: 0.25 })];

  // Synthetic: parts that do not fit, a part that only fits turned, and a nearly empty strip.
  applySettings({});
  const part = (name, L, W, rot, qty = 1) => ({ cab: 'P1', name, mat: 'box', L, W, qty, band: { l: 0, w: 0 }, rot, note: '' });
  const R = { cabs: [], warns: [], groups: [], byMat: {}, nests: {}, parts: [part('Too long', 100, 10, false), part('Too wide', 50, 50, true), part('Turn me', 20, 60, true), part('Strip', 90, 3, false, 3), part('Tiny', 4, 2, false, 5)] };
  P.finalize(R);
  const synthetic = plain({ groups: R.groups.map(groupOut), warns: R.warns, nest: R.nests.box, steps: R.nests.box.sheets.map((sh) => stepsText(P.cutPlanHtml(sh, R.nests.box.mat, new Map(R.groups.map((g) => [g.num, g]))))) });
  applySettings({});
  return { page, scenarios, synthetic };
});
writeFileSync(sheetsPath, JSON.stringify({ note: 'Generated by scripts/prototype-fixtures.mjs from docs/prototype/cabinet-planner.html. Do not edit by hand.', ...sheets }) + '\n');
console.log(`Wrote ${sheets.scenarios.length} sheet scenarios and synthetic nest cases to ${sheetsPath}`);

await browser.close();

const doc = {
  note: 'Generated by scripts/prototype-fixtures.mjs from docs/prototype/cabinet-planner.html. Do not edit by hand.',
  ...result,
};
writeFileSync(outPath, JSON.stringify(doc, null, 1) + '\n');
console.log(`Wrote ${result.cases.length} cabinet cases and ${result.cutlists.length} cut lists to ${outPath}`);
