import { describe, expect, it } from "vitest";
import {
  evaluateCellValue,
  evaluateFormula,
  formatCellNumber,
  recalculate,
} from "./formula";

describe("formula parsing and arithmetic", () => {
  it("applies operator precedence and parentheses", () => {
    expect(evaluateFormula("=1+2*3")).toBe(7);
    expect(evaluateFormula("=(1+2)*3")).toBe(9);
    expect(evaluateFormula("=2*3+4*5")).toBe(26);
    expect(evaluateFormula("=10-3-2")).toBe(5);
    expect(evaluateFormula("=8/2/2")).toBe(2);
    expect(evaluateFormula("=-2+5")).toBe(3);
    expect(evaluateFormula("=2*-3")).toBe(-6);
  });

  it("accepts decimals, surrounding whitespace, and lowercase names", () => {
    expect(evaluateFormula("= 1.5 + 2.25 ")).toBe(3.75);
    expect(
      evaluateFormula("= sum ( a1 : a3 )", {
        A1: "1",
        A2: "2",
        A3: "3",
      }),
    ).toBe(6);
  });

  it("treats empty cells as zero and text references as unknown values", () => {
    expect(evaluateFormula("=A1+1", {})).toBe(1);
    expect(evaluateFormula("=A1+1", { A1: "note" })).toBe("#NAME?");
  });
});

describe("cell references and recalculation", () => {
  it("evaluates chained dependencies once", () => {
    const cells = {
      A1: "2",
      B1: "=A1*3",
      C1: "=B1+4",
    };
    expect(evaluateCellValue("C1", cells)).toBe(10);
    expect(recalculate(cells)).toEqual({ B1: 6, C1: 10 });
  });

  it("sums ranges and mixed arguments, ignoring text in ranges", () => {
    const cells = {
      A1: "1",
      A2: "note",
      A3: "3",
      B1: "=SUM(A1:A3)",
      B2: "=SUM(A1:A2, A3, 4)",
      B3: "=SUM(A3:A1)",
    };
    expect(recalculate(cells)).toEqual({ B1: 4, B2: 8, B3: 4 });
  });

  it("recalculates dependent formulas when a referenced cell changes", () => {
    const before = { A1: "2", B1: "=A1*10" };
    const after = { A1: "5", B1: "=A1*10" };
    expect(recalculate(before).B1).toBe(20);
    expect(recalculate(after).B1).toBe(50);
  });
});

describe("formula errors", () => {
  it("returns #DIV/0! for division by zero", () => {
    expect(evaluateFormula("=1/0")).toBe("#DIV/0!");
    expect(recalculate({ A1: "0", B1: "=10/A1" })).toEqual({
      B1: "#DIV/0!",
    });
  });

  it("returns #REF! for invalid and out-of-grid references", () => {
    expect(evaluateFormula("=AA1")).toBe("#REF!");
    expect(evaluateFormula("=A0")).toBe("#REF!");
    expect(evaluateFormula("=Z101")).toBe("#REF!");
    expect(evaluateFormula("=SUM(A1:AA2)")).toBe("#REF!");
  });

  it("returns #NAME? for unknown names and malformed formulas", () => {
    expect(evaluateFormula("=NOPE")).toBe("#NAME?");
    expect(evaluateFormula("=NOPE(1)")).toBe("#NAME?");
    expect(evaluateFormula("=1+")).toBe("#NAME?");
    expect(evaluateFormula("=SUM(A1")).toBe("#NAME?");
    expect(evaluateFormula("=1 2")).toBe("#NAME?");
    expect(evaluateFormula("=1%2")).toBe("#NAME?");
  });

  it("detects direct and indirect cycles as #REF!", () => {
    expect(recalculate({ A1: "=A1" })).toEqual({ A1: "#REF!" });
    expect(recalculate({ A1: "=B1", B1: "=A1" })).toEqual({
      A1: "#REF!",
      B1: "#REF!",
    });
    expect(
      recalculate({ A1: "=B1", B1: "=C1", C1: "=A1", D1: "=A1+1" }),
    ).toEqual({
      A1: "#REF!",
      B1: "#REF!",
      C1: "#REF!",
      D1: "#REF!",
    });
    expect(evaluateFormula("=A1", { A1: "=A1" })).toBe("#REF!");
  });

  it("keeps evaluating independent cells when one formula fails", () => {
    const results = recalculate({
      A1: "0",
      A2: "2",
      B1: "=1/A1",
      B2: "=A2*2",
    });
    expect(results.B1).toBe("#DIV/0!");
    expect(results.B2).toBe(4);
  });
});

describe("formatCellNumber", () => {
  it("removes floating-point noise and normalizes negative zero", () => {
    expect(formatCellNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatCellNumber(-0)).toBe("0");
    expect(formatCellNumber(7)).toBe("7");
  });
});
