import { describe, expect, it } from 'vitest';
import { sampleProject, serializeProject } from '../src/model';
import { AUTOSAVE_KEY, BACKUP_KEY, fileNameFor, loadAutosave, saveAutosave, type KeyValueStore } from '../src/storage';

class FakeStore implements KeyValueStore {
  data = new Map<string, string>();
  failWrites = false;
  failReads = false;
  getItem(k: string): string | null {
    if (this.failReads) throw new Error('blocked');
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.failWrites) throw new Error('quota');
    this.data.set(k, v);
  }
}

describe('autosave', () => {
  it('reports nothing saved yet', () => {
    expect(loadAutosave(new FakeStore())).toEqual({ status: 'none' });
  });

  it('round-trips a project exactly', () => {
    const s = new FakeStore();
    const project = sampleProject();
    expect(saveAutosave(s, project)).toEqual({ ok: true });
    expect(loadAutosave(s)).toEqual({ status: 'ok', project });
  });

  it('keeps an unreadable autosave in a backup and says why', () => {
    const s = new FakeStore();
    s.data.set(AUTOSAVE_KEY, '{"format":"house-planner","version":1,"plan":{"walls":[{"id":"a"}]}}');
    const r = loadAutosave(s);
    expect(r).toMatchObject({ status: 'unreadable', backedUp: true });
    expect(s.data.get(BACKUP_KEY)).toBe(s.data.get(AUTOSAVE_KEY));
  });

  it('keeps a newer-version autosave rather than discarding it', () => {
    const s = new FakeStore();
    const doc = JSON.parse(serializeProject(sampleProject()));
    doc.version = 99;
    s.data.set(AUTOSAVE_KEY, JSON.stringify(doc));
    expect(loadAutosave(s)).toMatchObject({ status: 'unreadable', error: expect.stringMatching(/newer version/), backedUp: true });
  });

  it('survives storage that is blocked or full', () => {
    expect(saveAutosave(null, sampleProject())).toMatchObject({ ok: false });
    expect(loadAutosave(null)).toEqual({ status: 'unavailable' });
    const blocked = new FakeStore();
    blocked.failReads = true;
    expect(loadAutosave(blocked)).toEqual({ status: 'unavailable' });
    const full = new FakeStore();
    full.failWrites = true;
    expect(saveAutosave(full, sampleProject())).toMatchObject({ ok: false, error: expect.stringMatching(/no room/) });
  });

  it('reports an unreadable autosave even when the backup cannot be written', () => {
    const s = new FakeStore();
    s.data.set(AUTOSAVE_KEY, 'not json');
    s.failWrites = true;
    expect(loadAutosave(s)).toMatchObject({ status: 'unreadable', backedUp: false });
    expect(s.data.get(AUTOSAVE_KEY)).toBe('not json');
  });
});

describe('fileNameFor', () => {
  it.each([
    ['Main floor', 'main-floor.house-planner.json'],
    ['  Café / Küche #2 ', 'cafe-kuche-2.house-planner.json'],
    ['', 'house-plan.house-planner.json'],
    ['!!!', 'house-plan.house-planner.json'],
  ])('%j -> %s', (name, file) => expect(fileNameFor(name)).toBe(file));
});
