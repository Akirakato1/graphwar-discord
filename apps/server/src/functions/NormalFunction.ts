import { Parser } from "expr-eval";
import type { LocalPoint } from "@graphwar/shared";
import { ShotFunction, type SampleContext, type TrajectorySample } from "./ShotFunction";

const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    remainder: false,
    power: true,
    factorial: false,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    assignment: false
  }
});

const allowedSymbols = new Set([
  "x",
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "cbrt",
  "ceil",
  "cos",
  "cosh",
  "E",
  "exp",
  "expm1",
  "floor",
  "hypot",
  "log",
  "log1p",
  "log2",
  "log10",
  "max",
  "min",
  "PI",
  "pow",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
  "trunc"
]);

const nonFunctionSymbols = new Set(["x", "E", "PI"]);
const functionSymbols = new Set(Array.from(allowedSymbols).filter((symbol) => !nonFunctionSymbols.has(symbol)));

type ExpressionToken = {
  kind: "closeParen" | "identifier" | "number" | "openParen" | "other" | "space";
  text: string;
};

function evaluateNumber(evaluateY: (x: number) => unknown, x: number): number {
  const value = evaluateY(x);
  if (typeof value !== "number") {
    throw new Error("Function must evaluate to a finite number");
  }
  return value;
}

function evaluateFiniteNumber(evaluateY: (x: number) => unknown, x: number): number {
  const value = evaluateNumber(evaluateY, x);
  if (!Number.isFinite(value)) {
    throw new Error("Function must evaluate to a finite number");
  }
  return value;
}

function normalizeImplicitMultiplication(expressionText: string): string {
  const tokens = tokenizeExpression(expressionText);
  let normalized = "";
  let previousSignificant: ExpressionToken | undefined;

  for (const token of tokens) {
    if (token.kind === "space") {
      normalized += token.text;
      continue;
    }

    if (previousSignificant && shouldInsertMultiply(previousSignificant, token)) {
      normalized += "*";
    }

    normalized += token.text;
    previousSignificant = token;
  }

  return normalized;
}

function tokenizeExpression(expressionText: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let index = 0;

  while (index < expressionText.length) {
    const char = expressionText[index];

    if (/\s/.test(char)) {
      const start = index;
      while (index < expressionText.length && /\s/.test(expressionText[index])) {
        index += 1;
      }
      tokens.push({ kind: "space", text: expressionText.slice(start, index) });
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "openParen", text: char });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ kind: "closeParen", text: char });
      index += 1;
      continue;
    }

    if (isNumberStart(expressionText, index)) {
      const result = readNumber(expressionText, index);
      tokens.push({ kind: "number", text: result.text });
      index = result.nextIndex;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      while (index < expressionText.length && /[A-Za-z0-9_]/.test(expressionText[index])) {
        index += 1;
      }
      tokens.push({ kind: "identifier", text: expressionText.slice(start, index) });
      continue;
    }

    tokens.push({ kind: "other", text: char });
    index += 1;
  }

  return tokens;
}

function isNumberStart(expressionText: string, index: number): boolean {
  const char = expressionText[index];
  const next = expressionText[index + 1];
  return /\d/.test(char) || (char === "." && typeof next === "string" && /\d/.test(next));
}

function readNumber(expressionText: string, start: number): { nextIndex: number; text: string } {
  let index = start;

  while (index < expressionText.length && /\d/.test(expressionText[index])) {
    index += 1;
  }

  if (expressionText[index] === ".") {
    index += 1;
    while (index < expressionText.length && /\d/.test(expressionText[index])) {
      index += 1;
    }
  }

  if (expressionText[index] === "e" || expressionText[index] === "E") {
    const exponentStart = index;
    index += 1;
    if (expressionText[index] === "+" || expressionText[index] === "-") {
      index += 1;
    }

    const digitStart = index;
    while (index < expressionText.length && /\d/.test(expressionText[index])) {
      index += 1;
    }

    if (digitStart === index) {
      index = exponentStart;
    }
  }

  return { nextIndex: index, text: expressionText.slice(start, index) };
}

function shouldInsertMultiply(previous: ExpressionToken, next: ExpressionToken): boolean {
  if (!canEndFactor(previous) || !canStartFactor(next)) {
    return false;
  }

  if (previous.kind === "identifier" && functionSymbols.has(previous.text)) {
    return false;
  }

  if (previous.kind === "identifier" && next.kind === "openParen" && !nonFunctionSymbols.has(previous.text)) {
    return false;
  }

  return true;
}

function canEndFactor(token: ExpressionToken): boolean {
  return token.kind === "closeParen" || token.kind === "identifier" || token.kind === "number";
}

function canStartFactor(token: ExpressionToken): boolean {
  return token.kind === "identifier" || token.kind === "number" || token.kind === "openParen";
}

export class NormalFunction extends ShotFunction {
  readonly familyId = "normal" as const;

  private constructor(
    private readonly expressionText: string,
    private readonly evaluateY: (x: number) => number,
    private readonly offset: number
  ) {
    super();
  }

  static parse(expressionText: string): NormalFunction {
    const normalizedExpressionText = normalizeImplicitMultiplication(expressionText.replace(/^y\s*=\s*/i, ""));
    const expression = parser.parse(normalizedExpressionText);
    const invalidSymbol = expression.symbols().find((name) => !allowedSymbols.has(name));
    if (invalidSymbol) {
      throw new Error(`Unsupported symbol "${invalidSymbol}"`);
    }

    const evaluateExpression = (x: number) => expression.evaluate({ x });
    const yAtOrigin = evaluateNumber(evaluateExpression, 0);
    if (!Number.isFinite(yAtOrigin)) {
      throw new Error("Function must be finite at x = 0");
    }

    return new NormalFunction(expressionText, (x) => evaluateFiniteNumber(evaluateExpression, x), -yAtOrigin);
  }

  sample(context: SampleContext): TrajectorySample {
    const points: LocalPoint[] = [];
    let lastFinitePoint: LocalPoint | undefined;

    for (let x = context.minX; x <= context.maxX + Number.EPSILON; x += context.step) {
      if (points.length >= context.maxPathPoints) {
        return { ok: false, reason: "path-too-long", points, lastFinitePoint };
      }

      const roundedX = Number(x.toFixed(8));
      let y: number;
      try {
        y = this.evaluateY(roundedX) + this.offset;
      } catch {
        return { ok: false, reason: "undefined-function", points, lastFinitePoint };
      }
      if (!Number.isFinite(y)) {
        return { ok: false, reason: "undefined-function", points, lastFinitePoint };
      }

      const point = { x: roundedX, y: Number(y.toFixed(8)) };
      points.push(point);
      lastFinitePoint = point;
    }

    return { ok: true, points };
  }

  toString(): string {
    return this.expressionText;
  }
}
