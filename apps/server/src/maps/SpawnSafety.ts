import { isWorldPointInBounds, type TerrainBlob, type TerrainState, type WorldBounds, type WorldPoint } from "@graphwar/shared";
import type { SpawnPoint } from "./MapGenerator";

const epsilon = 1e-9;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPoint(point: WorldPoint): WorldPoint {
  return { x: roundToTwoDecimals(point.x), y: roundToTwoDecimals(point.y) };
}

function pointOnSegment(point: WorldPoint, start: WorldPoint, end: WorldPoint): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > epsilon) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - epsilon &&
    point.x <= Math.max(start.x, end.x) + epsilon &&
    point.y >= Math.min(start.y, end.y) - epsilon &&
    point.y <= Math.max(start.y, end.y) + epsilon
  );
}

function pointInRing(point: WorldPoint, ring: WorldPoint[]): boolean {
  let inside = false;
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const crossesY = current.y > point.y !== previous.y > point.y;
    if (!crossesY) {
      continue;
    }

    const intersectionX = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (point.x < intersectionX) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInBlob(point: WorldPoint, blob: TerrainBlob): boolean {
  return pointInRing(point, blob.outer) && !blob.holes.some((hole) => pointInRing(point, hole));
}

export function isPointInTerrain(point: WorldPoint, terrain: TerrainState): boolean {
  return terrain.blobs.some((blob) => pointInBlob(point, blob));
}

function uniqueDirections(primary: WorldPoint): WorldPoint[] {
  const directions = [
    primary,
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 }
  ];
  const seen = new Set<string>();

  return directions
    .map((direction) => {
      const length = Math.hypot(direction.x, direction.y);
      return length > epsilon ? { x: direction.x / length, y: direction.y / length } : undefined;
    })
    .filter((direction): direction is WorldPoint => {
      if (!direction) {
        return false;
      }
      const key = `${roundToTwoDecimals(direction.x)},${roundToTwoDecimals(direction.y)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function worldCenter(bounds: WorldBounds): WorldPoint {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
}

function nudgeSpawnOutsideTerrain(point: WorldPoint, terrain: TerrainState, bounds: WorldBounds): WorldPoint {
  const center = worldCenter(bounds);
  const primary = { x: point.x - center.x, y: point.y - center.y };
  const directions = uniqueDirections(primary);
  const maxDistance = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  for (let distance = 0.5; distance <= maxDistance; distance += 0.5) {
    for (const direction of directions) {
      const candidate = roundPoint({
        x: point.x + direction.x * distance,
        y: point.y + direction.y * distance
      });

      if (isWorldPointInBounds(candidate, bounds) && !isPointInTerrain(candidate, terrain)) {
        return candidate;
      }
    }
  }

  return point;
}

export function ensureSpawnsOutsideTerrain(
  spawns: SpawnPoint[],
  terrain: TerrainState,
  bounds: WorldBounds
): SpawnPoint[] {
  return spawns.map((spawn) =>
    isPointInTerrain(spawn.position, terrain)
      ? { ...spawn, position: nudgeSpawnOutsideTerrain(spawn.position, terrain, bounds) }
      : spawn
  );
}
