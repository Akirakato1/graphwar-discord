import {
  defaultMatchTuning,
  fieldBounds,
  isPointInBounds,
  localToWorld,
  type DamageEvent,
  type ImpactEvent,
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
  | (CollisionHit & { kind: "terrain-hit" })
  | (PlayerCollisionHit & { kind: "player-hit" });

const POINT_EPSILON = 1e-9;

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
    const sample = input.shot.sample({
      minX: 0,
      maxX: fieldBounds.maxX - input.shooter.position.x,
      step: defaultMatchTuning.sampleStep,
      maxPathPoints: defaultMatchTuning.maxPathPoints
    });
    const worldPath = sample.points.map((point) => localToWorld(point, input.shooter.position));
    const boundaryHit = this.findFirstBoundaryExit(worldPath);

    if (!sample.ok && sample.lastFinitePoint) {
      const lastFiniteHit = this.lastFiniteHit(sample.lastFinitePoint, sample.points, input.shooter.position);
      if (boundaryHit && compareCollisionOrder(boundaryHit, lastFiniteHit) <= 0) {
        return this.boundaryResult(input, worldPath, boundaryHit);
      }

      return {
        path: this.truncatePath(worldPath, lastFiniteHit),
        impact: { reason: sample.reason, point: lastFiniteHit.point },
        terrain: this.applyCrater(input.terrain, lastFiniteHit.point),
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    if (!sample.ok) {
      if (boundaryHit) {
        return this.boundaryResult(input, worldPath, boundaryHit);
      }

      return {
        path: worldPath.filter(isPointInBounds),
        impact: { reason: sample.reason },
        terrain: input.terrain,
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    const terrainHit = this.collisionSystem.findFirstTerrainHit(worldPath, input.terrain);
    const playerHit = this.collisionSystem.findFirstPlayerHit(worldPath, input.players, input.shooter.id);
    const impact = this.resolveImpact(boundaryHit, terrainHit, playerHit);

    if (impact?.kind === "field-boundary") {
      return this.boundaryResult(input, worldPath, impact);
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

    return {
      path: worldPath.filter(isPointInBounds),
      impact: { reason: "miss" },
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
    terrainHit: CollisionHit | undefined,
    playerHit: PlayerCollisionHit | undefined
  ): ResolvedImpact | undefined {
    const candidates: ResolvedImpact[] = [];
    if (boundaryHit) candidates.push({ ...boundaryHit, kind: "field-boundary" });
    if (terrainHit) candidates.push({ ...terrainHit, kind: "terrain-hit" });
    if (playerHit) candidates.push({ ...playerHit, kind: "player-hit" });

    return candidates.sort((a, b) => {
      const order = compareCollisionOrder(a, b);
      if (order !== 0) return order;
      return this.impactPriority(a.kind) - this.impactPriority(b.kind);
    })[0];
  }

  private impactPriority(kind: ResolvedImpact["kind"]): number {
    if (kind === "field-boundary") return 0;
    if (kind === "terrain-hit") return 1;
    return 2;
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
    shooterPosition: WorldPoint
  ): CollisionHit {
    const foundIndex = localPath.findIndex((point) => point === lastFinitePoint);
    const index = foundIndex >= 0 ? foundIndex : Math.max(0, localPath.length - 1);

    return {
      point: localToWorld(lastFinitePoint, shooterPosition),
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
}
