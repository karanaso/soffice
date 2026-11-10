import { ContentValidationError } from "../../content/errors";
import type { ContentCodec } from "../../content/types";

/**
 * First-draft workbook content.
 *
 * Cells are keyed by A1 addresses and always store the raw text the user
 * entered. A value whose first character is `=` is a formula, but the formula
 * source is kept as written so it can be shown and edited later.
 */
export interface Workbook {
  cells: Record<string, string>;
  activeCell: string;
}

export const EXCEL_COLUMNS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

export const EXCEL_COLUMN_COUNT = EXCEL_COLUMNS.length;
export const EXCEL_ROW_COUNT = 100;

const ADDRESS_PATTERN = /^([A-Z])([1-9]\d*)$/;

export interface CellAddress {
  /** Zero-based column index, A = 0. */
  columnIndex: number;
  /** One-based row number. */
  row: number;
}

/**
 * Parse a canonical A1 address in the A..Z, 1..100 grid.
 * Returns `null` for lowercase, multi-letter, zero, out-of-range, or
 * otherwise malformed addresses.
 */
export function parseAddress(address: string): CellAddress | null {
  const match = ADDRESS_PATTERN.exec(address);
  if (!match) {
    return null;
  }

  const columnIndex = match[1].charCodeAt(0) - "A".charCodeAt(0);
  const row = Number(match[2]);
  if (columnIndex < 0 || columnIndex >= EXCEL_COLUMN_COUNT) {
    return null;
  }
  if (row < 1 || row > EXCEL_ROW_COUNT) {
    return null;
  }
  return { columnIndex, row };
}

export function isValidAddress(address: string): boolean {
  return parseAddress(address) !== null;
}

/**
 * Format a coordinate as an A1 address, clamping it to the defined grid so
 * callers can safely navigate at the boundaries.
 */
export function formatAddress(columnIndex: number, row: number): string {
  const column = Math.min(
    Math.max(Math.trunc(columnIndex), 0),
    EXCEL_COLUMN_COUNT - 1,
  );
  const safeRow = Math.min(Math.max(Math.trunc(row), 1), EXCEL_ROW_COUNT);
  return `${EXCEL_COLUMNS[column]}${safeRow}`;
}

export function isFormula(value: string): boolean {
  return value.startsWith("=");
}

export function emptyWorkbook(): Workbook {
  return { cells: {}, activeCell: "A1" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reject(message: string): never {
  throw new ContentValidationError(message);
}

function parseWorkbook(input: unknown): Workbook {
  if (!isRecord(input)) {
    reject("Workbook content must be an object.");
  }

  for (const key of Object.keys(input)) {
    if (key !== "cells" && key !== "activeCell") {
      reject(`Unknown workbook field: ${key}.`);
    }
  }

  const rawCells = input.cells;
  if (!isRecord(rawCells)) {
    reject("Workbook cells must be an object keyed by A1 addresses.");
  }

  const cells: Record<string, string> = {};
  for (const [address, value] of Object.entries(rawCells)) {
    if (!isValidAddress(address)) {
      reject(
        `Cell address "${address}" is outside the A1..Z100 workbook grid.`,
      );
    }
    if (typeof value !== "string") {
      reject(`Cell ${address} must contain a string value.`);
    }
    cells[address] = value;
  }

  const activeCell = input.activeCell;
  if (typeof activeCell !== "string" || !isValidAddress(activeCell)) {
    reject("The active cell must be a valid A1..Z100 address.");
  }

  return { cells, activeCell };
}

export const excelCodec: ContentCodec<Workbook> = {
  empty(): Workbook {
    return emptyWorkbook();
  },
  parse(input: unknown): Workbook {
    return parseWorkbook(input);
  },
};
