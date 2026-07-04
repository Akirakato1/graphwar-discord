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

  it("stops when max path points is reached", () => {
    const shot = NormalFunction.parse("x");
    const sample = shot.sample({ minX: 0, maxX: 10, step: 1, maxPathPoints: 3 });

    expect(sample.ok).toBe(false);
    if (!sample.ok) {
      expect(sample.reason).toBe("path-too-long");
      expect(sample.lastFinitePoint).toEqual({ x: 2, y: 2 });
    }
  });
});
