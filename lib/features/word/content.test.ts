import { describe, expect, it } from "vitest";
import { ContentValidationError } from "../../content/errors";
import { parseWordDocument, wordCodec, type WordDocument } from "./content";

const sample: WordDocument = {
  blocks: [
    {
      type: "paragraph",
      style: "h1",
      runs: [
        { text: "Lesson " },
        { text: "plan", bold: true },
        { text: " overview", italic: true, underline: true },
      ],
    },
    {
      type: "paragraph",
      style: "normal",
      runs: [{ text: "First line\nsecond line" }],
    },
    {
      type: "bullets",
      items: [
        [{ text: "Pencils" }],
        [{ text: "Paper", bold: true }],
      ],
    },
    {
      type: "numbers",
      items: [
        [{ text: "Warm up" }],
        [{ text: "Read", italic: true }],
      ],
    },
  ],
};

const malformed: Array<[string, unknown]> = [
  ["null", null],
  ["an array", []],
  ["an empty object", {}],
  ["a non-array blocks field", { blocks: "nope" }],
  [
    "an unknown block type",
    { blocks: [{ type: "quote", runs: [{ text: "Hi" }] }] },
  ],
  [
    "an unknown paragraph style",
    {
      blocks: [{ type: "paragraph", style: "h4", runs: [] }],
    },
  ],
  [
    "a missing runs field",
    { blocks: [{ type: "paragraph", style: "normal" }] },
  ],
  [
    "a run with non-string text",
    {
      blocks: [{ type: "paragraph", style: "normal", runs: [{ text: 7 }] }],
    },
  ],
  [
    "a run mark that is false",
    {
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "Hi", bold: false }],
        },
      ],
    },
  ],
  [
    "an unknown run field",
    {
      blocks: [
        {
          type: "paragraph",
          style: "normal",
          runs: [{ text: "Hi", color: "red" }],
        },
      ],
    },
  ],
  [
    "an unknown block field",
    {
      blocks: [
        { type: "paragraph", style: "normal", runs: [], size: 12 },
      ],
    },
  ],
  [
    "a list with non-array items",
    { blocks: [{ type: "bullets", items: "one" }] },
  ],
  [
    "a list item that is not a run array",
    { blocks: [{ type: "bullets", items: [{ text: "One" }] }] },
  ],
];

describe("wordCodec", () => {
  it("returns an empty block list for a new document", () => {
    expect(wordCodec.empty()).toEqual({ blocks: [] });
  });

  it("accepts paragraphs, headings, character marks, and lists", () => {
    expect(wordCodec.parse(sample)).toEqual(sample);
  });

  it("accepts an empty block list", () => {
    expect(parseWordDocument({ blocks: [] })).toEqual({ blocks: [] });
  });

  it("survives a JSON stringify/parse round trip", () => {
    const stored = JSON.stringify(sample);
    expect(wordCodec.parse(JSON.parse(stored))).toEqual(sample);
  });

  it.each(malformed)("rejects %s", (_label, input) => {
    expect(() => wordCodec.parse(input)).toThrow(ContentValidationError);
  });

  it("returns a fresh empty document each time", () => {
    const first = wordCodec.empty();
    first.blocks.push({
      type: "paragraph",
      style: "normal",
      runs: [{ text: "Changed" }],
    });

    expect(wordCodec.empty()).toEqual({ blocks: [] });
  });
});
