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
import { CollisionSystem } from "./CollisionSystem";

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
    const path = sample.points
      .map((point) => localToWorld(point, input.shooter.position))
      .filter(isPointInBounds);

    if (!sample.ok && sample.lastFinitePoint) {
      const impactPoint = localToWorld(sample.lastFinitePoint, input.shooter.position);
      return {
        path,
        impact: { reason: sample.reason, point: impactPoint },
        terrain: this.applyCrater(input.terrain, impactPoint),
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    if (!sample.ok) {
      return {
        path,
        impact: { reason: sample.reason },
        terrain: input.terrain,
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    const terrainHit = this.collisionSystem.findFirstTerrainHit(path, input.terrain);
    const playerHit = this.collisionSystem.findFirstPlayerHit(path, input.players, input.shooter.id);

    if (terrainHit && this.happensBeforeOrAt(path, terrainHit, playerHit?.point)) {
      return {
        path,
        impact: { reason: "terrain-hit", point: terrainHit },
        terrain: this.applyCrater(input.terrain, terrainHit),
        players: input.players,
        damage: [],
        eliminations: []
      };
    }

    if (playerHit) {
      const damageAmount = this.explosion.damage;
      const hpAfter = Math.max(0, playerHit.player.hp - damageAmount);
      const targetAlive = hpAfter > 0;
      const players = input.players.map((player) =>
        player.id === playerHit.player.id ? { ...player, hp: hpAfter, alive: targetAlive } : player
      );
      const eliminations = targetAlive ? [] : [playerHit.player.id];

      return {
        path,
        impact: { reason: "player-hit", point: playerHit.point, targetPlayerId: playerHit.player.id },
        terrain: input.terrain,
        players,
        damage: [{ playerId: playerHit.player.id, amount: damageAmount, hpAfter }],
        eliminations
      };
    }

    return {
      path,
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

  private happensBeforeOrAt(path: WorldPoint[], first: WorldPoint, second: WorldPoint | undefined): boolean {
    if (!second) return true;

    return path.indexOf(first) <= path.indexOf(second);
  }
}
