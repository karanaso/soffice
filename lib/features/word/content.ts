import { ContentValidationError } from "../../content/errors";
import type { ContentCodec } from "../../content/types";

/** An inline run of text with optional supported character formatting. */
export interface Run {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
}

/** The supported paragraph styles. `normal` is a plain paragraph. */
export type ParagraphStyle = "normal" | "h1" | "h2" | "h3";

export interface ParagraphBlock {
  type: "paragraph";
  style: ParagraphStyle;
  runs: Run[];
}

export interface ListBlock {
  type: "bullets" | "numbers";
  /** Each list item is a sequence of formatted inline runs. */
  items: Run[][];
}

export type WordBlock = ParagraphBlock | ListBlock;

/** The complete Word content payload stored for a Word document. */
export interface WordDocument {
  blocks: WordBlock[];
}

const PARAGRAPH_STYLES: readonly ParagraphStyle[] = [
  "normal",
  "h1",
  "h2",
  "h3",
];

const RUN_FIELDS = ["text", "bold", "italic", "underline"];
const RUN_MARKS = ["bold", "italic", "underline"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new ContentValidationError(`Word content ${path} ${message}.`);
}

function assertKnownFields(
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(path, `contains the unknown field "${key}"`);
    }
  }
}

function parseRun(value: unknown, path: string): Run {
  if (!isRecord(value)) {
    fail(path, "must be an object");
  }
  assertKnownFields(value, path, RUN_FIELDS);

  if (typeof value.text !== "string") {
    fail(`${path}.text`, "must be a string");
  }

  const run: Run = { text: value.text };
  for (const mark of RUN_MARKS) {
    if (!(mark in value)) {
      continue;
    }
    if (value[mark] !== true) {
      fail(`${path}.${mark}`, "must be true when present");
    }
    run[mark] = true;
  }
  return run;
}

function parseRuns(value: unknown, path: string): Run[] {
  if (!Array.isArray(value)) {
    fail(path, "must be an array");
  }
  return value.map((run, index) => parseRun(run, `${path}[${index}]`));
}

function parseBlock(value: unknown, path: string): WordBlock {
  if (!isRecord(value)) {
    fail(path, "must be an object");
  }

  if (value.type === "paragraph") {
    assertKnownFields(value, path, ["type", "style", "runs"]);
    if (
      typeof value.style !== "string" ||
      !PARAGRAPH_STYLES.includes(value.style as ParagraphStyle)
    ) {
      fail(`${path}.style`, 'must be one of "normal", "h1", "h2", or "h3"');
    }
    return {
      type: "paragraph",
      style: value.style as ParagraphStyle,
      runs: parseRuns(value.runs, `${path}.runs`),
    };
  }

  if (value.type === "bullets" || value.type === "numbers") {
    assertKnownFields(value, path, ["type", "items"]);
    if (!Array.isArray(value.items)) {
      fail(`${path}.items`, "must be an array");
    }
    return {
      type: value.type,
      items: value.items.map((item, index) =>
        parseRuns(item, `${path}.items[${index}]`),
      ),
    };
  }

  fail(`${path}.type`, 'must be "paragraph", "bullets", or "numbers"');
}

/**
 * Validates and normalizes an unknown value into the Word block model.
 * Unknown fields are rejected so stored content stays within the supported
 * schema; callers in the host receive a `ContentValidationError` instead of a
 * partially understood document.
 */
export function parseWordDocument(input: unknown): WordDocument {
  if (!isRecord(input)) {
    fail("payload", "must be an object");
  }
  assertKnownFields(input, "payload", ["blocks"]);
  if (!Array.isArray(input.blocks)) {
    fail("payload.blocks", "must be an array");
  }

  return {
    blocks: input.blocks.map((block, index) =>
      parseBlock(block, `payload.blocks[${index}]`),
    ),
  };
}

/**
 * The Word content codec. It is pure and DOM-free because the server imports
 * this module through the shared content registry.
 */
export const wordCodec: ContentCodec<WordDocument> = {
  empty(): WordDocument {
    return { blocks: [] };
  },
  parse(input: unknown): WordDocument {
    return parseWordDocument(input);
  },
};
