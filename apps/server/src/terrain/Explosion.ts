import type { TerrainState, WorldPoint } from "@graphwar/shared";
import { TerrainSystem } from "./TerrainSystem";

export type ExplosionApplyOptions = {
  baseRadius?: number;
  radiusMultiplier?: number;
};

export type ExplosionResult = { terrain: TerrainState; radius?: number };

export abstract class Explosion {
  abstract readonly type: string;
  abstract readonly damage: number;

  abstract apply(
    terrain: TerrainState,
    center: WorldPoint,
    terrainSystem: TerrainSystem,
    idPrefix: string,
    options?: ExplosionApplyOptions
  ): ExplosionResult;
}

export class CircleCraterExplosion extends Explosion {
  readonly type = "circle-crater";

  constructor(
    private readonly radius: number,
    readonly damage: number
  ) {
    super();
  }

  apply(
    terrain: TerrainState,
    center: WorldPoint,
    terrainSystem: TerrainSystem,
    idPrefix: string,
    options: ExplosionApplyOptions = {}
  ): ExplosionResult {
    const baseRadius = options.baseRadius ?? this.radius;
    const radius = baseRadius * Math.max(0, options.radiusMultiplier ?? 1);
    return { terrain: terrainSystem.applyCircleCrater(terrain, center, radius, idPrefix), radius };
  }
}
