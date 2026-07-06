import type { PlayerId, TerrainState, WorldBounds, WorldPoint } from "@graphwar/shared";

export type SpawnPoint = { playerId: PlayerId; position: WorldPoint };
export type GeneratedMap = { spawns: SpawnPoint[]; terrain: TerrainState; worldBounds: WorldBounds };

export function cloneWorldBounds(bounds: WorldBounds): WorldBounds {
  return { minX: bounds.minX, maxX: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY };
}

export abstract class MapGenerator {
  abstract generate(seed: string, playerIds: PlayerId[], worldBounds?: WorldBounds): GeneratedMap;
}
