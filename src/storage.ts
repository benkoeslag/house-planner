import { parseProject, serializeProject, type Project } from './model';

/** The part of `localStorage` the app uses, so tests can supply a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const AUTOSAVE_KEY = 'house-planner:autosave';
/** A copy of an autosave that could not be read, kept so nothing is lost. */
export const BACKUP_KEY = 'house-planner:autosave-unreadable';

export type SaveResult = { ok: true } | { ok: false; error: string };

export type LoadResult =
  | { status: 'none' }
  | { status: 'ok'; project: Project; migratedFrom?: number }
  | { status: 'unreadable'; error: string; backedUp: boolean }
  | { status: 'unavailable' };

/** The browser's storage, or null when it is blocked (private windows, cleared site data). */
export function browserStore(): KeyValueStore | null {
  try {
    const s = window.localStorage;
    s.getItem(AUTOSAVE_KEY);
    return s;
  } catch {
    return null;
  }
}

/** Writes the project to browser storage. Never throws. */
export function saveAutosave(store: KeyValueStore | null, project: Project): SaveResult {
  if (!store) return { ok: false, error: 'This browser is not allowing the app to keep work between visits.' };
  try {
    store.setItem(AUTOSAVE_KEY, serializeProject(project));
    return { ok: true };
  } catch {
    return { ok: false, error: 'The browser has no room left to keep your work. Save the plan to a file.' };
  }
}

/**
 * Reads the last autosave. An autosave that cannot be read is copied to a backup key before
 * anything else can overwrite it, and the caller is told so it can say so.
 */
export function loadAutosave(store: KeyValueStore | null): LoadResult {
  if (!store) return { status: 'unavailable' };
  let text: string | null;
  try {
    text = store.getItem(AUTOSAVE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (text === null) return { status: 'none' };
  const r = parseProject(text);
  if (r.ok) return { status: 'ok', project: r.project, ...(r.migratedFrom !== undefined ? { migratedFrom: r.migratedFrom } : {}) };
  let backedUp = false;
  try {
    store.setItem(BACKUP_KEY, text);
    backedUp = true;
  } catch {
    // Could not copy it; leave the original where it is. It is not overwritten until the owner changes something.
  }
  return { status: 'unreadable', error: r.error, backedUp };
}

/** A safe file name for a project, for example `Main floor` -> `main-floor.house-planner.json`. */
export function fileNameFor(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'house-plan'}.house-planner.json`;
}
