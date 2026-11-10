import { formatAddress, parseAddress } from "./content";

/**
 * The three error values supported by the first-draft formula engine.
 *
 * - `#DIV/0!` division by zero
 * - `#REF!` invalid or cyclic cell/range reference
 * - `#NAME?` unknown function/name or unparseable formula
 */
export type FormulaError = "#DIV/0!" | "#REF!" | "#NAME?";

export type CellResult = number | FormulaError;
export type CellValues = Record<string, string>;
export type CellResults = Record<string, CellResult>;

const FORMULA_ERRORS = new Set<string>(["#DIV/0!", "#REF!", "#NAME?"]);

function isFormulaError(value: unknown): value is FormulaError {
  return typeof value === "string" && FORMULA_ERRORS.has(value);
}

interface NumberToken {
  kind: "number";
  value: number;
}

interface ReferenceToken {
  kind: "reference";
  value: string;
}

interface NameToken {
  kind: "name";
  value: string;
}

interface OperatorToken {
  kind: "operator";
  value: "+" | "-" | "*" | "/";
}

interface PunctuationToken {
  kind: "lparen" | "rparen" | "colon" | "comma" | "eof";
}

type Token =
  | NumberToken
  | ReferenceToken
  | NameToken
  | OperatorToken
  | PunctuationToken;

type BinaryOperator = "+" | "-" | "*" | "/";

type Expression =
  | { kind: "number"; value: number }
  | { kind: "reference"; address: string }
  | { kind: "name"; name: string }
  | { kind: "range"; start: string; end: string }
  | { kind: "unary"; operator: "+" | "-"; operand: Expression }
  | {
      kind: "binary";
      operator: BinaryOperator;
      left: Expression;
      right: Expression;
    }
  | { kind: "call"; name: string; args: Expression[] };

class FormulaSyntaxError extends Error {
  constructor() {
    super("The formula could not be parsed.");
    this.name = "FormulaSyntaxError";
  }
}

const NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)/;
const LETTER_PATTERN = /[A-Za-z]/;
const DIGIT_PATTERN = /\d/;
const WHITESPACE_PATTERN = /\s/;

