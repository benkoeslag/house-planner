import { describe, expect, it } from 'vitest';
import { detectRooms, sampleProject, validateOpenings, wallGeometry } from '../src/model';

describe('sample project', () => {
  const { plan } = sampleProject();

  it('has valid openings', () => {
    expect(validateOpenings(plan)).toEqual([]);
  });

  it('is one 12 x 14 ft room named Kitchen, 139 1/2" x 163 1/2" inside the walls', () => {
    const rooms = detectRooms(plan);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.name).toBe('Kitchen');
    expect(rooms[0]!.area).toBeCloseTo(139.5 * 163.5, 9);
  });

  it('has geometry for every wall', () => {
    expect(wallGeometry(plan).size).toBe(4);
  });
});
