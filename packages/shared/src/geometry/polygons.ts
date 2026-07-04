import { fieldBounds } from "../constants";
import type { PolygonRing, WorldPoint } from "./types";

export function polygonArea(points: PolygonRing): number {
  if (points.length < 3) return 0;

  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return Math.abs(sum / 2);
}

export function makeCirclePolygon(center: WorldPoint, radius: number, segments = 32): PolygonRing {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError("makeCirclePolygon radius must be a finite positive number");
  }
  if (!Number.isFinite(segments) || !Number.isInteger(segments) || segments < 3) {
    throw new RangeError("makeCirclePolygon segments must be a finite integer of at least 3");
  }

  return Array.from({ length: segments }, (_, index) => {
    const angle = (Math.PI * 2 * index) / segments;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

export function isPointInBounds(point: WorldPoint): boolean {
  return (
    point.x >= fieldBounds.minX &&
    point.x <= fieldBounds.maxX &&
    point.y >= fieldBounds.minY &&
    point.y <= fieldBounds.maxY
  );
}
