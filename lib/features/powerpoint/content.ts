import { ContentValidationError } from "../../content/errors";
import type { ContentCodec } from "../../content/types";

/**
 * A text box on a slide.
 *
 * `x`, `y`, `width`, and `height` are fractions of the 16:9 slide canvas in
 * the range 0..1. Storing fractions instead of pixels keeps the deck layout
 * stable when the editor is displayed at different sizes.
 */
export interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface Slide {
  id: string;
  textBoxes: TextBox[];
}

export interface Deck {
  slides: Slide[];
}

const EPSILON = 1e-9;

function fail(message: string): never {
  throw new ContentValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(`${context} has an unknown field "${key}".`);
    }
  }
}

function assertId(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${context} must have a non-empty string id.`);
  }
  return value;
}

function assertFraction(value: unknown, context: string, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    fail(`${context} field "${field}" must be a number from 0 to 1.`);
  }
  return value;
}

function assertPositiveFraction(
  value: unknown,
  context: string,
  field: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1
  ) {
    fail(`${context} field "${field}" must be a number greater than 0 and at most 1.`);
  }
  return value;
}

function parseTextBox(
  value: unknown,
  slideIndex: number,
  boxIndex: number,
  seenIds: Set<string>,
): TextBox {
  const context = `Text box ${boxIndex + 1} on slide ${slideIndex + 1}`;
  if (!isRecord(value)) {
    fail(`${context} must be an object.`);
  }
  assertKeys(value, ["id", "x", "y", "width", "height", "text"], context);

  const id = assertId(value.id, context);
  if (seenIds.has(id)) {
    fail(`Text box id "${id}" is duplicated.`);
  }
  seenIds.add(id);

  const x = assertFraction(value.x, context, "x");
  const y = assertFraction(value.y, context, "y");
  const width = assertPositiveFraction(value.width, context, "width");
  const height = assertPositiveFraction(value.height, context, "height");

  if (x + width > 1 + EPSILON || y + height > 1 + EPSILON) {
    fail(`${context} must stay inside the slide canvas.`);
  }

  if (typeof value.text !== "string") {
    fail(`${context} field "text" must be a string.`);
  }

  return { id, x, y, width, height, text: value.text };
}

function parseSlide(
  value: unknown,
  slideIndex: number,
  seenSlideIds: Set<string>,
  seenTextBoxIds: Set<string>,
): Slide {
  const context = `Slide ${slideIndex + 1}`;
  if (!isRecord(value)) {
    fail(`${context} must be an object.`);
  }
  assertKeys(value, ["id", "textBoxes"], context);

  const id = assertId(value.id, context);
  if (seenSlideIds.has(id)) {
    fail(`Slide id "${id}" is duplicated.`);
  }
  seenSlideIds.add(id);

  if (!Array.isArray(value.textBoxes)) {
    fail(`${context} field "textBoxes" must be an array.`);
  }

  const textBoxes = value.textBoxes.map((textBox, boxIndex) =>
    parseTextBox(textBox, slideIndex, boxIndex, seenTextBoxIds),
  );

  return { id, textBoxes };
}

/**
 * Creates an id without touching browser-only APIs. Codecs run on the server,
 * where `crypto.randomUUID` is available in the supported Node.js runtime.
 */
export function createId(prefix = "id"): string {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === "function") {
    return uuid.call(globalThis.crypto);
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createSlide(): Slide {
  return { id: createId("slide"), textBoxes: [] };
}

/**
 * Codec for PowerPoint deck content.
 *
 * An empty deck contains one empty slide because every deck must keep at least
 * one slide. Parsing rejects empty decks, malformed ids, boxes outside the
 * 0..1 canvas, non-positive box sizes, non-string text, and unknown fields.
 */
export const powerpointCodec: ContentCodec<Deck> = {
  empty(): Deck {
    return { slides: [createSlide()] };
  },

  parse(input: unknown): Deck {
    if (!isRecord(input)) {
      fail("PowerPoint content must be an object with a slides array.");
    }
    assertKeys(input, ["slides"], "PowerPoint content");

    if (!Array.isArray(input.slides)) {
      fail("PowerPoint content field \"slides\" must be an array.");
    }
    if (input.slides.length === 0) {
      fail("A PowerPoint deck must contain at least one slide.");
    }

    const seenSlideIds = new Set<string>();
    const seenTextBoxIds = new Set<string>();
    const slides = input.slides.map((slide, index) =>
      parseSlide(slide, index, seenSlideIds, seenTextBoxIds),
    );

    return { slides };
  },
};
