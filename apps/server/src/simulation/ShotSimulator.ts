import {
  defaultMatchTuning,
  directionVector,
  fieldBounds,
  isPointInBounds,
  localToWorld,
  type AimDirectionId,
  type DamageEvent,
  type ImpactEvent,
  type ImpactReason,
  type PlayerId,
  type PlayerState,
  type TerrainState,
  type WorldPoint
} from "@graphwar/shared";
import { CircleCraterExplosion } from "../terrain/Explosion";
import { TerrainSystem } from "../terrain/TerrainSystem";
import type { ShotFunction } from "../functions/ShotFunction";
import { CollisionSystem, compareCollisionOrder, type CollisionHit, type PlayerCollisionHit } from "./CollisionSystem";

export type ShotSimulationInput = {
  shooter: PlayerState;
  players: PlayerState[];
  terrain: TerrainState;
  shot: ShotFunction;
  aimDirection?: AimDirectionId;
  maxFunctionLength?: number;
};

export type ShotSimulationResult = {
  path: WorldPoint[];
  impact: ImpactEvent;
  terrain: TerrainState;
  players: PlayerState[];
  damage: DamageEvent[];
  eliminations: PlayerId[];
};

type ResolvedImpact =
  | (CollisionHit & { kind: "field-boundary" })
  | (CollisionHit & { kind: "range-limit" })
  | (CollisionHit & { kind: "terrain-hit" })
  | (PlayerCollisionHit & { kind: "player-hit" })
  | (CollisionHit & {
      kind: "invalid-shot";
      reason: Extract<ImpactReason, "undefined-function" | "path-too-long">;
    });

const POINT_EPSILON = 1e-9;
const defaultMaxFunctionTravel =
  defaultMatchTuning.sampleStep * Math.max(0, defaultMatchTuning.maxPathPoints - 1);

function interpolate(start: WorldPoint, end: WorldPoint, t: number): WorldPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };
}

function samePoint(a: WorldPoint, b: WorldPoint): boolean {
  return Math.abs(a.x - b.x) <= POINT_EPSILON && Math.abs(a.y - b.y) <= POINT_EPSILON;
}

export class ShotSimulator {
  constructor(
    private readonly collisionSystem = new CollisionSystem(),
    private readonly terrainSystem = new TerrainSystem(defaultMatchTuning.terrainMinArea),
    private readonly explosion = new CircleCraterExplosion(
      defaultMatchTuning.circleCraterRadius,
      defaultMatchTuning.directHitDamage
    )
  ) {}

