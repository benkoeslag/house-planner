/**
 * Undo and redo. Values are never changed in place (a change makes a new value), so keeping
 * references is enough. The editor keeps the plan and the cabinets together in one value, so walls
 * and cabinets undo as one history.
 */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(
    private current: T,
    private readonly limit = 200,
  ) {}

  get value(): T {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Records a new value. Clears anything that could have been redone. */
  push(value: T): void {
    if (value === this.current) return;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = value;
    this.future = [];
  }

  /** Replaces the current value without an undo step (for example while dragging). */
  replace(value: T): void {
    this.current = value;
  }

  undo(): T {
    const prev = this.past.pop();
    if (prev) {
      this.future.push(this.current);
      this.current = prev;
    }
    return this.current;
  }

  redo(): T {
    const next = this.future.pop();
    if (next) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }

  /** Starts over with a value and no history. */
  reset(value: T): void {
    this.past = [];
    this.future = [];
    this.current = value;
  }
}
