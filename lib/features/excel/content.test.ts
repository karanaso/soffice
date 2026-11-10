import { describe, expect, it } from "vitest";
import { ContentValidationError } from "../../content/errors";
import {
  emptyWorkbook,
  excelCodec,
  formatAddress,
  isValidAddress,
  parseAddress,
  type Workbook,
} from "./content";

describe("workbook addresses", () => {
  it("accepts the A1..Z100 grid and rejects everything outside it", () => {
    for (const address of ["A1", "M42", "Z100", "B7"]) {
      expect(isValidAddress(address)).toBe(true);
    }
    for (const address of [
      "",
      "A",
      "1",
      "A0",
      "A101",
      "AA1",
      "a1",
      " A1",
      "A1 ",
      "A01",
      "1A",
      "Z1000",
    ]) {
      expect(isValidAddress(address)).toBe(false);
    }
  });

  it("parses and formats coordinates with clamping", () => {
    expect(parseAddress("C12")).toEqual({ columnIndex: 2, row: 12 });
    expect(parseAddress("AA1")).toBeNull();
    expect(formatAddress(0, 1)).toBe("A1");
    expect(formatAddress(25, 100)).toBe("Z100");
    expect(formatAddress(-5, 0)).toBe("A1");
    expect(formatAddress(99, 500)).toBe("Z100");
  });
});

describe("excelCodec", () => {
  it("returns an empty A1 workbook for new documents", () => {
    expect(excelCodec.empty()).toEqual({ cells: {}, activeCell: "A1" });
    expect(emptyWorkbook()).toEqual({ cells: {}, activeCell: "A1" });
  });

  it("accepts a valid workbook and copies the cells object", () => {
    const input = {
      cells: {
        A1: "2",
        B1: "=A1*2",
        Z100: "boundary",
      },
      activeCell: "B1",
    };
    const parsed = excelCodec.parse(input);

    expect(parsed).toEqual(input);
    expect(parsed.cells).not.toBe(input.cells);
  });

  it("round-trips through JSON serialization", () => {
    const workbook: Workbook = {
      cells: { A1: "=SUM(B1:B3)", C2: "hello", Z100: "100" },
      activeCell: "C2",
    };
    expect(excelCodec.parse(JSON.parse(JSON.stringify(workbook)))).toEqual(
      workbook,
    );
  });

  it.each([
    ["A0", "row zero"],
    ["A101", "row past 100"],
    ["AA1", "multi-letter column"],
    ["a1", "lowercase address"],
    ["1A", "reversed address"],
  ])("rejects the invalid cell address %s (%s)", (address) => {
    expect(() =>
      excelCodec.parse({ cells: { [address]: "1" }, activeCell: "A1" }),
    ).toThrow(ContentValidationError);
  });

  it("rejects non-string cell values", () => {
    expect(() =>
      excelCodec.parse({ cells: { A1: 2 }, activeCell: "A1" }),
    ).toThrow(ContentValidationError);
    expect(() =>
      excelCodec.parse({ cells: { A1: null }, activeCell: "A1" }),
    ).toThrow(ContentValidationError);
  });

  it("rejects malformed shapes and unknown fields", () => {
    const invalid: unknown[] = [
      null,
      undefined,
      [],
      "workbook",
      {},
      { cells: {}, activeCell: "A1", extra: true },
      { cells: [], activeCell: "A1" },
      { cells: {}, activeCell: "A0" },
      { cells: {}, activeCell: 1 },
      { activeCell: "A1" },
      { cells: {} },
    ];

    for (const input of invalid) {
      expect(() => excelCodec.parse(input)).toThrow(ContentValidationError);
    }
  });
});
