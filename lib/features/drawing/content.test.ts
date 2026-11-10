import { describe, expect, it } from "vitest";
import { ContentValidationError } from "@/lib/content/errors";
import {
  DRAWING_HEIGHT,
  DRAWING_WIDTH,
  drawingCodec,
  parseDrawing,
  type Drawing,
} from "./content";

function stroke(overrides: Record<string, unknown> = {}) {
  return {
    id: "stroke-1",
    color: "#2563EB",
    width: 10,
    points: [
      { x: 100, y: 120 },
      { x: 240, y: 300 },
    ],
    ...overrides,
  };
}

function drawing(overrides: Record<string, unknown> = {}) {
  return {
    width: DRAWING_WIDTH,
    height: DRAWING_HEIGHT,
    strokes: [stroke()],
    ...overrides,
  };
}

describe("drawingCodec", () => {
  it("returns an empty 1600 x 900 drawing", () => {
    expect(drawingCodec.empty()).toEqual({
      width: 1600,
      height: 900,
      strokes: [],
    });
  });

  it("accepts multiple strokes and normalizes colors", () => {
    const parsed = drawingCodec.parse(
      drawing({
        strokes: [
          stroke({ id: "a", color: "#2563EB" }),
          stroke({
            id: "b",
            color: "#B42318",
            width: 4,
            points: [{ x: 0, y: 0 }],
          }),
        ],
      }),
    );

    expect(parsed.strokes).toHaveLength(2);
    expect(parsed.strokes[0].color).toBe("#2563eb");
    expect(parsed.strokes[1].color).toBe("#b42318");
    expect(parsed.strokes[1].points).toEqual([{ x: 0, y: 0 }]);
  });

  it("round-trips through JSON.stringify and JSON.parse", () => {
    const original: Drawing = {
      width: DRAWING_WIDTH,
      height: DRAWING_HEIGHT,
      strokes: [
        {
          id: "round-trip",
          color: "#067647",
          width: 20,
          points: [
            { x: 0.5, y: 899.5 },
            { x: 1599.5, y: 0.5 },
          ],
        },
      ],
    };

    const serialized = JSON.stringify(original);
    const restored = drawingCodec.parse(JSON.parse(serialized));

    expect(restored).toEqual(original);
    expect(JSON.stringify(restored)).toBe(serialized);
  });

  it.each([
    ["a non-object", null],
    ["an array", []],
    ["a missing strokes array", { width: 1600, height: 900 }],
    ["a wrong width", drawing({ width: 800 })],
    ["a wrong height", drawing({ height: 600 })],
    ["an extra top-level field", drawing({ extra: true })],
    ["a stroke that is not an object", drawing({ strokes: ["nope"] })],
    ["a stroke with no points", drawing({ strokes: [stroke({ points: [] })] })],
    ["a stroke with no id", drawing({ strokes: [stroke({ id: "  " })] })],
    ["an invalid color", drawing({ strokes: [stroke({ color: "blue" })] })],
    ["a zero width", drawing({ strokes: [stroke({ width: 0 })] })],
    ["a negative width", drawing({ strokes: [stroke({ width: -4 })] })],
    ["a non-numeric width", drawing({ strokes: [stroke({ width: "thick" })] })],
  ])("rejects %s", (_label, input) => {
    expect(() => drawingCodec.parse(input)).toThrow(ContentValidationError);
  });

  it.each([
    ["NaN x", { x: Number.NaN, y: 10 }],
    ["infinite y", { x: 10, y: Number.POSITIVE_INFINITY }],
    ["x below zero", { x: -1, y: 10 }],
    ["y above the canvas", { x: 10, y: 901 }],
    ["a missing y", { x: 10 }],
    ["an extra point field", { x: 10, y: 10, pressure: 0.5 }],
  ])("rejects malformed points: %s", (_label, point) => {
    expect(() =>
      parseDrawing(drawing({ strokes: [stroke({ points: [point] })] })),
    ).toThrow(ContentValidationError);
  });

  it("rejects strokes above the maximum width", () => {
    expect(() =>
      parseDrawing(drawing({ strokes: [stroke({ width: 101 })] })),
    ).toThrow(/at most 100/);
  });

  it("reports a useful validation message", () => {
    expect(() => parseDrawing(null)).toThrow("Drawing content must be an object.");
  });
});
