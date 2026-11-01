import { APP_NAME } from './app';
import { Editor, type Tool } from './editor/editor';
import { parseProject, sampleProject, serializeProject } from './model';
import type { Plan, Project } from './model';
import { browserStore, fileNameFor, loadAutosave, saveAutosave } from './storage';
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
  ['cabinets', 'Cabinets', 'C'],
];

root.innerHTML = `
  <header class="toolbar">
    <h1>${APP_NAME}</h1>
    <div class="tools" role="toolbar" aria-label="Drawing tools">
      ${TOOLS.map(([t, label, key]) => `<button class="tool" data-tool="${t}" title="${label}${key ? ` (${key})` : ''}">${label}</button>`).join('')}
    </div>
    <label class="name"><span class="sr">Project name</span><input id="project-name" class="in" maxlength="80" autocomplete="off" aria-label="Project name"></label>
    <div class="actions files">
      <button class="btn" data-cmd="save" title="Download the plan as a file">Save file</button>
      <button class="btn" data-cmd="open" title="Open a saved plan file">Open file</button>
      <input id="open-file" type="file" accept=".json,application/json" hidden>
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
      <div class="status" id="status" role="status" aria-live="polite"></div>
    </section>
    <section class="pane view-pane" aria-label="3D view"><div class="view3d"></div></section>
    <aside class="panel" aria-label="Properties"></aside>
  </main>`;

const q = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
// Start from the last autosave if there is one, else the sample room.
const store = browserStore();
const restored = loadAutosave(store);
let project: Project = restored.status === 'ok' ? restored.project : sampleProject();
let startNote = '';
if (restored.status === 'ok') startNote = restored.migratedFrom !== undefined ? 'Restored your last plan (upgraded from an older file format).' : 'Restored your last plan.';
else if (restored.status === 'unreadable') {
  startNote = `Your last autosave could not be opened (${restored.error}) ${restored.backedUp ? 'A copy was kept in this browser.' : ''} Showing the sample room instead.`;
} else if (restored.status === 'unavailable') startNote = 'This browser is not keeping work between visits. Use Save file to keep your plan.';
const view = new PlanView(q<HTMLDivElement>('.view3d'));
view.setPlan(project.plan);

const nameInput = q<HTMLInputElement>('#project-name');
/** Names of the plans on either side of an Open, so undo and redo restore the right name. */
const namesByPlan = new WeakMap<Plan, string>();
let editorReady = false;
const statusEl = q<HTMLElement>('#status');
nameInput.value = project.name;
const say = (text: string, bad = false): void => {
  statusEl.textContent = text;
  statusEl.classList.toggle('bad', bad);
};
if (startNote) say(startNote, restored.status !== 'ok');

// Autosave: shortly after the last change, and again when the page is hidden or closed.
let saveTimer = 0;
let dirtySinceSave = false;
// The editor keeps the plan and cabinets in one undo history, so they always save together.
const current = (): Project => ({ name: nameInput.value.trim() || 'Untitled', settings: { ...editor.settings }, plan: editor.plan, cabinets: editor.cabinets });
function autosaveNow(): void {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (!dirtySinceSave) return;
  const r = saveAutosave(store, current());
  if (r.ok) {
    dirtySinceSave = false;
    say(`Autosaved in this browser at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
  } else say(r.error, true);
}
function changedForSave(): void {
  dirtySinceSave = true;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(autosaveNow, 500);
}
window.addEventListener('pagehide', autosaveNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosaveNow();
});

let pending: Plan | null = null;
const editor = new Editor(
  {
    svg: q<SVGSVGElement>('svg.plan'),
    bar: q<HTMLDivElement>('.bar'),
    panel: q<HTMLElement>('.panel'),
    onChange({ plan }) {
      // Rebuild the 3D view at most once per frame (dragging a corner changes the plan constantly).
      if (!pending) requestAnimationFrame(() => {
        if (pending) view.setPlan(pending);
        pending = null;
      });
      pending = plan;
      changedForSave();
    },
    onSettingsChange() {
      changedForSave();
    },
    onToolChange(tool) {
      root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    },
    onHistoryChange(canUndo, canRedo) {
      // Undo or redo across an opened file also brings back that project's name.
      if (editorReady) {
        const known = namesByPlan.get(editor.plan);
        if (known !== undefined && nameInput.value !== known) nameInput.value = known;
      }
      q<HTMLButtonElement>('[data-cmd="undo"]').disabled = !canUndo;
      q<HTMLButtonElement>('[data-cmd="redo"]').disabled = !canRedo;
    },
  },
  project.plan,
  project.settings,
  project.cabinets,
);
editorReady = true;
nameInput.addEventListener('input', changedForSave);
editor.setTool('select');

root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.addEventListener('click', () => editor.setTool(b.dataset.tool as Tool)));

let clearArmed = 0;
q<HTMLElement>('.toolbar').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cmd]');
  if (!b) return;
  const cmd = b.dataset.cmd;
  if (cmd === 'save') saveFile();
  if (cmd === 'open') q<HTMLInputElement>('#open-file').click();
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

function saveFile(): void {
  const p = current();
  const blob = new Blob([serializeProject(p)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileNameFor(p.name);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  say(`Saved ${a.download}. Check your Downloads folder.`);
}

q<HTMLInputElement>('#open-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  let text: string;
  try {
    text = await file.text();
  } catch {
    say(`Could not read ${file.name}.`, true);
    return;
  }
  const r = parseProject(text);
  if (!r.ok) {
    say(`${file.name}: ${r.error} Your current plan was not changed.`, true);
    return;
  }
  namesByPlan.set(editor.plan, nameInput.value);
  nameInput.value = r.project.name;
  editor.load(r.project.plan, r.project.settings, r.project.cabinets);
  namesByPlan.set(editor.plan, r.project.name);
  view.setPlan(editor.plan);
  view.fitToPlan(editor.plan);
  autosaveNow();
  say(`Opened ${file.name}${r.migratedFrom !== undefined ? ' (upgraded from an older format)' : ''}. Undo brings back the plan you had before.`);
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
