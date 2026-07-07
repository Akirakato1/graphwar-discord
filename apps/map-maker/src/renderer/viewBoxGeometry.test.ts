import { worldBoundsForMapSize } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import {
  createViewBoxGeometry,
  panViewBoundsByScreenDelta,
  screenPointToWorldPoint,
  shouldShowMinorGrid,
  zoomViewBoundsAtScreenPoint
} from "./viewBoxGeometry";

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

describe("view bounds camera helpers", () => {
  it("keeps the world point under the cursor stable while zooming", () => {
    const bounds = worldBoundsForMapSize("standard");
    const rect = { left: 0, top: 0, width: 1000, height: 600 };
    const cursor = { x: 250, y: 150 };
    const worldPoint = screenPointToWorldPoint(cursor, rect, bounds);

    const zoomedBounds = zoomViewBoundsAtScreenPoint(bounds, bounds, rect, cursor, 2);

    expect(screenPointToWorldPoint(cursor, rect, zoomedBounds)).toEqual(worldPoint);
    expect(zoomedBounds.maxX - zoomedBounds.minX).toBeCloseTo(25);
    expect(zoomedBounds.maxY - zoomedBounds.minY).toBeCloseTo(15);
  });

  it("does not zoom out beyond the full map bounds", () => {
    const bounds = worldBoundsForMapSize("standard");
    const rect = { left: 0, top: 0, width: 1000, height: 600 };
    const zoomedBounds = zoomViewBoundsAtScreenPoint(bounds, bounds, rect, { x: 500, y: 300 }, 1 / 10);

    expect(zoomedBounds).toEqual(bounds);
  });

  it("pans visible bounds by screen delta using the current zoom level", () => {
    const bounds = worldBoundsForMapSize("standard");
    const rect = { left: 0, top: 0, width: 1000, height: 600 };

    expect(panViewBoundsByScreenDelta(bounds, rect, { x: 100, y: -60 })).toEqual({
      minX: -30,
      maxX: 20,
      minY: -18,
      maxY: 12
    });
  });

  it("clamps panning so the view never exposes void past the map bounds", () => {
    const mapBounds = worldBoundsForMapSize("standard");
    const rect = { left: 0, top: 0, width: 1000, height: 600 };
    const zoomedBounds = zoomViewBoundsAtScreenPoint(mapBounds, mapBounds, rect, { x: 500, y: 300 }, 2);

    expect(panViewBoundsByScreenDelta(zoomedBounds, rect, { x: 1000, y: 1000 }, mapBounds)).toEqual({
      minX: mapBounds.minX,
      maxX: 0,
      minY: 0,
      maxY: mapBounds.maxY
    });
  });

  it("shows 1-unit minor grid lines only after zooming in enough", () => {
    const bounds = worldBoundsForMapSize("standard");
    const rect = { left: 0, top: 0, width: 1000, height: 600 };
    const zoomedBounds = zoomViewBoundsAtScreenPoint(bounds, bounds, rect, { x: 500, y: 300 }, 3);

    expect(shouldShowMinorGrid(bounds, rect)).toBe(false);
    expect(shouldShowMinorGrid(zoomedBounds, rect)).toBe(true);
  });
});
