import { describe, expect, it } from 'vitest';
import { validateOpenings, type Opening } from '../src/model';
import { plan, rectangle, wall } from './helpers';

const door = (o: Partial<Opening>): Opening => ({
  id: 'd1',
  wallId: 's',
  kind: 'door',
  offset: 30,
  width: 32,
  height: 80,
  sill: 0,
  ...o,
});

const kinds = (openings: Opening[], walls = rectangle(120, 120)) =>
  validateOpenings(plan(walls, { openings })).map((p) => p.kind);

describe('validateOpenings', () => {
  it('accepts a door clear of the corners', () => {
    expect(kinds([door({})])).toEqual([]);
  });

  it('accepts an opening that starts exactly at the inside corner', () => {
    expect(kinds([door({ offset: 2.25 })])).toEqual([]);
  });

  it('flags an opening that cuts into a corner', () => {
    // The inside faces start 2 1/4" along the wall, so an opening 1" from the centerline corner hits the next wall.
    expect(kinds([door({ offset: 1 })])).toEqual(['into-corner']);
    expect(kinds([door({ offset: 117.75 - 31.9 })])).toEqual(['into-corner']);
  });

  it('flags an opening past the end of the wall', () => {
    expect(kinds([door({ offset: 100 })])).toEqual(['past-wall-end']);
  });

  it('flags overlapping openings', () => {
    expect(kinds([door({}), door({ id: 'd2', offset: 50 })])).toEqual(['overlaps-opening', 'overlaps-opening']);
  });

  it('flags an opening taller than the wall', () => {
    expect(kinds([door({ kind: 'window', sill: 40, height: 60 })])).toEqual(['taller-than-wall']);
  });

  it('flags an opening that runs into a wall meeting this one in the middle', () => {
    const walls = [wall('long', 0, 0, 240, 0), wall('divider', 120, 0, 120, 100)];
    expect(kinds([door({ wallId: 'long', offset: 100, width: 20 })], walls)).toEqual(['into-abutting-wall']);
    expect(kinds([door({ wallId: 'long', offset: 90, width: 27.75 })], walls)).toEqual([]);
  });

  it('flags an opening on a missing wall and bad sizes', () => {
    expect(kinds([door({ wallId: 'nope' })])).toEqual(['missing-wall']);
    expect(kinds([door({ width: 0 })])).toEqual(['bad-size']);
  });
});
