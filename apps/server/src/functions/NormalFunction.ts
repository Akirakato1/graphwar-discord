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
    const expression = parser.parse(expressionText.replace(/^y\s*=\s*/i, ""));
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
