import { describe, expect, it } from "vitest";
import { parseNormalFunction } from "./normalFunction";

describe("parseNormalFunction", () => {
  it("samples origin-centered functions and normalizes implicit multiplication", () => {
    const shot = parseNormalFunction("3sin(2x)cos(x)");
    const sample = shot.sample({ minX: 0, maxX: 1, step: 0.5, maxPathPoints: 10 });

    expect(shot.canonicalExpression).toContain("*");
    expect(sample.ok).toBe(true);
    expect(sample.points[0]).toEqual({ x: 0, y: 0 });
  });

  it("gates advanced helpers while keeping floor and ceiling in normal mode", () => {
    expect(() => parseNormalFunction("gamma(x + 1)", { advancedFunctions: false })).toThrow(
      "Advanced functions are disabled"
    );
    expect(() => parseNormalFunction("sum(n,0,x,n)", { advancedFunctions: false })).toThrow(
      "Advanced functions are disabled"
    );
    expect(parseNormalFunction("floor(x) + ceil(x)").sample({ minX: 0, maxX: 1, step: 0.5, maxPathPoints: 10 }).ok).toBe(
      true
    );
  });

  it("supports zeta as an advanced helper", () => {
    const sample = parseNormalFunction("zeta(x + 2)", { advancedFunctions: true }).sample({
      minX: 0,
      maxX: 1,
      step: 0.5,
      maxPathPoints: 10
    });

    expect(sample.ok).toBe(true);
    expect(sample.points[0].y).toBe(0);
  });
});
