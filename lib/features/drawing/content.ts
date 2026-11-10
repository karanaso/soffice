import { ContentValidationError } from "@/lib/content/errors";
import type { ContentCodec } from "@/lib/content/types";

/** Width of the drawing's logical coordinate space. */
export const DRAWING_WIDTH = 1600 as const;
/** Height of the drawing's logical coordinate space. */
export const DRAWING_HEIGHT = 900 as const;

/** Upper bound for a single stroke width in logical units. */
export const MAX_STROKE_WIDTH = 100;
/** Upper bound for the number of strokes stored in one drawing. */
export const MAX_STROKES = 5000;
/** Upper bound for the number of points stored in one stroke. */
export const MAX_POINTS_PER_STROKE = 10000;

/** A point in the drawing's 1600 x 900 logical coordinate space. */
export interface Point {
  x: number;
  y: number;
}

/** One freehand stroke in logical coordinates. */
export interface Stroke {
  id: string;
  /** A six-digit CSS hex color, for example `#2563eb`. */
  color: string;
  /** Stroke width in logical units, greater than zero. */
  width: number;
  /** At least one point. A single point renders as a dot. */
  points: Point[];
}

/** The complete payload persisted for a Drawing document. */
export interface Drawing {
  width: typeof DRAWING_WIDTH;
  height: typeof DRAWING_HEIGHT;
  strokes: Stroke[];
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_ID_LENGTH = 128;

const DRAWING_KEYS = ["width", "height", "strokes"] as const;
const STROKE_KEYS = ["id", "color", "width", "points"] as const;
const POINT_KEYS = ["x", "y"] as const;

function invalid(message: string): never {
  throw new ContentValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      invalid(`${label} has an unexpected field: ${key}.`);
    }
  }
}

function parsePoint(input: unknown, strokeIndex: number, pointIndex: number): Point {
  const label = `Stroke ${strokeIndex + 1}, point ${pointIndex + 1}`;
  if (!isRecord(input)) {
    invalid(`${label} must be an object with x and y.`);
  }
  assertOnlyKeys(input, POINT_KEYS, label);

  const { x, y } = input;
  if (typeof x !== "number" || !Number.isFinite(x)) {
    invalid(`${label} must have a finite numeric x.`);
  }
  if (typeof y !== "number" || !Number.isFinite(y)) {
    invalid(`${label} must have a finite numeric y.`);
  }
  if (x < 0 || x > DRAWING_WIDTH || y < 0 || y > DRAWING_HEIGHT) {
    invalid(
      `${label} must be inside the ${DRAWING_WIDTH} x ${DRAWING_HEIGHT} drawing area.`,
    );
  }

  return { x, y };
}

function parseStroke(input: unknown, strokeIndex: number): Stroke {
  const label = `Stroke ${strokeIndex + 1}`;
  if (!isRecord(input)) {
    invalid(`${label} must be an object.`);
  }
  assertOnlyKeys(input, STROKE_KEYS, label);

  const { id, color, width, points } = input;
  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    id.length > MAX_ID_LENGTH
  ) {
    invalid(`${label} must have a non-empty id of at most ${MAX_ID_LENGTH} characters.`);
  }
  if (typeof color !== "string" || !HEX_COLOR.test(color)) {
    invalid(`${label} must have a six-digit hex color.`);
  }
  if (
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width <= 0 ||
    width > MAX_STROKE_WIDTH
  ) {
    invalid(
      `${label} width must be greater than 0 and at most ${MAX_STROKE_WIDTH}.`,
    );
  }
  if (!Array.isArray(points)) {
    invalid(`${label} must have a points array.`);
  }
  if (points.length === 0) {
    invalid(`${label} must contain at least one point.`);
  }
  if (points.length > MAX_POINTS_PER_STROKE) {
    invalid(`${label} has too many points (maximum ${MAX_POINTS_PER_STROKE}).`);
  }

  return {
    id,
    color: color.toLowerCase(),
    width,
    points: Array.from(points, (point, pointIndex) =>
      parsePoint(point, strokeIndex, pointIndex),
    ),
  };
}

/**
 * Validates stored Drawing content.
 *
 * The parser is strict: unknown fields, extra points, non-finite coordinates,
 * points outside the logical canvas, invalid colors, and non-positive widths
 * all raise `ContentValidationError`.
 */
export function parseDrawing(input: unknown): Drawing {
  if (!isRecord(input)) {
    invalid("Drawing content must be an object.");
  }
  assertOnlyKeys(input, DRAWING_KEYS, "Drawing");

  if (input.width !== DRAWING_WIDTH || input.height !== DRAWING_HEIGHT) {
    invalid(
      `Drawing content must use the ${DRAWING_WIDTH} x ${DRAWING_HEIGHT} logical canvas.`,
    );
  }
  if (!Array.isArray(input.strokes)) {
    invalid("Drawing content must have a strokes array.");
  }
  if (input.strokes.length > MAX_STROKES) {
    invalid(`A drawing can contain at most ${MAX_STROKES} strokes.`);
  }

  return {
    width: DRAWING_WIDTH,
    height: DRAWING_HEIGHT,
    strokes: Array.from(input.strokes, (stroke, index) =>
      parseStroke(stroke, index),
    ),
  };
}

export const drawingCodec: ContentCodec<Drawing> = {
  empty(): Drawing {
    return { width: DRAWING_WIDTH, height: DRAWING_HEIGHT, strokes: [] };
  },
  parse(input: unknown): Drawing {
    return parseDrawing(input);
  },
};
