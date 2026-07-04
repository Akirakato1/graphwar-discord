import type { PlayerId, TerrainState, WorldPoint } from "@graphwar/shared";

export type SpawnPoint = { playerId: PlayerId; position: WorldPoint };
export type GeneratedMap = { spawns: SpawnPoint[]; terrain: TerrainState };

export abstract class MapGenerator {
  abstract generate(seed: string, playerIds: PlayerId[]): GeneratedMap;
}
