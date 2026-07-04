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
  });

  it("checks field bounds inclusively", () => {
    expect(isPointInBounds({ x: 25, y: -15 })).toBe(true);
    expect(isPointInBounds({ x: 26, y: 0 })).toBe(false);
  });
});
