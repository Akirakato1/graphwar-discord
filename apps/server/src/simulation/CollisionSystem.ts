import {
  defaultMatchTuning,
  type PlayerState,
  type TerrainBlob,
  type TerrainState,
  type WorldPoint
} from "@graphwar/shared";

const POINT_EPSILON = 1e-9;

export type CollisionHit = {
  point: WorldPoint;
  index: number;
  t: number;
};

export type PlayerCollisionHit = CollisionHit & {
  player: PlayerState;
};

function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a: WorldPoint, b: WorldPoint): number {
  return a.x * b.x + a.y * b.y;
}

function cross(a: WorldPoint, b: WorldPoint): number {
  return a.x * b.y - a.y * b.x;
}

function subtract(a: WorldPoint, b: WorldPoint): WorldPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function clampT(t: number): number {
  if (t < 0 && t >= -POINT_EPSILON) return 0;
  if (t > 1 && t <= 1 + POINT_EPSILON) return 1;
  return t;
}

function interpolate(start: WorldPoint, end: WorldPoint, t: number): WorldPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };
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

function isEarlier(candidate: CollisionHit, current: CollisionHit | undefined): boolean {
  return !current || compareCollisionOrder(candidate, current) < 0;
}

function segmentCircleIntersectionT(
  start: WorldPoint,
  end: WorldPoint,
  center: WorldPoint,
  radius: number
): number | undefined {
  const segment = subtract(end, start);
  const segmentLengthSquared = dot(segment, segment);
  if (segmentLengthSquared <= POINT_EPSILON) {
    return distance(start, center) <= radius ? 0 : undefined;
  }

  const startToCenter = subtract(start, center);
  const c = dot(startToCenter, startToCenter) - radius * radius;
  if (c <= POINT_EPSILON) return 0;

  const b = 2 * dot(startToCenter, segment);
  const discriminant = b * b - 4 * segmentLengthSquared * c;
  if (discriminant < -POINT_EPSILON) return undefined;

  const sqrtDiscriminant = Math.sqrt(Math.max(0, discriminant));
  const candidates = [
    (-b - sqrtDiscriminant) / (2 * segmentLengthSquared),
    (-b + sqrtDiscriminant) / (2 * segmentLengthSquared)
  ]
    .map(clampT)
    .filter((t) => t >= 0 && t <= 1)
    .sort((a, b) => a - b);

  return candidates[0];
}

function segmentIntersectionTs(
  start: WorldPoint,
  end: WorldPoint,
  edgeStart: WorldPoint,
  edgeEnd: WorldPoint
): number[] {
  const segment = subtract(end, start);
  const edge = subtract(edgeEnd, edgeStart);
  const denominator = cross(segment, edge);
  const offset = subtract(edgeStart, start);

  if (Math.abs(denominator) <= POINT_EPSILON) {
    if (Math.abs(cross(offset, segment)) > POINT_EPSILON) {
      return [];
    }

    const segmentLengthSquared = dot(segment, segment);
    if (segmentLengthSquared <= POINT_EPSILON) {
      return pointOnSegment(start, edgeStart, edgeEnd) ? [0] : [];
    }

    const edgeStartT = dot(subtract(edgeStart, start), segment) / segmentLengthSquared;
    const edgeEndT = dot(subtract(edgeEnd, start), segment) / segmentLengthSquared;
    const overlapStart = Math.max(0, Math.min(edgeStartT, edgeEndT));
    const overlapEnd = Math.min(1, Math.max(edgeStartT, edgeEndT));

    return overlapStart <= overlapEnd + POINT_EPSILON ? [clampT(overlapStart)] : [];
  }

  const segmentT = cross(offset, edge) / denominator;
  const edgeT = cross(offset, segment) / denominator;
  if (
    segmentT < -POINT_EPSILON ||
    segmentT > 1 + POINT_EPSILON ||
    edgeT < -POINT_EPSILON ||
    edgeT > 1 + POINT_EPSILON
  ) {
    return [];
  }

  return [clampT(segmentT)];
}

function addUniqueT(values: number[], next: number): void {
  if (!values.some((value) => Math.abs(value - next) <= POINT_EPSILON)) {
    values.push(next);
  }
}

function collectSegmentRingIntersectionTs(start: WorldPoint, end: WorldPoint, ring: WorldPoint[]): number[] {
  const intersections: number[] = [];
  if (ring.length < 2) return intersections;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    for (const t of segmentIntersectionTs(start, end, current, next)) {
      addUniqueT(intersections, t);
    }
  }

  return intersections;
}

function findSegmentBlobHitT(start: WorldPoint, end: WorldPoint, blob: TerrainBlob): number | undefined {
  const candidates = [0, 1];
  for (const t of collectSegmentRingIntersectionTs(start, end, blob.outer)) {
    addUniqueT(candidates, t);
  }
  for (const hole of blob.holes) {
    for (const t of collectSegmentRingIntersectionTs(start, end, hole)) {
      addUniqueT(candidates, t);
    }
  }

  const sortedCandidates = candidates.sort((a, b) => a - b);
  for (const t of sortedCandidates) {
    const point = interpolate(start, end, t);
    if (pointInBlob(point, blob)) {
      return t;
    }

    const probeT = Math.min(1, t + 1e-6);
    if (probeT > t && pointInBlob(interpolate(start, end, probeT), blob)) {
      return t;
    }
  }

  return undefined;
}

export function compareCollisionOrder(a: CollisionHit, b: CollisionHit): number {
  if (a.index !== b.index) return a.index - b.index;
  if (Math.abs(a.t - b.t) > POINT_EPSILON) return a.t - b.t;
  return 0;
}

export class CollisionSystem {
  findFirstTerrainHit(path: WorldPoint[], terrain: TerrainState): CollisionHit | undefined {
    let earliest: CollisionHit | undefined;

    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index];
      const end = path[index + 1];

      for (const blob of terrain.blobs) {
        const t = findSegmentBlobHitT(start, end, blob);
        if (t === undefined) continue;

        const candidate = { point: interpolate(start, end, t), index, t };
        if (isEarlier(candidate, earliest)) {
          earliest = candidate;
        }
      }
    }

    if (!earliest && path.length === 1 && terrain.blobs.some((blob) => pointInBlob(path[0], blob))) {
      return { point: path[0], index: 0, t: 0 };
    }

    return earliest;
  }

  findFirstPlayerHit(
    path: WorldPoint[],
    players: PlayerState[],
    shooterId: string
  ): PlayerCollisionHit | undefined {
    let earliest: PlayerCollisionHit | undefined;
    const targetPlayers = players.filter((candidate) => candidate.id !== shooterId && candidate.alive);

    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index];
      const end = path[index + 1];

      for (const player of targetPlayers) {
        const t = segmentCircleIntersectionT(start, end, player.position, defaultMatchTuning.playerHitRadius);
        if (t === undefined) continue;

        const candidate = { point: interpolate(start, end, t), index, t, player };
        if (isEarlier(candidate, earliest)) {
          earliest = candidate;
        }
      }
    }

    if (!earliest && path.length === 1) {
      const player = targetPlayers.find(
        (candidate) => distance(path[0], candidate.position) <= defaultMatchTuning.playerHitRadius
      );
      if (player) {
        return { point: path[0], index: 0, t: 0, player };
      }
    }

    return earliest;
  }
}
