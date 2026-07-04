import {
  defaultMatchTuning,
  type PlayerState,
  type TerrainBlob,
  type TerrainState,
  type WorldPoint
} from "@graphwar/shared";

const POINT_EPSILON = 1e-9;

function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointOnSegment(point: WorldPoint, start: WorldPoint, end: WorldPoint): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > POINT_EPSILON) return false;

  const minX = Math.min(start.x, end.x) - POINT_EPSILON;
  const maxX = Math.max(start.x, end.x) + POINT_EPSILON;
  const minY = Math.min(start.y, end.y) - POINT_EPSILON;
  const maxY = Math.max(start.y, end.y) + POINT_EPSILON;

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function pointInRing(point: WorldPoint, ring: WorldPoint[]): boolean {
  if (ring.length < 3) return false;

  let inside = false;
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const crossesY = current.y > point.y !== previous.y > point.y;
    if (!crossesY) continue;

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

export class CollisionSystem {
  findFirstTerrainHit(path: WorldPoint[], terrain: TerrainState): WorldPoint | undefined {
    return path.find((point) => terrain.blobs.some((blob) => pointInBlob(point, blob)));
  }

  findFirstPlayerHit(
    path: WorldPoint[],
    players: PlayerState[],
    shooterId: string
  ): { point: WorldPoint; player: PlayerState } | undefined {
    for (const point of path) {
      const player = players.find(
        (candidate) =>
          candidate.id !== shooterId &&
          candidate.alive &&
          distance(point, candidate.position) <= defaultMatchTuning.playerHitRadius
      );
      if (player) return { point, player };
    }

    return undefined;
  }
}
