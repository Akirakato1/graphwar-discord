import { describe, expect, it } from "vitest";
import { mapSizePresetCatalog, mapSizePresetSchema, worldBoundsSchema } from "./schemas";
import { customMapImportSchema, validateCustomMapImportForSave } from "./schemas";
import {
  boundsHeight,
  boundsWidth,
  centeredWorldBounds,
  isWorldPointInBounds,
  mapSizePresets,
  worldBoundsForMapSize
} from "./worldBounds";

function spawnPoints(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `spawn-${index}`,
    position: { x: index, y: index % 2 === 0 ? 1 : -1 }
  }));
}

const validMap = {
  format: "graphwar-map",
  version: 1,
  name: "Arena One",
  terrain: {
    blobs: [
      {
        id: "center-rock",
        outer: [
          { x: -2, y: -1 },
          { x: 2, y: -1 },
          { x: 0, y: 2 }
        ],
        holes: []
      }
    ]
  },
  spawnPoints: spawnPoints(10),
  teamSpawnPointIds: {
    "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
    "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
  }
} as const;

describe("custom map schemas", () => {
  it("defines centered world bounds for every map size preset", () => {
    expect(mapSizePresetCatalog).toEqual({
      small: { id: "small", width: 40, height: 24, worldBounds: { minX: -20, maxX: 20, minY: -12, maxY: 12 } },
      standard: { id: "standard", width: 50, height: 30, worldBounds: { minX: -25, maxX: 25, minY: -15, maxY: 15 } },
      large: { id: "large", width: 75, height: 45, worldBounds: { minX: -37.5, maxX: 37.5, minY: -22.5, maxY: 22.5 } },
      huge: { id: "huge", width: 100, height: 60, worldBounds: { minX: -50, maxX: 50, minY: -30, maxY: 30 } }
    });

    expect(mapSizePresetSchema.parse("standard")).toBe("standard");
    expect(worldBoundsSchema.parse(mapSizePresetCatalog.standard.worldBounds)).toEqual({
      minX: -25,
      maxX: 25,
      minY: -15,
      maxY: 15
    });
  });

  it("exposes map size preset helpers", () => {
    expect(mapSizePresets.map((preset) => preset.id)).toEqual(["small", "standard", "large", "huge"]);
    expect(worldBoundsForMapSize("large")).toEqual({ minX: -37.5, maxX: 37.5, minY: -22.5, maxY: 22.5 });
    expect(boundsWidth(mapSizePresetCatalog.large.worldBounds)).toBe(75);
    expect(boundsHeight(mapSizePresetCatalog.large.worldBounds)).toBe(45);
    expect(centeredWorldBounds(64, 32)).toEqual({ minX: -32, maxX: 32, minY: -16, maxY: 16 });
    expect(isWorldPointInBounds({ x: -37.5, y: 22.5 }, mapSizePresetCatalog.large.worldBounds)).toBe(true);
    expect(isWorldPointInBounds({ x: -37.6, y: 0 }, mapSizePresetCatalog.large.worldBounds)).toBe(false);
  });

  it("returns fresh world bounds copies for map size presets", () => {
    const bounds = worldBoundsForMapSize("large");
    bounds.minX = 0;

    expect(worldBoundsForMapSize("large")).toEqual({ minX: -37.5, maxX: 37.5, minY: -22.5, maxY: 22.5 });
    expect(mapSizePresetCatalog.large.worldBounds).toEqual({ minX: -37.5, maxX: 37.5, minY: -22.5, maxY: 22.5 });
  });

  it("accepts a valid graphwar map import", () => {
    expect(customMapImportSchema.parse(validMap).name).toBe("Arena One");
  });

  it("rejects terrain blobs with empty ids", () => {
    expect(() =>
      customMapImportSchema.parse({
        ...validMap,
        terrain: {
          blobs: [
            {
              ...validMap.terrain.blobs[0],
              id: ""
            }
          ]
        }
      })
    ).toThrow();
  });

  it("rejects terrain blobs with outer rings shorter than three points", () => {
    expect(() =>
      customMapImportSchema.parse({
        ...validMap,
        terrain: {
          blobs: [
            {
              ...validMap.terrain.blobs[0],
              outer: [
                { x: -2, y: -1 },
                { x: 2, y: -1 }
              ]
            }
          ]
        }
      })
    ).toThrow();
  });

  it("rejects terrain hole rings shorter than three points", () => {
    expect(() =>
      customMapImportSchema.parse({
        ...validMap,
        terrain: {
          blobs: [
            {
              ...validMap.terrain.blobs[0],
              holes: [
                [
                  { x: -1, y: 0 },
                  { x: 1, y: 0 }
                ]
              ]
            }
          ]
        }
      })
    ).toThrow();
  });

  it("rejects maps with fewer than ten spawn points for server save", () => {
    expect(() =>
      validateCustomMapImportForSave({
        ...validMap,
        spawnPoints: spawnPoints(9),
        teamSpawnPointIds: { "team-a": ["spawn-0"], "team-b": ["spawn-1"] }
      })
    ).toThrow("at least 10 spawn points");
  });

  it("rejects duplicate spawn point ids", () => {
    const duplicateSpawns = spawnPoints(10);
    duplicateSpawns[9] = { ...duplicateSpawns[9], id: "spawn-0" };

    expect(() => validateCustomMapImportForSave({ ...validMap, spawnPoints: duplicateSpawns })).toThrow(
      "Spawn point ids must be unique"
    );
  });

  it("rejects out-of-bounds spawn points when world bounds are present", () => {
    expect(() =>
      validateCustomMapImportForSave({
        ...validMap,
        worldBounds: worldBoundsForMapSize("small"),
        spawnPoints: validMap.spawnPoints.map((spawnPoint, index) =>
          index === 9 ? { ...spawnPoint, position: { x: 21, y: 0 } } : spawnPoint
        )
      })
    ).toThrow("Custom map content must stay inside world bounds.");
  });

  it("rejects out-of-bounds terrain points when world bounds are present", () => {
    expect(() =>
      validateCustomMapImportForSave({
        ...validMap,
        worldBounds: worldBoundsForMapSize("small"),
        terrain: {
          blobs: [
            {
              ...validMap.terrain.blobs[0],
              outer: [
                { x: -2, y: -1 },
                { x: 2, y: -1 },
                { x: 21, y: 2 }
              ]
            }
          ]
        }
      })
    ).toThrow("Custom map content must stay inside world bounds.");
  });

  it("rejects team spawn ids that do not exist", () => {
    expect(() =>
      validateCustomMapImportForSave({
        ...validMap,
        teamSpawnPointIds: { "team-a": ["missing-spawn"], "team-b": ["spawn-1"] }
      })
    ).toThrow("Unknown team spawn point id");
  });
});
