import type { LocalPoint } from "@graphwar/shared";
import { ShotFunction, type SampleContext, type TrajectorySample } from "./ShotFunction";
import { compileNormalExpression, type CompileNormalExpressionOptions } from "./CompiledNormalExpression";

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
    readonly canonicalExpression: string,
    private readonly evaluateY: (x: number) => number,
    private readonly offset: number
  ) {
    super();
  }

  static parse(expressionText: string, options: CompileNormalExpressionOptions = {}): NormalFunction {
    const compiledExpression = compileNormalExpression(expressionText.replace(/^y\s*=\s*/i, ""), options);
    const evaluateExpression = (x: number) => compiledExpression.evaluate({ x });
    const yAtOrigin = evaluateNumber(evaluateExpression, 0);
    if (!Number.isFinite(yAtOrigin)) {
      throw new Error("Function must be finite at x = 0");
    }

    return new NormalFunction(
      expressionText,
      compiledExpression.canonicalExpression,
      (x) => evaluateFiniteNumber(evaluateExpression, x),
      -yAtOrigin
    );
  }

  sample(context: SampleContext): TrajectorySample {
    const points: LocalPoint[] = [];
    let lastFinitePoint: LocalPoint | undefined;
    const stepCount = Math.max(0, Math.ceil((context.maxX - context.minX) / context.step));

    for (let stepIndex = 0; stepIndex <= stepCount; stepIndex += 1) {
      if (points.length >= context.maxPathPoints) {
        return { ok: false, reason: "path-too-long", points, lastFinitePoint };
      }

      const x = Math.min(context.maxX, context.minX + stepIndex * context.step);
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