/** Split a formula body into parser tokens, skipping all whitespace. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if (WHITESPACE_PATTERN.test(character)) {
      index += 1;
      continue;
    }

    const numberMatch = NUMBER_PATTERN.exec(source.slice(index));
    if (numberMatch) {
      tokens.push({ kind: "number", value: Number(numberMatch[0]) });
      index += numberMatch[0].length;
      continue;
    }

    if (LETTER_PATTERN.test(character)) {
      let lettersEnd = index;
      while (
        lettersEnd < source.length &&
        LETTER_PATTERN.test(source[lettersEnd])
      ) {
        lettersEnd += 1;
      }

      const letters = source.slice(index, lettersEnd).toUpperCase();
      let referenceEnd = lettersEnd;
      while (
        referenceEnd < source.length &&
        DIGIT_PATTERN.test(source[referenceEnd])
      ) {
        referenceEnd += 1;
      }

      if (referenceEnd > lettersEnd) {
        tokens.push({
          kind: "reference",
          value: `${letters}${source.slice(lettersEnd, referenceEnd)}`,
        });
        index = referenceEnd;
      } else {
        tokens.push({ kind: "name", value: letters });
        index = lettersEnd;
      }
      continue;
    }

    switch (character) {
      case "(":
        tokens.push({ kind: "lparen" });
        break;
      case ")":
        tokens.push({ kind: "rparen" });
        break;
      case ":":
        tokens.push({ kind: "colon" });
        break;
      case ",":
        tokens.push({ kind: "comma" });
        break;
      case "+":
      case "-":
      case "*":
      case "/":
        tokens.push({ kind: "operator", value: character });
        break;
      default:
        throw new FormulaSyntaxError();
    }

    index += 1;
  }

  tokens.push({ kind: "eof" });
  return tokens;
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Expression {
    const expression = this.parseAdditive();
    if (this.peek().kind !== "eof") {
      throw new FormulaSyntaxError();
    }
    return expression;
  }

  private peek(): Token {
    return this.tokens[this.position];
  }

  private consume(): Token {
    const token = this.tokens[this.position];
    this.position += 1;
    return token;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    for (;;) {
      const token = this.peek();
      if (
        token.kind !== "operator" ||
        (token.value !== "+" && token.value !== "-")
      ) {
        return left;
      }
      this.consume();
      const right = this.parseMultiplicative();
      left = {
        kind: "binary",
        operator: token.value,
        left,
        right,
      };
    }
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();

    for (;;) {
      const token = this.peek();
      if (
        token.kind !== "operator" ||
        (token.value !== "*" && token.value !== "/")
      ) {
        return left;
      }
      this.consume();
      const right = this.parseUnary();
      left = {
        kind: "binary",
        operator: token.value,
        left,
        right,
      };
    }
  }

  private parseUnary(): Expression {
    const token = this.peek();
    if (
      token.kind === "operator" &&
      (token.value === "+" || token.value === "-")
    ) {
      this.consume();
      return {
        kind: "unary",
        operator: token.value,
        operand: this.parseUnary(),
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const token = this.consume();

    if (token.kind === "number") {
      return { kind: "number", value: token.value };
    }

    if (token.kind === "reference") {
      if (this.peek().kind === "colon") {
        this.consume();
        const end = this.consume();
        if (end.kind !== "reference") {
          throw new FormulaSyntaxError();
        }
        return { kind: "range", start: token.value, end: end.value };
      }
      return { kind: "reference", address: token.value };
    }

    if (token.kind === "name") {
      if (this.peek().kind !== "lparen") {
        return { kind: "name", name: token.value };
      }

      this.consume();
      const args: Expression[] = [];
      if (this.peek().kind !== "rparen") {
        args.push(this.parseAdditive());
        while (this.peek().kind === "comma") {
          this.consume();
          args.push(this.parseAdditive());
        }
      }

      if (this.consume().kind !== "rparen") {
        throw new FormulaSyntaxError();
      }
      return { kind: "call", name: token.value, args };
    }

    if (token.kind === "lparen") {
      const expression = this.parseAdditive();
      if (this.consume().kind !== "rparen") {
        throw new FormulaSyntaxError();
      }
      return expression;
    }

    throw new FormulaSyntaxError();
  }
}

function parseFormula(source: string): Expression {
  const body = source.startsWith("=") ? source.slice(1) : source;
  return new Parser(tokenize(body)).parse();
}

function parseNumberLiteral(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return 0;
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

interface EvaluationContext {
  cells: CellValues;
  cache: Map<string, CellResult>;
  visiting: Set<string>;
}

interface RangeValue {
  kind: "range";
  addresses: string[];
}

type EvaluatedValue = CellResult | RangeValue;

function isRange(value: EvaluatedValue): value is RangeValue {
  return typeof value === "object";
}

function createContext(cells: CellValues): EvaluationContext {
  return { cells, cache: new Map(), visiting: new Set() };
}

function expandRange(start: string, end: string): RangeValue | FormulaError {
  const first = parseAddress(start);
  const second = parseAddress(end);
  if (!first || !second) {
    return "#REF!";
  }

  const startColumn = Math.min(first.columnIndex, second.columnIndex);
  const endColumn = Math.max(first.columnIndex, second.columnIndex);
  const startRow = Math.min(first.row, second.row);
  const endRow = Math.max(first.row, second.row);

  const addresses: string[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      addresses.push(formatAddress(column, row));
    }
  }
  return { kind: "range", addresses };
}

function evaluateCell(
  address: string,
  context: EvaluationContext,
): CellResult {
  const normalized = address.toUpperCase();

  if (context.cache.has(normalized)) {
    return context.cache.get(normalized) as CellResult;
  }

  if (context.visiting.has(normalized)) {
    return "#REF!";
  }

  const raw = context.cells[normalized] ?? "";
  if (!raw.startsWith("=")) {
    const literal = parseNumberLiteral(raw);
    const result: CellResult = literal ?? "#NAME?";
    context.cache.set(normalized, result);
    return result;
  }

  context.visiting.add(normalized);
  let result: CellResult;
  try {
    const value = evaluateExpression(parseFormula(raw), context);
    result = isRange(value) ? "#REF!" : value;
  } catch {
    result = "#NAME?";
  } finally {
    context.visiting.delete(normalized);
  }

  context.cache.set(normalized, result);
  return result;
}

function evaluateReference(
  address: string,
  context: EvaluationContext,
): CellResult {
  if (!parseAddress(address)) {
    return "#REF!";
  }
  return evaluateCell(address, context);
}

function evaluateSum(
  args: Expression[],
  context: EvaluationContext,
): CellResult {
  let total = 0;

  for (const argument of args) {
    const value = evaluateExpression(argument, context);

    if (isRange(value)) {
      for (const address of value.addresses) {
        const raw = context.cells[address] ?? "";
        if (raw === "") {
          continue;
        }
        if (raw.startsWith("=")) {
          const result = evaluateCell(address, context);
          if (isFormulaError(result)) {
            return result;
          }
          total += result;
        } else {
          const literal = parseNumberLiteral(raw);
          if (literal !== null) {
            total += literal;
          }
        }
      }
      continue;
    }

    if (isFormulaError(value)) {
      return value;
    }
    total += value;
  }

  return total;
}

function evaluateExpression(
  expression: Expression,
  context: EvaluationContext,
): EvaluatedValue {
  switch (expression.kind) {
    case "number":
      return expression.value;

    case "reference":
      return evaluateReference(expression.address, context);

    case "name":
      return "#NAME?";

    case "range":
      return expandRange(expression.start, expression.end);

    case "unary": {
      const value = evaluateExpression(expression.operand, context);
      if (isRange(value)) {
        return "#REF!";
      }
      if (isFormulaError(value)) {
        return value;
      }
      return expression.operator === "-" ? -value : value;
    }

    case "binary": {
      const left = evaluateExpression(expression.left, context);
      if (isRange(left)) {
        return "#REF!";
      }
      if (isFormulaError(left)) {
        return left;
      }

      const right = evaluateExpression(expression.right, context);
      if (isRange(right)) {
        return "#REF!";
      }
      if (isFormulaError(right)) {
        return right;
      }

      switch (expression.operator) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return right === 0 ? "#DIV/0!" : left / right;
      }
    }

    case "call":
      if (expression.name !== "SUM") {
        return "#NAME?";
      }
      return evaluateSum(expression.args, context);
  }
}

/**
 * Evaluate one formula against a set of raw cell values. The leading `=` is
 * optional. Formulas that cannot be parsed return `#NAME?`.
 */
export function evaluateFormula(
  formula: string,
  cells: CellValues = {},
): CellResult {
  const context = createContext(cells);
  try {
    const value = evaluateExpression(parseFormula(formula), context);
    return isRange(value) ? "#REF!" : value;
  } catch {
    return "#NAME?";
  }
}

/** Evaluate the raw value of one cell, including following formula chains. */
export function evaluateCellValue(
  address: string,
  cells: CellValues,
): CellResult {
  return evaluateCell(address, createContext(cells));
}

/**
 * Recalculate every formula cell in a workbook. Literal cells are omitted; a
 * shared cache makes dependent and chained formulas evaluate once.
 */
export function recalculate(cells: CellValues): CellResults {
  const context = createContext(cells);
  const results: CellResults = {};

  for (const address of Object.keys(cells)) {
    if (cells[address].startsWith("=")) {
      results[address] = evaluateCell(address, context);
    }
  }

  return results;
}

/** Format a calculated number without binary floating-point noise. */
export function formatCellNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "#DIV/0!";
  }
  if (Object.is(value, -0)) {
    return "0";
  }
  return String(Number.parseFloat(value.toPrecision(12)));
}
