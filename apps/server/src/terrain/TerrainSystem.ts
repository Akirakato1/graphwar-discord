import * as polygonClippingModule from "polygon-clipping";
import {
  makeCirclePolygon,
  polygonArea,
  type TerrainBlob,
  type TerrainState,
  type WorldPoint
} from "@graphwar/shared";
import type { MultiPolygon, Ring } from "polygon-clipping";

const polygonClipping =
  (polygonClippingModule as unknown as { default?: typeof polygonClippingModule }).default ??
  polygonClippingModule;

function pointsToRing(points: WorldPoint[]): Ring {
  return points.map((point): [number, number] => [point.x, point.y]);
}

function blobToMultiPolygon(blob: TerrainBlob): MultiPolygon {
  return [[pointsToRing(blob.outer), ...blob.holes.map(pointsToRing)]];
}

function stripDuplicatedClosingPoint(points: WorldPoint[]): WorldPoint[] {
  if (points.length < 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  if (first.x === last.x && first.y === last.y) {
    return points.slice(0, -1);
  }

  return points;
}

function ringFromNumbers(ring: Ring): WorldPoint[] {
  return stripDuplicatedClosingPoint(ring.map(([x, y]) => ({ x, y })));
}

function hasMatchingRotation(left: WorldPoint[], right: WorldPoint[]): boolean {
  for (let offset = 0; offset < right.length; offset += 1) {
    let matches = true;

    for (let index = 0; index < left.length; index += 1) {
      const leftPoint = left[index];
      const rightPoint = right[(offset + index) % right.length];
      if (leftPoint.x !== rightPoint.x || leftPoint.y !== rightPoint.y) {
        matches = false;
        break;
      }
    }

    if (matches) return true;
  }

  return false;
}

function ringsHaveSameCoordinates(left: WorldPoint[], right: WorldPoint[]): boolean {
  const normalizedLeft = stripDuplicatedClosingPoint(left);
  const normalizedRight = stripDuplicatedClosingPoint(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  if (normalizedLeft.length === 0) return true;

  return (
    hasMatchingRotation(normalizedLeft, normalizedRight) ||
    hasMatchingRotation(normalizedLeft, [...normalizedRight].reverse())
  );
}

function differenceMatchesBlob(blob: TerrainBlob, difference: MultiPolygon): boolean {
  if (difference.length !== 1) return false;

  const [polygon] = difference;
  if (!polygon || polygon.length !== blob.holes.length + 1) return false;

  const [outerRing, ...holeRings] = polygon;
  if (!outerRing || !ringsHaveSameCoordinates(ringFromNumbers(outerRing), blob.outer)) return false;

  return holeRings.every((holeRing, index) =>
    ringsHaveSameCoordinates(ringFromNumbers(holeRing), blob.holes[index] ?? [])
  );
}

export class TerrainSystem {
  constructor(private readonly minArea: number) {}

  applyCircleCrater(
    terrain: TerrainState,
    center: WorldPoint,
    radius: number,
    idPrefix: string
  ): TerrainState {
    const crater: MultiPolygon = [[pointsToRing(makeCirclePolygon(center, radius, 32))]];
    const blobs: TerrainBlob[] = [];
    let changed = false;

    terrain.blobs.forEach((blob, blobIndex) => {
      const difference = polygonClipping.difference(blobToMultiPolygon(blob), crater);
      if (!differenceMatchesBlob(blob, difference)) {
        changed = true;
      }

      let polygonIndex = 0;
      for (const polygon of difference) {
        const [outerRing, ...holeRings] = polygon;
        if (!outerRing) continue;

        const outer = ringFromNumbers(outerRing);
        if (polygonArea(outer) < this.minArea) continue;

        blobs.push({
          id: `${idPrefix}-${blobIndex}-${polygonIndex}`,
          outer,
          holes: holeRings.map(ringFromNumbers)
        });
        polygonIndex += 1;
      }
    });

    if (!changed) {
      return terrain;
    }

    return { blobs };
  }
}
