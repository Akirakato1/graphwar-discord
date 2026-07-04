import { describe, expect, it } from "vitest";
import { isPointInBounds, makeCirclePolygon, polygonArea } from "./polygons";

describe("polygon helpers", () => {
  it("computes rectangle area", () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 3 },
        { x: 0, y: 3 }
      ])
    ).toBe(6);
  });

  it("creates a circular polygon around a center", () => {
    const ring = makeCirclePolygon({ x: 1, y: 2 }, 2, 12);
    expect(ring).toHaveLength(12);
    expect(ring[0]).toEqual({ x: 3, y: 2 });
    for (const point of ring) {
      expect(Math.hypot(point.x - 1, point.y - 2)).toBeCloseTo(2);
    }
  });

  it("rejects circle polygons with too few segments", () => {
    expect(() => makeCirclePolygon({ x: 0, y: 0 }, 1, 2)).toThrow(RangeError);
  });

  it("rejects circle polygons with fractional segments", () => {
    expect(() => makeCirclePolygon({ x: 0, y: 0 }, 1, 3.5)).toThrow(RangeError);
  });

  it("rejects circle polygons with invalid radius values", () => {
    expect(() => makeCirclePolygon({ x: 0, y: 0 }, 0, 3)).toThrow(RangeError);
    expect(() => makeCirclePolygon({ x: 0, y: 0 }, -1, 3)).toThrow(RangeError);
    expect(() => makeCirclePolygon({ x: 0, y: 0 }, Number.POSITIVE_INFINITY, 3)).toThrow(
      RangeError
    );
  });

  it("checks field bounds inclusively", () => {
    expect(isPointInBounds({ x: 25, y: -15 })).toBe(true);
    expect(isPointInBounds({ x: 26, y: 0 })).toBe(false);
  });
});
