import * as polygonClippingModule from "polygon-clipping";
import { polygonArea } from "../geometry/polygons";
import type { TerrainBlob, TerrainState, WorldPoint } from "../geometry/types";
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

function cloneTerrain(terrain: TerrainState): TerrainState {
  return {
    blobs: terrain.blobs.map((blob) => ({
      id: blob.id,
      outer: blob.outer.map((point) => ({ ...point })),
      holes: blob.holes.map((hole) => hole.map((point) => ({ ...point })))
    }))
  };
}

export function normalizeTerrainState(
  terrain: TerrainState,
  options: { idPrefix?: string; minArea?: number } = {}
): TerrainState {
  if (terrain.blobs.length <= 1) {
    return cloneTerrain(terrain);
  }

  const idPrefix = options.idPrefix ?? "terrain-merged";
  const minArea = options.minArea ?? 1e-6;
  const polygons = terrain.blobs.map(blobToMultiPolygon);
  const union = polygonClipping.union(polygons[0] as MultiPolygon, ...polygons.slice(1));
  const blobs: TerrainBlob[] = [];

  for (const polygon of union) {
    const [outerRing, ...holeRings] = polygon;
    if (!outerRing) continue;

    const outer = ringFromNumbers(outerRing);
    const holes = holeRings.map(ringFromNumbers);
    if (outer.length < 3 || effectiveBlobArea(outer, holes) < minArea) continue;

    blobs.push({
      id: `${idPrefix}-${blobs.length + 1}`,
      outer,
      holes
    });
  }

  return { blobs };
}
