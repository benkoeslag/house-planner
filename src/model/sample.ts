import type { Project } from './project-file';

/**
 * A sample room used until the floor plan editor exists, and in tests: a 12' x 14'
 * room (wall centerlines) with 4 1/2" walls, a door and a window.
 */
export function sampleProject(): Project {
  const t = 4.5;
  const h = 96;
  return {
    name: 'Sample room',
    settings: { wallThickness: t, wallHeight: h },
    plan: {
      walls: [
        { id: 'south', a: { x: 0, y: 0 }, b: { x: 144, y: 0 }, thickness: t, height: h },
        { id: 'east', a: { x: 144, y: 0 }, b: { x: 144, y: 168 }, thickness: t, height: h },
        { id: 'north', a: { x: 144, y: 168 }, b: { x: 0, y: 168 }, thickness: t, height: h },
        { id: 'west', a: { x: 0, y: 168 }, b: { x: 0, y: 0 }, thickness: t, height: h },
      ],
      openings: [
        { id: 'door-1', wallId: 'south', kind: 'door', offset: 24, width: 32, height: 80, sill: 0, swing: { hinge: 'start', side: 'left' } },
        { id: 'window-1', wallId: 'north', kind: 'window', offset: 48, width: 36, height: 48, sill: 36 },
      ],
      roomLabels: [{ id: 'label-1', name: 'Kitchen', at: { x: 72, y: 84 } }],
    },
  };
}
