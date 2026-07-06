import { describe, expect, it } from "vitest";
import { fieldBounds, isWorldPointInBounds, worldBoundsForMapSize } from "@graphwar/shared";
import { FreeForAllMapGenerator } from "./FreeForAllMapGenerator";
import { TeamVersusMapGenerator } from "./TeamVersusMapGenerator";

describe("map generators", () => {
  it("creates deterministic team-versus spawns and terrain", () => {
    const map = new TeamVersusMapGenerator().generate("seed", ["alice", "bob", "charlie"]);

    expect(map.spawns).toEqual([
      { playerId: "alice", position: { x: -18, y: -6 } },
      { playerId: "bob", position: { x: 18, y: -6 } },
      { playerId: "charlie", position: { x: -18, y: -2 } }
    ]);
    expect(map.terrain).toEqual({
      blobs: [
        {
          id: "center-cover",
          outer: [
            { x: -2, y: -8 },
            { x: 2, y: -8 },
            { x: 2, y: 8 },
            { x: -2, y: 8 }
          ],
          holes: []
        },
        {
          id: "low-left",
          outer: [
            { x: -14, y: -12 },
            { x: -9, y: -12 },
            { x: -9, y: -9 },
            { x: -14, y: -9 }
          ],
          holes: []
        },
        {
          id: "low-right",
          outer: [
            { x: 9, y: -12 },
            { x: 14, y: -12 },
            { x: 14, y: -9 },
            { x: 9, y: -9 }
          ],
          holes: []
        }
      ]
    });
  });

  it("returns requested world bounds for team-versus maps", () => {
    const worldBounds = worldBoundsForMapSize("huge");
    const map = new TeamVersusMapGenerator().generate("seed", ["alice", "bob"], worldBounds);

    expect(map.worldBounds).toEqual(worldBounds);
  });

  it("creates explicit team-versus spawns by team membership", () => {
    const map = new TeamVersusMapGenerator().generateForTeams("seed", [
      { id: "team-a", playerIds: ["bob"] },
      { id: "team-b", playerIds: ["alice", "charlie"] }
    ]);

    expect(map.spawns).toEqual([
      { playerId: "bob", position: { x: -18, y: -6 } },
      { playerId: "alice", position: { x: 18, y: -6 } },
      { playerId: "charlie", position: { x: 18, y: -2 } }
    ]);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });

  it("creates free-for-all spawns around the field", () => {
    const map = new FreeForAllMapGenerator().generate("seed", ["alice", "bob", "charlie"]);
    expect(map.spawns).toHaveLength(3);
    expect(new Set(map.spawns.map((spawn) => `${spawn.position.x},${spawn.position.y}`)).size).toBe(3);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });

  it("scales free-for-all spawns into requested world bounds", () => {
    const worldBounds = worldBoundsForMapSize("large");
    const map = new FreeForAllMapGenerator().generate("seed", ["alice", "bob", "charlie"], worldBounds);

    expect(map.worldBounds).toEqual(worldBounds);
    expect(map.spawns.every((spawn) => isWorldPointInBounds(spawn.position, worldBounds))).toBe(true);
    expect(map.spawns[0].position.x).toBeCloseTo(24);
  });

  it("creates a finite in-bounds free-for-all spawn for one player", () => {
    const map = new FreeForAllMapGenerator().generate("seed", ["alice"]);
    const spawn = map.spawns[0];

    expect(spawn).toEqual({ playerId: "alice", position: { x: 16, y: 0 } });
    expect(Number.isFinite(spawn.position.x)).toBe(true);
    expect(Number.isFinite(spawn.position.y)).toBe(true);
    expect(spawn.position.x).toBeGreaterThanOrEqual(fieldBounds.minX);
    expect(spawn.position.x).toBeLessThanOrEqual(fieldBounds.maxX);
    expect(spawn.position.y).toBeGreaterThanOrEqual(fieldBounds.minY);
    expect(spawn.position.y).toBeLessThanOrEqual(fieldBounds.maxY);
  });

  it("repeats deterministic maps for the same seed and players", () => {
    const teamVersus = new TeamVersusMapGenerator();
    const freeForAll = new FreeForAllMapGenerator();
    const playerIds = ["alice", "bob", "charlie"];

    expect(teamVersus.generate("seed", playerIds)).toEqual(teamVersus.generate("seed", playerIds));
    expect(freeForAll.generate("seed", playerIds)).toEqual(freeForAll.generate("seed", playerIds));
  });

  it("keeps free-for-all terrain when there are no players", () => {
    const map = new FreeForAllMapGenerator().generate("seed", []);

    expect(map.spawns).toEqual([]);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });
});
