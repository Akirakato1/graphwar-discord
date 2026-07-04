import { Parser } from "expr-eval";
import type { LocalPoint } from "@graphwar/shared";
import { ShotFunction, type SampleContext, type TrajectorySample } from "./ShotFunction";

const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
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
    const variables = expression.variables();
    const invalidVariable = variables.find((name) => name !== "x");
    if (invalidVariable) {
      throw new Error(`Unsupported variable "${invalidVariable}"`);
    }

    const evaluateY = (x: number) => Number(expression.evaluate({ x }));
    const yAtOrigin = evaluateY(0);
    if (!Number.isFinite(yAtOrigin)) {
      throw new Error("Function must be finite at x = 0");
    }

    return new NormalFunction(expressionText, evaluateY, -yAtOrigin);
  }

  sample(context: SampleContext): TrajectorySample {
    const points: LocalPoint[] = [];
    let lastFinitePoint: LocalPoint | undefined;

    for (let x = context.minX; x <= context.maxX + Number.EPSILON; x += context.step) {
      if (points.length >= context.maxPathPoints) {
        return { ok: false, reason: "path-too-long", points, lastFinitePoint };
      }

      const roundedX = Number(x.toFixed(8));
      const y = this.evaluateY(roundedX) + this.offset;
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
