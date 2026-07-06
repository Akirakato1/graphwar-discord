import { worldBoundsForMapSize } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import { createViewBoxGeometry, screenPointToWorldPoint } from "./viewBoxGeometry";

describe("viewBoxGeometry", () => {
  it("derives svg view-box geometry from the active world bounds", () => {
    expect(createViewBoxGeometry(worldBoundsForMapSize("large"))).toEqual({
      maxSvgY: 22.5,
      minSvgY: -22.5,
      viewBox: "-37.5 -22.5 75 45",
      worldHeight: 45,
      worldWidth: 75
    });
  });
});

describe("screenPointToWorldPoint", () => {
  it("maps the center of an aspect-matched canvas to the origin", () => {
    expect(
      screenPointToWorldPoint({ x: 500, y: 300 }, { left: 0, top: 0, width: 1000, height: 600 }, worldBoundsForMapSize("standard"))
    ).toEqual({ x: 0, y: 0 });
  });

  it("accounts for horizontal letterboxing in wide canvases", () => {
    const rect = { left: 100, top: 50, width: 1200, height: 600 };
    expect(screenPointToWorldPoint({ x: 700, y: 350 }, rect, worldBoundsForMapSize("standard"))).toEqual({ x: 0, y: 0 });
    expect(screenPointToWorldPoint({ x: 200, y: 50 }, rect, worldBoundsForMapSize("standard"))).toEqual({ x: -25, y: 15 });
    expect(screenPointToWorldPoint({ x: 1200, y: 650 }, rect, worldBoundsForMapSize("standard"))).toEqual({ x: 25, y: -15 });
  });

  it("accounts for vertical letterboxing in tall canvases", () => {
    const rect = { left: 0, top: 100, width: 1000, height: 900 };
    expect(screenPointToWorldPoint({ x: 500, y: 550 }, rect, worldBoundsForMapSize("standard"))).toEqual({ x: 0, y: 0 });
    expect(screenPointToWorldPoint({ x: 0, y: 250 }, rect, worldBoundsForMapSize("standard"))).toEqual({ x: -25, y: 15 });
    expect(screenPointToWorldPoint({ x: 1000, y: 850 }, rect, worldBoundsForMapSize("standard"))).toEqual({ x: 25, y: -15 });
  });

  it("maps huge-map corners and center using the active bounds", () => {
    const rect = { left: 100, top: 50, width: 1200, height: 600 };
    const bounds = worldBoundsForMapSize("huge");

    expect(screenPointToWorldPoint({ x: 700, y: 350 }, rect, bounds)).toEqual({ x: 0, y: 0 });
    expect(screenPointToWorldPoint({ x: 100, y: 50 }, rect, bounds)).toEqual({ x: -50, y: 30 });
    expect(screenPointToWorldPoint({ x: 1300, y: 650 }, rect, bounds)).toEqual({ x: 50, y: -30 });
  });
});
