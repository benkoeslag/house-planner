import { distance, pointInPolygon, samePoint } from '../model/geometry';
import { validateOpenings } from '../model/openings';
import { randomIds } from '../model/plan-ops';
import { detectRooms, toSquareFeet } from '../model/rooms';
import type { OpeningKind, Plan, Point, ProjectSettings } from '../model/types';
import { formatFeetInches, formatFraction, parseLength } from '../model/units';
import { wallGeometry, type WallGeometry } from '../model/walls';
import { planBounds } from '../view3d/pieces';
import { History } from './history';
import { hitTest } from './hit';
import {
  fromEndCorner,
  fromStartCorner,
  moveEndpoint,
  placeOpening,
  placeWall,
  setRoomName,
  setWallLength,
  setWallProps,
  updateOpening,
} from './ops';
import { drawPlan, toWorld, type Selection, type View } from './plan-canvas';
import { draftEnd, snapPoint, type Snap } from './snap';

export type Tool = 'select' | 'wall' | 'door' | 'window' | 'opening' | 'room';

interface Draft {
  start: Point;
  chainStart: Point;
  cursor?: Snap;
  angle?: number;
}

export interface EditorHost {
  svg: SVGSVGElement;
  bar: HTMLElement;
  panel: HTMLElement;
  /** Called after every change with the current plan, for the 3D view. */
  onPlanChange(plan: Plan): void;
  /** Called when the tool changes, for highlighting toolbar buttons. */
  onToolChange(tool: Tool): void;
  onHistoryChange(canUndo: boolean, canRedo: boolean): void;
  /** Called when the default wall thickness or height changes. */
  onSettingsChange?(settings: ProjectSettings): void;
}

const PICK_PX = 10;
const DRAG_PX = 4;
const fmt = (n: number): string => formatFraction(n, 16);

export class Editor {
  readonly history: History;
  settings: ProjectSettings;
  private tool: Tool = 'select';
  private selection: Selection = null;
  private draft: Draft | null = null;
  private view: View = { cx: 0, cy: 0, s: 2 };
  private geometry: Map<string, WallGeometry>;
  private hoverWall?: string;
  private hoverSnap?: Snap;
  private message = '';
  private pointers = new Map<number, Point>();
  private press: { id: number; start: Point; moved: boolean; mode: 'pan' | 'drag-corner' | 'click'; corner?: Point; before?: Plan; viewStart?: View } | null = null;
  private pinch: { dist: number; mid: Point; view: View } | null = null;
  private ids = randomIds;
  private lastSize: { width: number; height: number } | null = null;

  constructor(
    private readonly host: EditorHost,
    plan: Plan,
    settings: ProjectSettings,
  ) {
    this.history = new History(plan);
    this.settings = { ...settings };
    this.geometry = wallGeometry(plan);
    this.bindEvents();
    new ResizeObserver(() => this.render()).observe(host.svg);
    this.fit();
    this.changed(false);
  }

  get plan(): Plan {
    return this.history.plan;
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.draft = null;
    this.hoverWall = undefined;
    this.message = '';
    if (tool !== 'select') this.selection = null;
    this.host.onToolChange(tool);
    this.renderAll();
  }

  undo(): void {
    this.history.undo();
    this.afterHistoryMove();
  }

  redo(): void {
    this.history.redo();
    this.afterHistoryMove();
  }

  /** Starts over with an empty plan (undo still works). */
  clear(): void {
    this.commit({ walls: [], openings: [], roomLabels: [] });
    this.selection = null;
    this.draft = null;
    this.renderAll();
  }

  /**
   * Replaces the plan and settings, for opening a file. This is an ordinary undoable change, so
   * undo brings the previous plan back.
   */
  load(plan: Plan, settings: ProjectSettings): void {
    this.settings = { ...settings };
    this.selection = null;
    this.draft = null;
    this.commit(plan);
    this.setTool('select');
    this.fit();
    this.host.onSettingsChange?.(this.settings);
  }

