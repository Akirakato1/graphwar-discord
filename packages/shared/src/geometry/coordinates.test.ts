import { describe, expect, it } from "vitest";
import { localToWorld } from "./coordinates";

describe("localToWorld", () => {
  it("translates shooter-local points into world coordinates", () => {
    expect(localToWorld({ x: 3, y: -2 }, { x: -10, y: 4 })).toEqual({ x: -7, y: 2 });
  });

  it("rotates the full local coordinate frame for cardinal aim directions", () => {
    expect(localToWorld({ x: 3, y: 2 }, { x: 0, y: 0 }, "west")).toEqual({ x: -3, y: -2 });
    expect(localToWorld({ x: 3, y: 2 }, { x: 0, y: 0 }, "north")).toEqual({ x: -2, y: 3 });
  });

  it("uses normalized diagonal basis vectors for diagonal aim directions", () => {
    const point = localToWorld({ x: Math.SQRT2, y: Math.SQRT2 }, { x: 10, y: -4 }, "south-east");

    expect(point.x).toBeCloseTo(12);
    expect(point.y).toBeCloseTo(-4);
  });
});
