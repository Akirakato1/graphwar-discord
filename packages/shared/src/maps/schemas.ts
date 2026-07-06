import { z } from "zod";
import { pointSchema } from "../protocol/schemas";
import { isWorldPointInBounds } from "./worldBounds";
import { worldBoundsSchema } from "./worldBounds";
export { defaultMapSizePreset, mapSizePresetCatalog, mapSizePresetSchema, worldBoundsSchema } from "./worldBounds";

const mapNameSchema = z.string().trim().min(1).max(80);
const spawnPointIdSchema = z.string().trim().min(1).max(80);

export const customMapWorldBoundsSchema = worldBoundsSchema;

export const customMapSpawnPointSchema = z.object({
  id: spawnPointIdSchema,
  position: pointSchema
});

export const customMapTerrainRingSchema = z.array(pointSchema).min(3);

export const customMapTerrainBlobSchema = z.object({
  id: z.string().trim().min(1),
  outer: customMapTerrainRingSchema,
  holes: z.array(customMapTerrainRingSchema)
});

export const customMapTerrainStateSchema = z.object({
  blobs: z.array(customMapTerrainBlobSchema)
});

export const customMapTeamSpawnPointIdsSchema = z.object({
  "team-a": z.array(spawnPointIdSchema),
  "team-b": z.array(spawnPointIdSchema)
});

export const customMapImportSchema = z.object({
  format: z.literal("graphwar-map"),
  version: z.literal(1),
  name: mapNameSchema,
  worldBounds: customMapWorldBoundsSchema.optional(),
  terrain: customMapTerrainStateSchema,
  spawnPoints: z.array(customMapSpawnPointSchema),
  teamSpawnPointIds: customMapTeamSpawnPointIdsSchema
});

export const persistedCustomMapSchema = customMapImportSchema.extend({
  id: z.string().min(1),
  guildId: z.string().min(1),
  ownerDiscordUserId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const customMapSummarySchema = z.object({
  id: z.string().min(1),
  guildId: z.string().min(1),
  ownerDiscordUserId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const saveCustomMapRequestSchema = z.object({
  ownerDiscordUserId: z.string().trim().min(1),
  map: customMapImportSchema
});

export function validateCustomMapImportForSave(input: unknown) {
  const map = customMapImportSchema.parse(input);
  if (map.spawnPoints.length < 10) {
    throw new Error("Custom maps must contain at least 10 spawn points.");
  }

  const spawnIds = new Set<string>();
  for (const spawnPoint of map.spawnPoints) {
    if (spawnIds.has(spawnPoint.id)) {
      throw new Error("Spawn point ids must be unique.");
    }
    spawnIds.add(spawnPoint.id);
  }

  for (const teamId of ["team-a", "team-b"] as const) {
    for (const spawnPointId of map.teamSpawnPointIds[teamId]) {
      if (!spawnIds.has(spawnPointId)) {
        throw new Error(`Unknown team spawn point id: ${spawnPointId}`);
      }
    }
  }

  if (map.worldBounds) {
    const worldBounds = map.worldBounds;
    const terrainPoints = map.terrain.blobs.flatMap((blob) => [blob.outer, ...blob.holes]).flat();
    const contentPoints = [...map.spawnPoints.map((spawnPoint) => spawnPoint.position), ...terrainPoints];
    if (contentPoints.some((point) => !isWorldPointInBounds(point, worldBounds))) {
      throw new Error("Custom map content must stay inside world bounds.");
    }
  }

  return map;
}
