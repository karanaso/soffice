import {
  DRAWING_HEIGHT,
  DRAWING_WIDTH,
  type Point,
  type Stroke,
} from "./content";

/** Default distance between sampled points in logical units. */
export const POINT_SPACING = 2;
/** Extra logical margin around the eraser pointer. */
export const ERASER_TOLERANCE = 12;
/** Maximum number of snapshots kept for undo. */
export const HISTORY_LIMIT = 50;
const MAX_SAMPLES_PER_EVENT = 4096;

/** The subset of DOMRect needed to map pointer coordinates. */
export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DrawingHistory {
  past: Stroke[][];
  present: Stroke[];
  future: Stroke[][];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Map a client (viewport) coordinate onto the drawing's logical canvas.
 * The result is clamped to the logical bounds so drags that leave the canvas
 * still produce valid points.
 */
export function toLogicalPoint(
  client: Point,
  rect: CanvasRect,
): Point {
  const displayWidth = rect.width > 0 ? rect.width : DRAWING_WIDTH;
  const displayHeight = rect.height > 0 ? rect.height : DRAWING_HEIGHT;

  return {
    x: clamp(
      ((client.x - rect.left) / displayWidth) * DRAWING_WIDTH,
      0,
      DRAWING_WIDTH,
    ),
    y: clamp(
      ((client.y - rect.top) / displayHeight) * DRAWING_HEIGHT,
      0,
      DRAWING_HEIGHT,
    ),
  };
}

export function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Interpolate points between `from` (exclusive) and `to` (inclusive) at most
 * `spacing` logical units apart. This keeps fast pointer moves from producing
 * long straight gaps in a freehand stroke.
 */
export function samplePointer(
  from: Point,
  to: Point,
  spacing = POINT_SPACING,
): Point[] {
  if (!Number.isFinite(spacing) || spacing <= 0) {
    return [{ ...to }];
  }

  const distance = pointDistance(from, to);
  if (distance === 0) {
    return [];
  }

  const steps = Math.min(
    Math.max(1, Math.ceil(distance / spacing)),
    MAX_SAMPLES_PER_EVENT,
  );
  const points: Point[] = [];
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    points.push({
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    });
  }

  const last = points[points.length - 1];
  last.x = to.x;
  last.y = to.y;
  return points;
}

/** Append sampled points for a new pointer position. */
export function appendSampledPoints(
  points: Point[],
  to: Point,
  spacing = POINT_SPACING,
): Point[] {
  const from = points[points.length - 1];
  if (!from) {
    return [{ ...to }];
  }
  return [...points, ...samplePointer(from, to, spacing)];
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, point: Point): boolean {
  return (
    Math.min(a.x, b.x) <= point.x &&
    point.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= point.y &&
    point.y <= Math.max(a.y, b.y)
  );
}

/** True when two line segments intersect or touch. */
export function segmentsIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean {
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  if (d1 === 0 && onSegment(b1, b2, a1)) {
    return true;
  }
  if (d2 === 0 && onSegment(b1, b2, a2)) {
    return true;
  }
  if (d3 === 0 && onSegment(a1, a2, b1)) {
    return true;
  }
  if (d4 === 0 && onSegment(a1, a2, b2)) {
    return true;
  }

  return false;
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return pointDistance(point, a);
  }

  const projection =
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  const ratio = clamp(projection, 0, 1);
  return pointDistance(point, {
    x: a.x + ratio * dx,
    y: a.y + ratio * dy,
  });
}

/** Shortest distance between two line segments. */
export function segmentDistance(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): number {
  if (segmentsIntersect(a1, a2, b1, b2)) {
    return 0;
  }

  return Math.min(
    distanceToSegment(a1, b1, b2),
    distanceToSegment(a2, b1, b2),
    distanceToSegment(b1, a1, a2),
    distanceToSegment(b2, a1, a2),
  );
}

/** Shortest distance from a point to a stroke's polyline. */
export function strokeDistanceToPoint(stroke: Stroke, point: Point): number {
  if (stroke.points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (stroke.points.length === 1) {
    return pointDistance(point, stroke.points[0]);
  }

  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < stroke.points.length; index += 1) {
    shortest = Math.min(
      shortest,
      distanceToSegment(point, stroke.points[index - 1], stroke.points[index]),
    );
  }
  return shortest;
}

/**
 * Test whether an eraser segment touches a stroke. Whole strokes are erased,
 * so one touched segment anywhere along the polyline is enough. The stroke's
 * half-width is added to the tolerance so thick strokes are easy to catch.
 */
export function strokeHitBySegment(
  stroke: Stroke,
  from: Point,
  to: Point,
  tolerance = ERASER_TOLERANCE,
): boolean {
  const reach = Math.max(0, tolerance) + stroke.width / 2;

  if (stroke.points.length === 0) {
    return false;
  }
  if (stroke.points.length === 1) {
    return pointDistance(stroke.points[0], from) <= reach;
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    if (
      segmentDistance(
        stroke.points[index - 1],
        stroke.points[index],
        from,
        to,
      ) <= reach
    ) {
      return true;
    }
  }
  return false;
}

/** Return every stroke touched by an eraser segment. */
export function strokesHitBySegment(
  strokes: Stroke[],
  from: Point,
  to: Point,
  tolerance = ERASER_TOLERANCE,
): Stroke[] {
  return strokes.filter((stroke) =>
    strokeHitBySegment(stroke, from, to, tolerance),
  );
}

export function createHistory(present: Stroke[] = []): DrawingHistory {
  return { past: [], present, future: [] };
}

/**
 * Record a new present. Any redo history is discarded, and at most
 * `HISTORY_LIMIT` older snapshots are kept.
 */
export function pushSnapshot(
  history: DrawingHistory,
  next: Stroke[],
): DrawingHistory {
  if (next === history.present) {
    return history;
  }
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function canUndo(history: DrawingHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: DrawingHistory): boolean {
  return history.future.length > 0;
}

export function undoHistory(history: DrawingHistory): DrawingHistory {
  if (!canUndo(history)) {
    return history;
  }
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  };
}

export function redoHistory(history: DrawingHistory): DrawingHistory {
  if (!canRedo(history)) {
    return history;
  }
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
  };
}
