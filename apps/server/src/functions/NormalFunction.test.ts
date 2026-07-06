import { describe, expect, it } from "vitest";
import { NormalFunction } from "./NormalFunction";

describe("NormalFunction", () => {
  it("samples a function shifted through local origin", () => {
    const shot = NormalFunction.parse("x^2 + 5");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }]);
    }
  });

  it("accepts deterministic math helpers with an optional y prefix", () => {
    const shot = NormalFunction.parse("y = sin(x)");
    const sample = shot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.x).toBe(1);
      expect(sample.points[1]?.y).toBeCloseTo(Math.sin(1));
    }
  });

  it("accepts implicit multiplication between numbers, variables, function calls, and groups", () => {
    const shot = NormalFunction.parse("3sin(2x)cos(x)");
    const grouped = NormalFunction.parse("2(x+1)");
    const sample = shot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });
    const groupedSample = grouped.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    expect(groupedSample.ok).toBe(true);
    if (sample.ok && groupedSample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.y).toBeCloseTo(3 * Math.sin(2) * Math.cos(1));
      expect(groupedSample.points[1]?.y).toBeCloseTo(2);
    }
  });

  it("accepts implicit multiplication by a parenthesized negative factor without changing subtraction", () => {
    const multiplied = NormalFunction.parse("cos(x)(-sin(x))");
    const subtracted = NormalFunction.parse("cos(x)-sin(x)");
    const multipliedSample = multiplied.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });
    const subtractedSample = subtracted.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(multipliedSample.ok).toBe(true);
    expect(subtractedSample.ok).toBe(true);
    if (multipliedSample.ok && subtractedSample.ok) {
      expect(multipliedSample.points[1]?.y).toBeCloseTo(Math.cos(1) * -Math.sin(1));
      expect(subtractedSample.points[1]?.y).toBeCloseTo(Math.cos(1) - Math.sin(1) - 1);
    }
  });

  it("keeps explicit division and unary negative denominators equivalent", () => {
    const parenthesizedNegative = NormalFunction.parse("sin(x)/(-2-cos(x))");
    const unaryNegative = NormalFunction.parse("sin(x)/-(cos(x)+2)");
    const parenthesizedSample = parenthesizedNegative.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });
    const unarySample = unaryNegative.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(parenthesizedSample.ok).toBe(true);
    expect(unarySample.ok).toBe(true);
    if (parenthesizedSample.ok && unarySample.ok) {
      expect(parenthesizedSample.points[1]?.y).toBeCloseTo(unarySample.points[1]?.y);
      expect(unarySample.points[1]?.y).toBeCloseTo(Math.sin(1) / -(Math.cos(1) + 2));
    }
  });

  it("rejects functions without finite f(0)", () => {
    expect(() => NormalFunction.parse("1/x")).toThrow("Function must be finite at x = 0");
  });

  it("rejects the remainder operator", () => {
    expect(() => NormalFunction.parse("x % 2")).toThrow();
  });

  it.each(["random()", "fac(3)", "if(true, x, 0)", "z + 1"])(
    "rejects unsupported parser symbol in %s",
    (expression) => {
      expect(() => NormalFunction.parse(expression)).toThrow(/Unsupported symbol/);
    }
  );

  it("rejects array results", () => {
    expect(() => NormalFunction.parse("[x]")).toThrow(/finite number/);
  });

  it("explodes at the last finite point when a later sample is undefined", () => {
    const shot = NormalFunction.parse("sqrt(1 - x)");
    const sample = shot.sample({ minX: 0, maxX: 3, step: 1, maxPathPoints: 10 });

    expect(sample).toEqual({
      ok: false,
      reason: "undefined-function",
      points: [{ x: 0, y: 0 }, { x: 1, y: -1 }],
      lastFinitePoint: { x: 1, y: -1 }
    });
  });

  it("explodes at the last finite point when the shifted sample overflows", () => {
    const shot = NormalFunction.parse("1e308 * (2*x - 1)");
    const sample = shot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(sample).toEqual({
      ok: false,
      reason: "undefined-function",
      points: [{ x: 0, y: 0 }],
      lastFinitePoint: { x: 0, y: 0 }
    });
  });

  it("stops when max path points is reached", () => {
    const shot = NormalFunction.parse("x");
    const sample = shot.sample({ minX: 0, maxX: 10, step: 1, maxPathPoints: 3 });

    expect(sample.ok).toBe(false);
    if (!sample.ok) {
      expect(sample.reason).toBe("path-too-long");
      expect(sample.lastFinitePoint).toEqual({ x: 2, y: 2 });
    }
  });

  it("evaluates sums with sampled x in bounds and body", () => {
    const shot = NormalFunction.parse("sum(n, 0, x, n*cos(x))");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.y).toBeCloseTo(Math.cos(1));
      expect(sample.points[2]?.y).toBeCloseTo(3 * Math.cos(2));
    }
  });

  it("evaluates numeric integrals with sampled x in bounds and integrand", () => {
    const shot = NormalFunction.parse("int(t, 0, x, t*x)");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.y).toBeCloseTo(0.5, 5);
      expect(sample.points[2]?.y).toBeCloseTo(4, 5);
    }
  });

  it("evaluates finite-difference derivatives with respect to x", () => {
    const shot = NormalFunction.parse("diff(x, 2, x^3)");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.y).toBeCloseTo(6, 2);
      expect(sample.points[2]?.y).toBeCloseTo(12, 2);
    }
  });

  it("evaluates gamma-family helpers and continuous factorial", () => {
    const factorialShot = NormalFunction.parse("factorial(x)");
    const digammaShot = NormalFunction.parse("digamma(x + 1)");
    const betaShot = NormalFunction.parse("beta(x + 1, 2)");
    const factorialSample = factorialShot.sample({ minX: 0, maxX: 3, step: 1, maxPathPoints: 10 });
    const digammaSample = digammaShot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });
    const betaSample = betaShot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(factorialSample.ok).toBe(true);
    expect(digammaSample.ok).toBe(true);
    expect(betaSample.ok).toBe(true);
    if (factorialSample.ok && digammaSample.ok && betaSample.ok) {
      expect(factorialSample.points[3]?.y).toBeCloseTo(5);
      expect(digammaSample.points[1]?.y).toBeCloseTo(1, 5);
      expect(betaSample.points[1]?.y).toBeCloseTo(-1 / 3, 5);
    }
  });

  it("preserves implicit multiplication and unary negatives with advanced helpers", () => {
    const shot = NormalFunction.parse("3gamma(x + 1) + cos(x)(-sin(x))");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[2]?.y).toBeCloseTo(3 - Math.cos(2) * Math.sin(2));
    }
  });

  it("evaluates floor and ceiling aliases", () => {
    const shot = NormalFunction.parse("floor(x + 0.75) + ceil(x - 0.25) + ceiling(x - 0.25)");
    const sample = shot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 3 }]);
    }
  });

  it("rejects excessive aggregate and derivative work", () => {
    expect(() => NormalFunction.parse("sum(n, 0, 2000, n)")).toThrow(/evaluation limit/i);
    expect(() => NormalFunction.parse("diff(x, 5, sin(x))")).toThrow(/derivative order/i);
    expect(() => NormalFunction.parse("diff(t, 1, sin(t))")).toThrow(/only supports x/i);
  });
});
