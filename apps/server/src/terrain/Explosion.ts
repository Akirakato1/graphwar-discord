import type { TerrainState, WorldPoint } from "@graphwar/shared";
import { TerrainSystem } from "./TerrainSystem";

export type ExplosionResult = { terrain: TerrainState };

export abstract class Explosion {
  abstract readonly type: string;
  abstract readonly damage: number;

  abstract apply(
    terrain: TerrainState,
    center: WorldPoint,
    terrainSystem: TerrainSystem,
    idPrefix: string
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
    idPrefix: string
  ): ExplosionResult {
    return { terrain: terrainSystem.applyCircleCrater(terrain, center, this.radius, idPrefix) };
  }
}
