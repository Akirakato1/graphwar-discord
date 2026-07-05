import type { PersistedCustomMap } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import { CustomMapSpawner } from "./CustomMapSpawner";

function persistedMap(overrides: Partial<PersistedCustomMap> = {}): PersistedCustomMap {
  const spawnPoints = Array.from({ length: 10 }, (_, index) => ({
    id: `spawn-${index}`,
    position: { x: index * 4, y: index % 2 === 0 ? 0 : 6 }
  }));

  return {
    format: "graphwar-map",
    version: 1,
    id: "map-1",
    guildId: "guild-1",
    ownerDiscordUserId: "alice-id",
    name: "Custom Arena",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    terrain: {
      blobs: [
        {
          id: "custom-rock",
          outer: [
            { x: -2, y: -1 },
            { x: 2, y: -1 },
            { x: 0, y: 2 }
          ],
          holes: []
        }
      ]
    },
    spawnPoints,
    teamSpawnPointIds: {
      "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
      "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
    },
    ...overrides
  };
}

describe("CustomMapSpawner", () => {
  it("uses team-specific spawn points and preserves custom terrain for team-versus", () => {
    const generated = new CustomMapSpawner().generate("team-versus", persistedMap(), [
      { playerId: "alice", placement: "team-a" },
      { playerId: "bob", placement: "team-b" },
      { playerId: "carol", placement: "team-a" }
    ]);

    expect(generated.terrain.blobs).toEqual([expect.objectContaining({ id: "custom-rock" })]);
    expect(generated.spawns).toEqual([
      { playerId: "alice", position: { x: 0, y: 0 } },
      { playerId: "carol", position: { x: 4, y: 6 } },
      { playerId: "bob", position: { x: 20, y: 6 } }
    ]);
  });

  it("blocks team-versus generation with a clear Team B spawn message", () => {
    expect(() =>
      new CustomMapSpawner().generate(
        "team-versus",
        persistedMap({ teamSpawnPointIds: { "team-a": ["spawn-0"], "team-b": [] } }),
        [
          { playerId: "alice", placement: "team-a" },
          { playerId: "bob", placement: "team-b" }
        ]
      )
    ).toThrow("Team B needs at least 1 custom map spawn point.");
  });

  it("picks unique free-for-all spawns with deterministic greedy max-min separation", () => {
    const generated = new CustomMapSpawner().generate(
      "free-for-all",
      persistedMap({
        spawnPoints: [
          { id: "left", position: { x: 0, y: 0 } },
          { id: "near-left", position: { x: 1, y: 0 } },
          { id: "middle", position: { x: 10, y: 0 } },
          { id: "right", position: { x: 20, y: 0 } }
        ]
      }),
      [
        { playerId: "alice", placement: "players" },
        { playerId: "bob", placement: "players" },
        { playerId: "carol", placement: "players" }
      ]
    );

    expect(generated.spawns).toEqual([
      { playerId: "alice", position: { x: 0, y: 0 } },
      { playerId: "bob", position: { x: 20, y: 0 } },
      { playerId: "carol", position: { x: 10, y: 0 } }
    ]);
  });
});
