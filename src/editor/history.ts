import type { Plan } from '../model/types';

/** Undo and redo for plans. Plans are never changed in place, so keeping references is enough. */
export class History {
  private past: Plan[] = [];
  private future: Plan[] = [];

  constructor(
    private current: Plan,
    private readonly limit = 200,
  ) {}

  get plan(): Plan {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Records a new plan. Clears anything that could have been redone. */
  push(plan: Plan): void {
    if (plan === this.current) return;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = plan;
    this.future = [];
  }

  /** Replaces the current plan without an undo step (for example while dragging). */
  replace(plan: Plan): void {
    this.current = plan;
  }

  undo(): Plan {
    const prev = this.past.pop();
    if (prev) {
      this.future.push(this.current);
      this.current = prev;
    }
    return this.current;
  }

  redo(): Plan {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }

  /** Starts over with a plan and no history. */
  reset(plan: Plan): void {
    this.past = [];
    this.future = [];
    this.current = plan;
  }
}
