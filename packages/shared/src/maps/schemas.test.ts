import { describe, expect, it } from "vitest";
import { customMapImportSchema, validateCustomMapImportForSave } from "./schemas";

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

  it("rejects team spawn ids that do not exist", () => {
    expect(() =>
      validateCustomMapImportForSave({
        ...validMap,
        teamSpawnPointIds: { "team-a": ["missing-spawn"], "team-b": ["spawn-1"] }
      })
    ).toThrow("Unknown team spawn point id");
  });
});