  simulate(input: ShotSimulationInput): ShotSimulationResult {
    const aimDirection = input.aimDirection ?? "east";
    const maxFunctionLength = this.resolveMaxFunctionLength(input.maxFunctionLength);
    const boundaryDistance = this.forwardFieldBoundaryDistance(input.shooter.position, aimDirection);
    const maxX = Math.min(maxFunctionLength, boundaryDistance);
    const sample = input.shot.sample({
      minX: 0,
      maxX,
      step: defaultMatchTuning.sampleStep,
      maxPathPoints: this.maxPathPointsFor(maxX)
    });
    const worldPath = sample.points.map((point) => localToWorld(point, input.shooter.position, aimDirection));
    const boundaryHit = this.findFirstBoundaryExit(worldPath);
    const rangeLimitHit = this.findArcLengthLimit(worldPath, maxFunctionLength);
    const terrainHit = this.collisionSystem.findFirstTerrainHit(worldPath, input.terrain);
    const playerHit = this.collisionSystem.findFirstPlayerHit(worldPath, input.players, input.shooter.id);
    const invalidHit =
      !sample.ok && sample.lastFinitePoint
        ? {
            ...this.lastFiniteHit(sample.lastFinitePoint, sample.points, input.shooter.position, aimDirection),
            kind: "invalid-shot" as const,
            reason: sample.reason
          }
        : undefined;
    const impact = this.resolveImpact(boundaryHit, rangeLimitHit, terrainHit, playerHit, invalidHit);

    if (impact?.kind === "field-boundary") {
      return this.boundaryResult(input, worldPath, impact);
    }

    if (impact?.kind === "range-limit") {
      return this.pathTooLongResult(input, this.truncatePath(worldPath, impact));
    }

    if (impact?.kind === "terrain-hit") {
      return {
        path: this.truncatePath(worldPath, impact),
        impact: { reason: "terrain-hit", point: impact.point },
        terrain: this.applyCrater(input.terrain, impact.point),
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    if (impact?.kind === "player-hit") {
      const damageAmount = this.explosion.damage;
      const hpAfter = Math.max(0, impact.player.hp - damageAmount);
      const targetAlive = hpAfter > 0;
      const players = input.players.map((player) =>
        player.id === impact.player.id ? { ...player, hp: hpAfter, alive: targetAlive } : player
      );
      const eliminations = targetAlive ? [] : [impact.player.id];

      return {
        path: this.truncatePath(worldPath, impact),
        impact: { reason: "player-hit", point: impact.point, targetPlayerId: impact.player.id },
        terrain: input.terrain,
        players,
        damage: [{ playerId: impact.player.id, amount: damageAmount, hpAfter }],
        eliminations
      };
    }

    if (impact?.kind === "invalid-shot") {
      if (impact.reason === "path-too-long") {
        return this.pathTooLongResult(input, this.truncatePath(worldPath, impact));
      }

      return {
        path: this.truncatePath(worldPath, impact),
        impact: { reason: impact.reason, point: impact.point },
        terrain: this.applyCrater(input.terrain, impact.point),
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    if (!sample.ok) {
      return {
        path: worldPath.filter(isPointInBounds),
        impact: { reason: sample.reason },
        terrain: input.terrain,
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    return {
      path: worldPath.filter(isPointInBounds),
      impact: { reason: "miss" },
      terrain: input.terrain,
      players: input.players,
      damage: [],
      eliminations: []
    };
  }

  private pathTooLongResult(input: ShotSimulationInput, worldPath: WorldPoint[]): ShotSimulationResult {
    const path = worldPath.filter(isPointInBounds);
    const point = path[path.length - 1];

    return {
      path,
      impact: point ? { reason: "path-too-long", point } : { reason: "path-too-long" },
      terrain: input.terrain,
      players: input.players,
      damage: [],
      eliminations: []
    };
  }

  private applyCrater(terrain: TerrainState, point: WorldPoint): TerrainState {
    return this.explosion.apply(terrain, point, this.terrainSystem, "shot-impact").terrain;
  }

  private boundaryResult(input: ShotSimulationInput, worldPath: WorldPoint[], hit: CollisionHit): ShotSimulationResult {
    return {
      path: this.truncatePath(worldPath, hit),
      impact: { reason: "field-boundary", point: hit.point },
      terrain: input.terrain,
      players: input.players,
      damage: [],
      eliminations: []
    };
  }

  private resolveImpact(
    boundaryHit: CollisionHit | undefined,
    rangeLimitHit: CollisionHit | undefined,
    terrainHit: CollisionHit | undefined,
    playerHit: PlayerCollisionHit | undefined,
    invalidHit: Extract<ResolvedImpact, { kind: "invalid-shot" }> | undefined
  ): ResolvedImpact | undefined {
    const candidates: ResolvedImpact[] = [];
    if (boundaryHit) candidates.push({ ...boundaryHit, kind: "field-boundary" });
    if (rangeLimitHit) candidates.push({ ...rangeLimitHit, kind: "range-limit" });
    if (terrainHit) candidates.push({ ...terrainHit, kind: "terrain-hit" });
    if (playerHit) candidates.push({ ...playerHit, kind: "player-hit" });
    if (invalidHit) candidates.push(invalidHit);

    return candidates.sort((a, b) => {
      const order = compareCollisionOrder(a, b);
      if (order !== 0) return order;
      return this.impactPriority(a.kind) - this.impactPriority(b.kind);
    })[0];
  }

  private impactPriority(kind: ResolvedImpact["kind"]): number {
    if (kind === "field-boundary") return 0;
    if (kind === "terrain-hit") return 1;
    if (kind === "player-hit") return 2;
    if (kind === "range-limit") return 3;
    return 4;
  }

  private truncatePath(worldPath: WorldPoint[], hit: CollisionHit): WorldPoint[] {
    const path = worldPath.slice(0, hit.index + 1).filter(isPointInBounds);
    const lastPoint = path[path.length - 1];
    if (!lastPoint || !samePoint(lastPoint, hit.point)) {
      path.push(hit.point);
    }

    return path;
  }

  private lastFiniteHit(
    lastFinitePoint: WorldPoint,
    localPath: WorldPoint[],
    shooterPosition: WorldPoint,
    aimDirection: AimDirectionId
  ): CollisionHit {
    const foundIndex = localPath.findIndex((point) => samePoint(point, lastFinitePoint));
    const index = foundIndex >= 0 ? foundIndex : Math.max(0, localPath.length - 1);

    return {
      point: localToWorld(lastFinitePoint, shooterPosition, aimDirection),
      index,
      t: 0
    };
  }

  private findFirstBoundaryExit(worldPath: WorldPoint[]): CollisionHit | undefined {
    for (let index = 0; index < worldPath.length - 1; index += 1) {
      const start = worldPath[index];
      const end = worldPath[index + 1];
      if (!isPointInBounds(start) || isPointInBounds(end)) continue;

      const t = this.boundaryExitT(start, end);
      if (t === undefined) continue;

      return {
        point: this.clampToBounds(interpolate(start, end, t)),
        index,
        t
      };
    }

    return undefined;
  }

  private findArcLengthLimit(worldPath: WorldPoint[], maxFunctionLength: number): CollisionHit | undefined {
    let traveledDistance = 0;

    for (let index = 0; index < worldPath.length - 1; index += 1) {
      const start = worldPath[index];
      const end = worldPath[index + 1];
      const segmentDistance = Math.hypot(end.x - start.x, end.y - start.y);

      if (segmentDistance <= POINT_EPSILON) {
        continue;
      }

      if (traveledDistance + segmentDistance >= maxFunctionLength - POINT_EPSILON) {
        const remainingDistance = Math.max(0, maxFunctionLength - traveledDistance);
        const t = Math.min(1, Math.max(0, remainingDistance / segmentDistance));

        return {
          point: interpolate(start, end, t),
          index,
          t
        };
      }

      traveledDistance += segmentDistance;
    }

    return undefined;
  }

  private boundaryExitT(start: WorldPoint, end: WorldPoint): number | undefined {
    const candidates: number[] = [];

    this.addBoundaryT(candidates, start.x, end.x, fieldBounds.minX, end.x < fieldBounds.minX);
    this.addBoundaryT(candidates, start.x, end.x, fieldBounds.maxX, end.x > fieldBounds.maxX);
    this.addBoundaryT(candidates, start.y, end.y, fieldBounds.minY, end.y < fieldBounds.minY);
    this.addBoundaryT(candidates, start.y, end.y, fieldBounds.maxY, end.y > fieldBounds.maxY);

    return candidates.sort((a, b) => a - b)[0];
  }

  private addBoundaryT(
    candidates: number[],
    startValue: number,
    endValue: number,
    boundaryValue: number,
    exitsPastBoundary: boolean
  ): void {
    if (!exitsPastBoundary || Math.abs(endValue - startValue) <= POINT_EPSILON) return;

    const t = (boundaryValue - startValue) / (endValue - startValue);
    if (t >= -POINT_EPSILON && t <= 1 + POINT_EPSILON) {
      candidates.push(Math.min(1, Math.max(0, t)));
    }
  }

  private clampToBounds(point: WorldPoint): WorldPoint {
    return {
      x: Math.min(fieldBounds.maxX, Math.max(fieldBounds.minX, point.x)),
      y: Math.min(fieldBounds.maxY, Math.max(fieldBounds.minY, point.y))
    };
  }

  private resolveMaxFunctionLength(value: number | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return defaultMaxFunctionTravel;
    }

    return value;
  }

  private maxPathPointsFor(maxX: number): number {
    return Math.max(1, Math.ceil(maxX / defaultMatchTuning.sampleStep) + 1);
  }

  private forwardFieldBoundaryDistance(shooterPosition: WorldPoint, aimDirection: AimDirectionId): number {
    const forward = directionVector(aimDirection);
    const distances: number[] = [];

    if (forward.x > POINT_EPSILON) {
      distances.push((fieldBounds.maxX - shooterPosition.x) / forward.x);
    } else if (forward.x < -POINT_EPSILON) {
      distances.push((fieldBounds.minX - shooterPosition.x) / forward.x);
    }

    if (forward.y > POINT_EPSILON) {
      distances.push((fieldBounds.maxY - shooterPosition.y) / forward.y);
    } else if (forward.y < -POINT_EPSILON) {
      distances.push((fieldBounds.minY - shooterPosition.y) / forward.y);
    }

    return Math.max(0, Math.min(...distances.filter((distanceValue) => distanceValue >= 0)));
  }
}
