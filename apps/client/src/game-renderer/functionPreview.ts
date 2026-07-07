import {
  defaultMatchTuning,
  localToWorld,
  parseNormalFunction,
  type AimDirectionId,
  type MatchSnapshot,
  type WorldPoint
} from "@graphwar/shared";

export type FunctionPreviewInput = {
  advancedFunctions?: boolean;
  aimDirection: AimDirectionId;
  expression: string;
  maxFunctionLength: number;
  playerId: string;
  snapshot?: MatchSnapshot;
};

export function computeFunctionPreview(input: FunctionPreviewInput): WorldPoint[] | undefined {
  const snapshot = input.snapshot;
  if (!snapshot || snapshot.phase !== "playing" || input.expression.trim().length === 0) {
    return undefined;
  }

  const shooter = snapshot.players.find((player) => player.id === input.playerId && player.alive);
  if (!shooter) {
    return undefined;
  }

  try {
    const maxFunctionLength = resolveMaxFunctionLength(input.maxFunctionLength);
    const shot = parseNormalFunction(input.expression, { advancedFunctions: input.advancedFunctions ?? false });
    const sample = shot.sample({
      minX: 0,
      maxX: maxFunctionLength,
      step: defaultMatchTuning.sampleStep,
      maxPathPoints: Math.max(1, Math.ceil(maxFunctionLength / defaultMatchTuning.sampleStep) + 1)
    });

    if (!sample.ok) {
      return undefined;
    }

    return truncatePathByDistance(
      sample.points.map((point) => localToWorld(point, shooter.position, input.aimDirection)),
      maxFunctionLength
    );
  } catch {
    return undefined;
  }
}

function truncatePathByDistance(path: WorldPoint[], maxDistance: number): WorldPoint[] {
  if (path.length < 2) {
    return path;
  }

  const result: WorldPoint[] = [path[0]];
  let traveledDistance = 0;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentDistance = distance(start, end);

    if (segmentDistance <= 0) {
      continue;
    }

    if (traveledDistance + segmentDistance <= maxDistance) {
      result.push(end);
      traveledDistance += segmentDistance;
      continue;
    }

    const remainingDistance = Math.max(0, maxDistance - traveledDistance);
    const t = Math.min(1, remainingDistance / segmentDistance);
    result.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    });
    break;
  }

  return result;
}

function distance(start: WorldPoint, end: WorldPoint): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function resolveMaxFunctionLength(value: number): number {
  return Number.isFinite(value) && value > 0
    ? value
    : defaultMatchTuning.sampleStep * (defaultMatchTuning.maxPathPoints - 1);
}