  /** Fits the whole plan in the canvas. */
  fit(): void {
    const { width, height } = this.size();
    const b = planBounds(this.plan);
    if (!b) {
      this.view = { cx: 120, cy: 120, s: Math.min(width, height) / 360 };
      this.lastSize = { width, height };
    } else {
      const w = b.max.x - b.min.x + 48;
      const h = b.max.y - b.min.y + 48;
      this.view = { cx: (b.min.x + b.max.x) / 2, cy: (b.min.y + b.max.y) / 2, s: Math.max(0.1, Math.min(width / w, height / h)) };
    }
    this.lastSize = { width, height };
    this.render();
  }

  // ---- changes ---------------------------------------------------------------------------

  private commit(plan: Plan): void {
    this.history.push(plan);
    this.changed(true);
  }

  private changed(notify: boolean): void {
    this.geometry = wallGeometry(this.plan);
    // Drop a selection whose item no longer exists.
    const s = this.selection;
    if (s?.kind === 'wall' && !this.plan.walls.some((w) => w.id === s.id)) this.selection = null;
    if (s?.kind === 'opening' && !this.plan.openings.some((o) => o.id === s.id)) this.selection = null;
    if (notify) this.host.onPlanChange(this.plan);
    this.host.onHistoryChange(this.history.canUndo, this.history.canRedo);
    this.renderAll();
  }

  private afterHistoryMove(): void {
    this.draft = null;
    this.changed(true);
    // Undoing across a very different plan (for example after opening a file) can leave it out of view.
    const b = planBounds(this.plan);
    if (b) {
      const { width, height } = this.size();
      const hx = width / 2 / this.view.s;
      const hy = height / 2 / this.view.s;
      const inside = b.min.x >= this.view.cx - hx && b.max.x <= this.view.cx + hx && b.min.y >= this.view.cy - hy && b.max.y <= this.view.cy + hy;
      if (!inside) this.fit();
    }
  }

  private apply(r: { ok: true; plan: Plan; id?: string } | { ok: false; error: string }): string | undefined {
    if (!r.ok) {
      this.message = r.error;
      this.renderAll();
      return undefined;
    }
    this.message = '';
    this.commit(r.plan);
    return r.id ?? '';
  }

  // ---- drawing walls -------------------------------------------------------------------

  private draftEndPoint(length?: number): Point | null {
    if (!this.draft) return null;
    return draftEnd({ start: this.draft.start, cursor: this.draft.cursor, length, angle: this.draft.angle, snapAngles: true });
  }

  private typedLength(): number | undefined {
    const input = this.host.bar.querySelector<HTMLInputElement>('#draft-length');
    const v = input ? parseLength(input.value) : null;
    return v === null ? undefined : v;
  }

  /** Places the wall being drawn and starts the next one at its end. */
  private placeDraft(end: Point | null): void {
    if (!this.draft || !end) return;
    const { start, chainStart } = this.draft;
    const id = this.apply(placeWall(this.plan, start, end, { thickness: this.settings.wallThickness, height: this.settings.wallHeight }, this.ids));
    if (id === undefined) return;
    if (samePoint(end, chainStart)) {
      this.draft = null; // closed the room
      this.message = 'Room closed. Click to start another wall, or pick another tool.';
    } else {
      this.draft = { start: { ...end }, chainStart, angle: undefined };
    }
    this.renderAll();
    this.focusLength();
  }

  private focusLength(): void {
    const input = this.host.bar.querySelector<HTMLInputElement>('#draft-length');
    if (input) {
      input.value = '';
      input.focus({ preventScroll: true });
    }
  }

  // ---- pointer -------------------------------------------------------------------------

  private size(): { width: number; height: number } {
    const r = this.host.svg.getBoundingClientRect();
    return { width: Math.max(1, r.width), height: Math.max(1, r.height) };
  }

