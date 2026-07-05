import { describe, expect, it } from "vitest";
import { screenPointToWorldPoint } from "./viewBoxGeometry";

describe("screenPointToWorldPoint", () => {
  it("maps the center of an aspect-matched canvas to the origin", () => {
    expect(screenPointToWorldPoint({ x: 500, y: 300 }, { left: 0, top: 0, width: 1000, height: 600 })).toEqual({
      x: 0,
      y: 0
    });
  });

  it("accounts for horizontal letterboxing in wide canvases", () => {
    const rect = { left: 100, top: 50, width: 1200, height: 600 };
    expect(screenPointToWorldPoint({ x: 700, y: 350 }, rect)).toEqual({ x: 0, y: 0 });
    expect(screenPointToWorldPoint({ x: 200, y: 50 }, rect)).toEqual({ x: -25, y: 15 });
    expect(screenPointToWorldPoint({ x: 1200, y: 650 }, rect)).toEqual({ x: 25, y: -15 });
  });

  it("accounts for vertical letterboxing in tall canvases", () => {
    const rect = { left: 0, top: 100, width: 1000, height: 900 };
    expect(screenPointToWorldPoint({ x: 500, y: 550 }, rect)).toEqual({ x: 0, y: 0 });
    expect(screenPointToWorldPoint({ x: 0, y: 250 }, rect)).toEqual({ x: -25, y: 15 });
    expect(screenPointToWorldPoint({ x: 1000, y: 850 }, rect)).toEqual({ x: 25, y: -15 });
  });
});
