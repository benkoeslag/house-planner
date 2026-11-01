import { describe, expect, it } from 'vitest';
import { FILE_VERSION, migrate, parseProject, sampleProject, serializeProject, type Migration } from '../src/model';

const sampleDoc = (): Record<string, unknown> => JSON.parse(serializeProject(sampleProject()));
const text = (doc: unknown): string => JSON.stringify(doc);
const errorOf = (t: string): string => {
  const r = parseProject(t);
  if (r.ok) throw new Error('expected a failure');
  return r.error;
};

describe('project file', () => {
  it('writes the current version in inches', () => {
    const doc = sampleDoc();
    expect(doc).toMatchObject({ format: 'house-planner', version: 2, units: 'in', name: 'Sample room' });
    expect(FILE_VERSION).toBe(2);
  });

  it('round-trips a project exactly', () => {
    const project = sampleProject();
    const r = parseProject(serializeProject(project));
    expect(r).toEqual({ ok: true, project });
  });

  it('rejects text that is not a project file', () => {
    expect(errorOf('not json')).toMatch(/not valid JSON/);
    expect(errorOf('{"format":"something-else","version":1}')).toMatch(/not a House Planner project file/);
    expect(errorOf('[]')).toMatch(/not a House Planner project file/);
  });

  it('refuses files from a newer version with a clear message', () => {
    expect(errorOf(text({ ...sampleDoc(), version: FILE_VERSION + 1 }))).toMatch(/newer version of House Planner/);
  });

  it('explains bad values with where they are', () => {
    const doc = sampleDoc();
    (doc.plan as { walls: { thickness: number }[] }).walls[1]!.thickness = -1;
    expect(errorOf(text(doc))).toMatch(/plan\.walls\[1\]\.thickness must be more than 0/);
  });

  it('rejects openings on walls that do not exist and repeated ids', () => {
    const doc = sampleDoc();
    (doc.plan as { openings: { wallId: string }[] }).openings[0]!.wallId = 'gone';
    expect(errorOf(text(doc))).toMatch(/door-1.*does not exist/);

    const dup = sampleDoc();
    (dup.plan as { walls: { id: string }[] }).walls[1]!.id = 'south';
    expect(errorOf(text(dup))).toMatch(/"south" is used more than once/);
  });

  it('fills in default settings and empty lists when they are missing', () => {
    const doc = sampleDoc();
    delete doc.settings;
    delete (doc.plan as Record<string, unknown>).roomLabels;
    const r = parseProject(text(doc));
    if (!r.ok) throw new Error(r.error);
    expect(r.project.settings).toEqual({ wallThickness: 4.5, wallHeight: 96 });
    expect(r.project.plan.roomLabels).toEqual([]);
  });
});

describe('migrations', () => {
  // No older format exists yet, so these use a made-up version 0 that stored "walls" at the top level.
  const fake: Record<number, Migration> = {
    0: (doc) => {
      const { walls, ...rest } = doc;
      return { ...rest, plan: { walls, openings: [], roomLabels: [] } };
    },
  };
  const v0 = { format: 'house-planner', version: 0, units: 'in', name: 'Old', walls: sampleProject().plan.walls };

  it('upgrades an older file step by step', () => {
    const r = parseProject(text(v0), fake, 1);
    if (!r.ok) throw new Error(r.error);
    expect(r.migratedFrom).toBe(0);
    expect(r.project.plan.walls).toHaveLength(4);
  });

  it('stamps the new version after each step', () => {
    expect(migrate(v0, fake, 1).version).toBe(1);
  });

  it('refuses a version with no migration path', () => {
    const r = parseProject(text(v0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/version 0 can no longer be opened/);
  });
});
