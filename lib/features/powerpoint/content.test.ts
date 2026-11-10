import { describe, expect, it } from "vitest";
import { ContentValidationError } from "@/lib/content/errors";
import {
  powerpointCodec,
  type Deck,
  type Slide,
  type TextBox,
} from "./content";

function makeSlide(id: string, textBoxes: TextBox[] = []): Slide {
  return { id, textBoxes };
}

function makeBox(overrides: Partial<TextBox> = {}): TextBox {
  return {
    id: "box-1",
    x: 0.1,
    y: 0.1,
    width: 0.4,
    height: 0.2,
    text: "Hello",
    ...overrides,
  };
}

describe("powerpointCodec", () => {
  it("creates a new deck with one empty slide", () => {
    const deck = powerpointCodec.empty();

    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0].textBoxes).toEqual([]);
    expect(typeof deck.slides[0].id).toBe("string");
    expect(deck.slides[0].id.trim().length).toBeGreaterThan(0);
    expect(powerpointCodec.parse(deck)).toEqual(deck);
  });

  it("parses multiple slides and fraction-positioned text boxes", () => {
    const input = {
      slides: [
        {
          id: "slide-1",
          textBoxes: [
            makeBox({ text: "Opening slide" }),
            makeBox({
              id: "box-2",
              x: 0.5,
              y: 0.6,
              width: 0.5,
              height: 0.4,
              text: "Bottom right",
            }),
          ],
        },
        {
          id: "slide-2",
          textBoxes: [],
        },
      ],
    };

    expect(powerpointCodec.parse(input)).toEqual(input);
  });

  it("accepts boxes exactly on the canvas edges", () => {
    const input: Deck = {
      slides: [
        makeSlide("slide-1", [
          makeBox({ x: 0, y: 0, width: 0.5, height: 1 }),
          makeBox({ id: "box-2", x: 0.5, y: 0, width: 0.5, height: 1 }),
        ]),
      ],
    };

    expect(powerpointCodec.parse(input)).toEqual(input);
  });

  it("round-trips through JSON serialization", () => {
    const deck: Deck = {
      slides: [
        makeSlide("slide-1", [
          makeBox({ text: "First line\nSecond line" }),
        ]),
        makeSlide("slide-2", [
          makeBox({ id: "box-2", x: 0.25, y: 0.3, width: 0.5, height: 0.4 }),
        ]),
      ],
    };

    const serialized = JSON.stringify(deck);
    const restored = powerpointCodec.parse(JSON.parse(serialized));

    expect(restored).toEqual(deck);
    expect(JSON.stringify(restored)).toBe(serialized);
  });

  it.each([
    ["a null payload", null],
    ["a string payload", "deck"],
    ["an array payload", []],
    ["a payload without slides", {}],
    ["a non-array slides field", { slides: {} }],
    ["an empty deck", { slides: [] }],
    ["a null slide", { slides: [null] }],
    ["a slide with no id", { slides: [{ textBoxes: [] }] }],
    ["a slide with a blank id", { slides: [{ id: "  ", textBoxes: [] }] }],
    ["a slide with a non-string id", { slides: [{ id: 7, textBoxes: [] }] }],
    ["a slide without text boxes", { slides: [{ id: "slide-1" }] }],
    [
      "a slide with unknown fields",
      { slides: [{ id: "slide-1", textBoxes: [], title: "x" }] },
    ],
    [
      "duplicate slide ids",
      {
        slides: [
          { id: "slide-1", textBoxes: [] },
          { id: "slide-1", textBoxes: [] },
        ],
      },
    ],
    [
      "a non-array textBoxes field",
      { slides: [{ id: "slide-1", textBoxes: {} }] },
    ],
  ])("rejects %s", (_description, input) => {
    expect(() => powerpointCodec.parse(input)).toThrow(ContentValidationError);
  });

  it.each([
    ["a missing box id", { y: 0.1, width: 0.2, height: 0.2, text: "" }],
    ["a blank box id", makeBox({ id: " " })],
    ["a negative x", makeBox({ x: -0.01 })],
    ["an x above 1", makeBox({ x: 1.01 })],
    ["a negative y", makeBox({ y: -0.01 })],
    ["a y above 1", makeBox({ y: 1.01 })],
    ["a non-numeric x", makeBox({ x: "0.1" as unknown as number })],
    ["a non-finite y", makeBox({ y: Number.NaN })],
    ["a zero width", makeBox({ width: 0 })],
    ["a width above 1", makeBox({ width: 1.1 })],
    ["a negative width", makeBox({ width: -0.2 })],
    ["a zero height", makeBox({ height: 0 })],
    ["a height above 1", makeBox({ height: 1.1 })],
    ["a box outside the right edge", makeBox({ x: 0.8, width: 0.3 })],
    ["a box outside the bottom edge", makeBox({ y: 0.9, height: 0.2 })],
    ["missing text", { ...makeBox(), text: undefined }],
    ["non-string text", makeBox({ text: 42 as unknown as string })],
    [
      "unknown box fields",
      { ...makeBox(), rotation: 12 },
    ],
  ])("rejects %s", (_description, box) => {
    expect(() =>
      powerpointCodec.parse({ slides: [{ id: "slide-1", textBoxes: [box] }] }),
    ).toThrow(ContentValidationError);
  });

  it("rejects duplicate text box ids", () => {
    const input = {
      slides: [
        makeSlide("slide-1", [makeBox({ id: "box-1" })]),
        makeSlide("slide-2", [makeBox({ id: "box-1" })]),
      ],
    };

    expect(() => powerpointCodec.parse(input)).toThrow(ContentValidationError);
  });
});
