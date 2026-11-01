/**
 * Plan data model. All lengths are in inches. Plan coordinates are seen from
 * above with x pointing east and y pointing north (counterclockwise is positive).
 */

export interface Point {
  x: number;
  y: number;
}

/** A straight wall, described by its centerline from `a` to `b`. */
export interface Wall {
  id: string;
  a: Point;
  b: Point;
  thickness: number;
  height: number;
}

export type OpeningKind = 'door' | 'window' | 'opening';

/**
 * Which way a door swings.
 * `hinge`: the opening edge nearest the wall's `a` end is `start`; the other is `end`.
 * `side`: the side of the wall the door swings into, looking from `a` toward `b`.
 */
export interface DoorSwing {
  hinge: 'start' | 'end';
  side: 'left' | 'right';
}

/** A door, window or plain opening cut through one wall. */
export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** Distance along the wall centerline from `a` to the near edge of the opening. */
  offset: number;
  width: number;
  height: number;
  /** Height of the bottom of the opening above the floor (0 for doors). */
  sill: number;
  swing?: DoorSwing;
}

/** A room name pinned to a point. A detected room takes the name of the label inside it. */
export interface RoomLabel {
  id: string;
  name: string;
  at: Point;
}

export interface Plan {
  walls: Wall[];
  openings: Opening[];
  roomLabels: RoomLabel[];
}

export interface ProjectSettings {
  /** Thickness for new walls. */
  wallThickness: number;
  /** Height for new walls. */
  wallHeight: number;
}

export function emptyPlan(): Plan {
  return { walls: [], openings: [], roomLabels: [] };
}
