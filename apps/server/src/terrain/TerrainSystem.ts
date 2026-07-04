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

function effectiveBlobArea(outer: WorldPoint[], holes: WorldPoint[][]): number {
  return polygonArea(outer) - holes.reduce((sum, hole) => sum + polygonArea(hole), 0);
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
      const blobMultiPolygon = blobToMultiPolygon(blob);
      const intersection = polygonClipping.intersection(blobMultiPolygon, crater);
      if (intersection.length === 0) {
        blobs.push(blob);
        return;
      }

      changed = true;
      const difference = polygonClipping.difference(blobMultiPolygon, crater);
      let polygonIndex = 0;
      for (const polygon of difference) {
        const [outerRing, ...holeRings] = polygon;
        if (!outerRing) continue;

        const outer = ringFromNumbers(outerRing);
        const holes = holeRings.map(ringFromNumbers);
        if (effectiveBlobArea(outer, holes) < this.minArea) continue;

        blobs.push({
          id: `${idPrefix}-${blobIndex}-${polygonIndex}`,
          outer,
          holes
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