  private worldAt(e: { clientX: number; clientY: number }): Point {
    const r = this.host.svg.getBoundingClientRect();
    const { width, height } = this.size();
    return toWorld(this.view, width, height, { x: e.clientX - r.left, y: e.clientY - r.top });
  }

  private bindEvents(): void {
    const svg = this.host.svg;
    svg.addEventListener('pointerdown', (e) => this.onDown(e));
    svg.addEventListener('pointermove', (e) => this.onMove(e));
    svg.addEventListener('pointerup', (e) => this.onUp(e));
    svg.addEventListener('pointercancel', (e) => this.onUp(e, true));
    svg.addEventListener('pointerleave', () => {
      this.hoverSnap = undefined;
      this.render();
    });
    svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    svg.addEventListener('dblclick', () => {
      if (this.draft) {
        this.draft = null;
        this.renderAll();
      }
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.host.bar.addEventListener('keydown', (e) => this.onBarKey(e));
    this.host.bar.addEventListener('input', () => this.render());
    this.host.panel.addEventListener('change', (e) => this.onPanelChange(e));
    this.host.panel.addEventListener('click', (e) => this.onPanelClick(e));
  }

  private onDown(e: PointerEvent): void {
    this.host.svg.setPointerCapture(e.pointerId);
    const p = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [Point, Point];
      this.pinch = { dist: distance(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: { ...this.view } };
      this.press = null;
      return;
    }
    let mode: 'pan' | 'drag-corner' | 'click' = 'click';
    let corner: Point | undefined;
    if (e.button === 1) mode = 'pan';
    else if (this.tool === 'select') {
      const hit = hitTest(this.plan, this.geometry, this.worldAt(e), PICK_PX / this.view.s);
      if (hit?.kind === 'endpoint') {
        mode = 'drag-corner';
        corner = hit.point;
      } else if (!hit) mode = 'pan';
    }
    this.press = { id: e.pointerId, start: p, moved: false, mode, corner, before: this.plan, viewStart: { ...this.view } };
  }

  private onMove(e: PointerEvent): void {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [Point, Point];
      const k = distance(a, b) / this.pinch.dist;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const v0 = this.pinch.view;
      const s = Math.min(40, Math.max(0.05, v0.s * k));
      this.view = { s, cx: v0.cx - (mid.x - this.pinch.mid.x) / s, cy: v0.cy + (mid.y - this.pinch.mid.y) / s };
      this.render();
      return;
    }
    const world = this.worldAt(e);
    const press = this.press;
    if (press && press.id === e.pointerId) {
      const dx = e.clientX - press.start.x;
      const dy = e.clientY - press.start.y;
      if (!press.moved && Math.hypot(dx, dy) > DRAG_PX) press.moved = true;
      if (press.moved && press.mode === 'click' && this.tool !== 'select') press.mode = 'pan';
      if (press.moved && press.mode === 'pan') {
        const v0 = press.viewStart!;
        this.view = { ...v0, cx: v0.cx - dx / v0.s, cy: v0.cy + dy / v0.s };
        this.render();
        return;
      }
      if (press.moved && press.mode === 'drag-corner' && press.corner) {
        const others = { ...press.before!, walls: press.before!.walls.filter((w) => !samePoint(w.a, press.corner!) && !samePoint(w.b, press.corner!)) };
        const snap = snapPoint(others, world, PICK_PX / this.view.s);
        this.hoverSnap = snap;
        this.history.replace(moveEndpoint(press.before!, press.corner, snap.point));
        this.geometry = wallGeometry(this.plan);
        this.host.onPlanChange(this.plan);
        this.render();
        return;
      }
    }
    // Hover feedback
    const tol = PICK_PX / this.view.s;
    if (this.tool === 'wall') {
      this.hoverSnap = snapPoint(this.plan, world, tol);
      if (this.draft) this.draft.cursor = this.hoverSnap;
    } else if (this.tool === 'door' || this.tool === 'window' || this.tool === 'opening') {
      const hit = hitTest(this.plan, this.geometry, world, tol);
      this.hoverWall = hit?.kind === 'wall' ? hit.id : undefined;
    } else {
      this.hoverSnap = undefined;
    }
    this.render();
  }

  private onUp(e: PointerEvent, cancelled = false): void {
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const press = this.press;
    this.press = null;
    if (!press || press.id !== e.pointerId || cancelled) return;
    if (press.mode === 'drag-corner' && press.moved) {
      const after = this.plan;
      this.history.replace(press.before!);
      this.hoverSnap = undefined;
      if (after !== press.before) this.commit(after);
      return;
    }
    if (press.moved) return;
    this.click(this.worldAt(e));
  }

  private click(world: Point): void {
    const tol = PICK_PX / this.view.s;
    this.message = '';
    switch (this.tool) {
      case 'wall': {
        const snap = snapPoint(this.plan, world, tol);
        if (!this.draft) {
          this.draft = { start: snap.point, chainStart: snap.point, cursor: snap };
          this.renderAll();
          this.focusLength();
        } else {
          this.draft.cursor = snap;
          this.placeDraft(this.draftEndPoint(this.typedLength()));
        }
        return;
      }
      case 'door':
      case 'window':
      case 'opening': {
        const hit = hitTest(this.plan, this.geometry, world, tol);
        if (hit?.kind !== 'wall') {
          this.message = 'Click on a wall to put it there.';
          this.renderAll();
          return;
        }
        const id = this.apply(placeOpening(this.plan, hit.id, hit.at, this.tool as OpeningKind, this.ids, this.geometry));
        if (id) {
          this.setTool('select');
          this.selection = { kind: 'opening', id };
          this.renderAll();
        }
        return;
      }
      case 'room': {
        const room = detectRooms(this.plan).find((r) => pointInPolygon(world, r.centerline));
        if (!room) {
          this.message = 'Click inside a closed room to name it.';
          this.renderAll();
          return;
        }
        this.selection = { kind: 'room', at: world };
        this.renderAll();
        this.host.panel.querySelector<HTMLInputElement>('#room-name')?.focus();
        return;
      }
      case 'select': {
        const hit = hitTest(this.plan, this.geometry, world, tol);
        if (hit?.kind === 'wall') this.selection = { kind: 'wall', id: hit.id };
        else if (hit?.kind === 'opening') this.selection = { kind: 'opening', id: hit.id };
        else {
          const room = detectRooms(this.plan).find((r) => pointInPolygon(world, r.centerline));
          this.selection = room ? { kind: 'room', at: world } : null;
        }
        this.renderAll();
      }
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const before = this.worldAt(e);
    const k = Math.exp(-e.deltaY * 0.0015);
    this.view = { ...this.view, s: Math.min(40, Math.max(0.05, this.view.s * k)) };
    const after = this.worldAt(e);
    this.view.cx += before.x - after.x;
    this.view.cy += before.y - after.y;
    this.render();
  }

  // ---- keyboard ------------------------------------------------------------------------

  private onKey(e: KeyboardEvent): void {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (typing) return;
    if (e.key === 'Escape') {
      if (this.draft) this.draft = null;
      else this.selection = null;
      this.renderAll();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      this.deleteSelection();
    } else if (e.key === 'w' || e.key === 'W') this.setTool('wall');
    else if (e.key === 'v' || e.key === 'V') this.setTool('select');
  }

  private onBarKey(e: KeyboardEvent): void {
    const target = e.target as HTMLInputElement;
    if (!this.draft) return;
    const arrows: Record<string, number> = { ArrowRight: 0, ArrowUp: 90, ArrowLeft: 180, ArrowDown: 270 };
    if (e.key in arrows) {
      e.preventDefault();
      this.draft.angle = arrows[e.key];
      this.renderAll();
      this.host.bar.querySelector<HTMLInputElement>('#draft-length')?.focus();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.draft = null;
      this.renderAll();
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (target.id === 'draft-angle') {
      const a = Number(target.value);
      if (target.value.trim() !== '' && Number.isFinite(a)) this.draft.angle = ((a % 360) + 360) % 360;
    }
    const len = this.typedLength();
    if (len === undefined) {
      this.message = 'Type a length, for example 142 or 11\' 10 3/8".';
      this.renderAll();
      return;
    }
    const angleInput = this.host.bar.querySelector<HTMLInputElement>('#draft-angle');
    if (angleInput && angleInput.value.trim() !== '' && Number.isFinite(Number(angleInput.value))) {
      this.draft.angle = ((Number(angleInput.value) % 360) + 360) % 360;
    }
    this.placeDraft(this.draftEndPoint(len));
  }

  private deleteSelection(): void {
    const s = this.selection;
    if (s?.kind === 'wall') {
      this.commit({ ...this.plan, walls: this.plan.walls.filter((w) => w.id !== s.id), openings: this.plan.openings.filter((o) => o.wallId !== s.id) });
    } else if (s?.kind === 'opening') {
      this.commit({ ...this.plan, openings: this.plan.openings.filter((o) => o.id !== s.id) });
    }
    this.selection = null;
    this.renderAll();
  }

  // ---- panel ---------------------------------------------------------------------------

  private onPanelClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'delete') this.deleteSelection();
    if (el.dataset.action === 'deselect') {
      this.selection = null;
      this.renderAll();
    }
  }

  private onPanelChange(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    const field = el.dataset.field;
    if (!field) return;
    const s = this.selection;
    const len = (): number | null => {
      const v = parseLength(el.value);
      if (v === null) {
        this.message = `"${el.value}" is not a length. Try 32, 2' 8" or 31 1/2.`;
        this.renderAll();
      }
      return v;
    };
    if (field === 'defaultThickness' || field === 'defaultHeight') {
      const v = len();
      if (v !== null && v > 0) {
        if (field === 'defaultThickness') this.settings.wallThickness = v;
        else this.settings.wallHeight = v;
        this.host.onSettingsChange?.(this.settings);
      }
      this.renderAll();
      return;
    }
    if (s?.kind === 'wall') {
      const v = len();
      if (v === null) return;
      if (field === 'length') this.apply(setWallLength(this.plan, s.id, v));
      if (field === 'thickness') this.apply(setWallProps(this.plan, s.id, { thickness: v }));
      if (field === 'height') this.apply(setWallProps(this.plan, s.id, { height: v }));
    } else if (s?.kind === 'opening') {
      const o = this.plan.openings.find((x) => x.id === s.id);
      const g = o && this.geometry.get(o.wallId);
      if (!o || !g) return;
      if (field === 'hinge' || field === 'side') {
        const swing = { ...(o.swing ?? { hinge: 'start' as const, side: 'left' as const }), [field]: el.value };
        this.apply(updateOpening(this.plan, o.id, { swing }));
        return;
      }
      if (field === 'kind') {
        this.apply(updateOpening(this.plan, o.id, { kind: el.value as OpeningKind }));
        return;
      }
      const v = len();
      if (v === null) return;
      if (field === 'fromStart') this.apply(updateOpening(this.plan, o.id, { offset: g.clear.from + v }));
      if (field === 'fromEnd') this.apply(updateOpening(this.plan, o.id, { offset: g.clear.to - v - o.width }));
      if (field === 'width') this.apply(updateOpening(this.plan, o.id, { width: v }));
      if (field === 'height') this.apply(updateOpening(this.plan, o.id, { height: v }));
      if (field === 'sill') this.apply(updateOpening(this.plan, o.id, { sill: v }));
    } else if (s?.kind === 'room' && field === 'roomName') {
      this.apply(setRoomName(this.plan, s.at, el.value, this.ids));
    }
  }

  // ---- rendering -----------------------------------------------------------------------

  private renderAll(): void {
    this.render();
    this.renderBar();
    this.renderPanel();
  }

  private render(): void {
    const { width, height } = this.size();
    // Keep the top-left corner of the drawing still when the canvas changes size (for example when
    // the length bar below it grows), so the plan does not shift under the pointer.
    if (this.lastSize && (this.lastSize.width !== width || this.lastSize.height !== height)) {
      this.view.cx += (width - this.lastSize.width) / 2 / this.view.s;
      this.view.cy -= (height - this.lastSize.height) / 2 / this.view.s;
    }
    this.lastSize = { width, height };
    this.host.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    let draft: { start: Point; end: Point | null; thickness: number } | undefined;
    if (this.draft) draft = { start: this.draft.start, end: this.draftEndPoint(this.typedLength()), thickness: this.settings.wallThickness };
    this.host.svg.innerHTML = drawPlan({
      plan: this.plan,
      geometry: this.geometry,
      view: this.view,
      width,
      height,
      selection: this.selection,
      handles: this.tool === 'select',
      hoverWall: this.hoverWall,
      draft,
      snap: this.tool === 'wall' || this.press?.mode === 'drag-corner' ? this.hoverSnap : undefined,
    });
  }

  private renderBar(): void {
    const bar = this.host.bar;
    const hints: Record<Tool, string> = {
      select: 'Click a wall, door, window or room to edit it. Drag a corner to move it. Drag empty space to pan; scroll or pinch to zoom.',
      wall: 'Click where the wall starts.',
      door: 'Click on a wall to add a door.',
      window: 'Click on a wall to add a window.',
      opening: 'Click on a wall to add an opening with no door.',
      room: 'Click inside a room to name it.',
    };
    const msg = this.message ? `<span class="bar-message" role="status">${escapeHtml(this.message)}</span>` : '';
    if (this.tool === 'wall' && this.draft) {
      const prevLen = bar.querySelector<HTMLInputElement>('#draft-length')?.value ?? '';
      const angle = this.draft.angle;
      bar.innerHTML = `<label>Length <input id="draft-length" class="in" inputmode="decimal" autocomplete="off" placeholder="e.g. 142 or 11' 10 3/8&quot;" value="${escapeHtml(prevLen)}"></label>
        <label>Angle <input id="draft-angle" class="in short" inputmode="decimal" autocomplete="off" placeholder="mouse" value="${angle === undefined ? '' : angle}"></label>
        <span class="hint">Enter places it · arrow keys set the direction · click the first corner to close · Esc stops</span>${msg}`;
    } else {
      bar.innerHTML = `<span class="hint">${hints[this.tool]}</span>${msg}`;
    }
  }

  private renderPanel(): void {
    const p = this.plan;
    const s = this.selection;
    const field = (label: string, name: string, value: string, note = '') =>
      `<label class="field"><span>${label}</span><input class="in" data-field="${name}" value="${escapeHtml(value)}" inputmode="decimal" autocomplete="off"></label>${note ? `<p class="note">${note}</p>` : ''}`;
    let html = '';
    if (s?.kind === 'wall') {
      const g = this.geometry.get(s.id);
      if (g) {
        html = `<h2>Wall</h2>
          ${field('Length (centerline)', 'length', fmt(g.length), 'Changing the length moves the far end; walls joined there follow.')}
          <p class="facts">Faces: ${formatFeetInches(g.faces.left.to - g.faces.left.from)} and ${formatFeetInches(g.faces.right.to - g.faces.right.from)}</p>
          ${field('Thickness', 'thickness', fmt(g.wall.thickness))}
          ${field('Height', 'height', fmt(g.wall.height))}
          <div class="row"><button class="btn danger" data-action="delete">Delete wall</button><button class="btn" data-action="deselect">Done</button></div>`;
      }
    } else if (s?.kind === 'opening') {
      const o = p.openings.find((x) => x.id === s.id);
      const g = o && this.geometry.get(o.wallId);
      if (o && g) {
        const problems = validateOpenings(p, this.geometry).filter((x) => x.openingId === o.id);
        const kindSel = `<label class="field"><span>Type</span><select class="in" data-field="kind">${(['door', 'window', 'opening'] as const)
          .map((k) => `<option value="${k}"${o.kind === k ? ' selected' : ''}>${k[0]!.toUpperCase() + k.slice(1)}</option>`)
          .join('')}</select></label>`;
        const swing = o.swing ?? { hinge: 'start', side: 'left' };
        const swingSel =
          o.kind === 'door'
            ? `<label class="field"><span>Hinges at</span><select class="in" data-field="hinge"><option value="start"${swing.hinge === 'start' ? ' selected' : ''}>First end</option><option value="end"${swing.hinge === 'end' ? ' selected' : ''}>Other end</option></select></label>
               <label class="field"><span>Swings to</span><select class="in" data-field="side"><option value="left"${swing.side === 'left' ? ' selected' : ''}>One side</option><option value="right"${swing.side === 'right' ? ' selected' : ''}>Other side</option></select></label>`
            : '';
        html = `<h2>${o.kind === 'door' ? 'Door' : o.kind === 'window' ? 'Window' : 'Opening'}</h2>
          ${kindSel}
          ${field('From corner (one end)', 'fromStart', fmt(fromStartCorner(g, o)), 'Measured from the inside corner to the edge of the opening.')}
          ${field('From corner (other end)', 'fromEnd', fmt(fromEndCorner(g, o)))}
          ${field('Width', 'width', fmt(o.width))}
          ${field('Height', 'height', fmt(o.height))}
          ${o.kind === 'window' ? field('Sill height', 'sill', fmt(o.sill)) : ''}
          ${swingSel}
          ${problems.map((x) => `<p class="problem">${escapeHtml(x.message)}</p>`).join('')}
          <div class="row"><button class="btn danger" data-action="delete">Delete</button><button class="btn" data-action="deselect">Done</button></div>`;
      }
    } else if (s?.kind === 'room') {
      const room = detectRooms(p).find((r) => pointInPolygon(s.at, r.centerline));
      if (room) {
        html = `<h2>Room</h2>
          <label class="field"><span>Name</span><input id="room-name" class="in" data-field="roomName" value="${escapeHtml(room.name ?? '')}" placeholder="e.g. Kitchen" autocomplete="off"></label>
          <p class="facts">${(Math.round(toSquareFeet(room.area) * 10) / 10).toFixed(1)} sq ft inside the walls</p>
          <div class="row"><button class="btn" data-action="deselect">Done</button></div>`;
      }
    }
    if (!html) {
      const rooms = detectRooms(p);
      const problems = validateOpenings(p, this.geometry);
      html = `<h2>Plan</h2>
        <p class="facts">${p.walls.length} walls · ${rooms.length} room${rooms.length === 1 ? '' : 's'} · ${p.openings.length} doors and windows</p>
        ${rooms.length ? `<ul class="rooms">${rooms.map((r) => `<li><span>${escapeHtml(r.name ?? 'Unnamed room')}</span><span>${(Math.round(toSquareFeet(r.area) * 10) / 10).toFixed(1)} sq ft</span></li>`).join('')}</ul>` : ''}
        ${problems.length ? `<p class="problem">${problems.length} door or window problem${problems.length === 1 ? '' : 's'}; they show in red. Click one to see what is wrong.</p>` : ''}
        <h3>New walls</h3>
        ${field('Thickness', 'defaultThickness', fmt(this.settings.wallThickness))}
        ${field('Height', 'defaultHeight', fmt(this.settings.wallHeight))}`;
    }
    this.host.panel.innerHTML = html;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
