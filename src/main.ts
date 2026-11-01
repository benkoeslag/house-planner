import { APP_NAME } from './app';
import { Editor, type Tool } from './editor/editor';
import { sampleProject } from './model';
import type { Plan } from './model';
import { PlanView } from './view3d/plan-view';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app element');
document.title = APP_NAME;

const TOOLS: [Tool, string, string][] = [
  ['select', 'Select', 'V'],
  ['wall', 'Wall', 'W'],
  ['door', 'Door', ''],
  ['window', 'Window', ''],
  ['opening', 'Opening', ''],
  ['room', 'Room name', ''],
];

root.innerHTML = `
  <header class="toolbar">
    <h1>${APP_NAME}</h1>
    <div class="tools" role="toolbar" aria-label="Drawing tools">
      ${TOOLS.map(([t, label, key]) => `<button class="tool" data-tool="${t}" title="${label}${key ? ` (${key})` : ''}">${label}</button>`).join('')}
    </div>
    <div class="actions">
      <button class="btn" data-cmd="undo" title="Undo (Ctrl+Z)">Undo</button>
      <button class="btn" data-cmd="redo" title="Redo (Ctrl+Shift+Z)">Redo</button>
      <button class="btn" data-cmd="fit" title="Show the whole plan">Fit</button>
      <button class="btn" data-cmd="clear" title="Start an empty plan">New</button>
    </div>
    <div class="switch" role="tablist" aria-label="View">
      <button role="tab" data-pane="plan" aria-selected="true">Plan</button>
      <button role="tab" data-pane="view3d" aria-selected="false">3D</button>
    </div>
  </header>
  <main class="work" data-show="plan">
    <section class="pane plan-pane" aria-label="Floor plan">
      <svg class="plan" role="img" aria-label="Floor plan drawing"></svg>
      <div class="bar"></div>
    </section>
    <section class="pane view-pane" aria-label="3D view"><div class="view3d"></div></section>
    <aside class="panel" aria-label="Properties"></aside>
  </main>`;

const q = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const project = sampleProject();
const view = new PlanView(q<HTMLDivElement>('.view3d'));
view.setPlan(project.plan);

let pending: Plan | null = null;
const editor = new Editor(
  {
    svg: q<SVGSVGElement>('svg.plan'),
    bar: q<HTMLDivElement>('.bar'),
    panel: q<HTMLElement>('.panel'),
    onPlanChange(plan) {
      // Rebuild the 3D view at most once per frame (dragging a corner changes the plan constantly).
      if (!pending) requestAnimationFrame(() => {
        if (pending) view.setPlan(pending);
        pending = null;
      });
      pending = plan;
    },
    onToolChange(tool) {
      root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    },
    onHistoryChange(canUndo, canRedo) {
      q<HTMLButtonElement>('[data-cmd="undo"]').disabled = !canUndo;
      q<HTMLButtonElement>('[data-cmd="redo"]').disabled = !canRedo;
    },
  },
  project.plan,
  project.settings,
);
editor.setTool('select');

root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.addEventListener('click', () => editor.setTool(b.dataset.tool as Tool)));

let clearArmed = 0;
root.querySelector('.actions')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cmd]');
  if (!b) return;
  const cmd = b.dataset.cmd;
  if (cmd === 'undo') editor.undo();
  if (cmd === 'redo') editor.redo();
  if (cmd === 'fit') {
    editor.fit();
    view.fitToPlan(editor.plan);
  }
  if (cmd === 'clear') {
    if (!clearArmed) {
      b.textContent = 'Click again to clear';
      clearArmed = window.setTimeout(() => {
        clearArmed = 0;
        b.textContent = 'New';
      }, 3000);
      return;
    }
    clearTimeout(clearArmed);
    clearArmed = 0;
    b.textContent = 'New';
    editor.clear();
    editor.setTool('wall');
  }
});

const work = q<HTMLElement>('.work');
root.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach((b) =>
  b.addEventListener('click', () => {
    work.dataset.show = b.dataset.pane;
    root.querySelectorAll<HTMLButtonElement>('[data-pane]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    if (b.dataset.pane === 'view3d') view.fitToPlan(editor.plan);
    else editor.fit();
  }),
);

/** Console hook: `houseplanner.plan()` returns the current plan; `setPlan`/`fitToPlan` drive the 3D view. */
(window as unknown as { houseplanner: object }).houseplanner = {
  plan: () => editor.plan,
  setPlan: (plan: Plan) => view.setPlan(plan),
  fitToPlan: (plan: Plan) => view.fitToPlan(plan),
};
