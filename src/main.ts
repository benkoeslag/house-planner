import { APP_NAME } from './app';
import { sampleProject } from './model';
import type { Plan } from './model';
import { PlanView } from './view3d/plan-view';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing #app element');
document.title = APP_NAME;

const hint = document.createElement('p');
hint.className = 'label';
hint.textContent = 'Sample room. Drag to orbit, right-drag or two fingers to pan, scroll or pinch to zoom.';
root.append(hint);

const view = new PlanView(root);
view.setPlan(sampleProject().plan);

/**
 * Hook for the floor plan editor (and for trying changes from the browser console):
 * `houseplanner.setPlan(plan)` redraws the 3D view; `houseplanner.fitToPlan(plan)` also re-aims the camera.
 */
(window as unknown as { houseplanner: { setPlan(plan: Plan): void; fitToPlan(plan: Plan): void } }).houseplanner = {
  setPlan: (plan) => view.setPlan(plan),
  fitToPlan: (plan) => view.fitToPlan(plan),
};
