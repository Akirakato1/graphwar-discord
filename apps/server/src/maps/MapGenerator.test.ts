import { describe, expect, it } from "vitest";
import {
  fieldBounds,
  isWorldPointInBounds,
  mapSizePresetIds,
  worldBoundsForMapSize,
  type TerrainBlob,
  type TerrainState,
  type WorldPoint
} from "@graphwar/shared";
import { FreeForAllMapGenerator } from "./FreeForAllMapGenerator";
import { TeamVersusMapGenerator } from "./TeamVersusMapGenerator";

function pointOnSegment(point: WorldPoint, start: WorldPoint, end: WorldPoint): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 1e-9) return false;

  return (
    point.x >= Math.min(start.x, end.x) - 1e-9 &&
    point.x <= Math.max(start.x, end.x) + 1e-9 &&
    point.y >= Math.min(start.y, end.y) - 1e-9 &&
    point.y <= Math.max(start.y, end.y) + 1e-9
  );
}

function pointInRing(point: WorldPoint, ring: WorldPoint[]): boolean {
  let inside = false;
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const crossesY = current.y > point.y !== previous.y > point.y;
    if (!crossesY) continue;

    const intersectionX = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (point.x < intersectionX) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInBlob(point: WorldPoint, blob: TerrainBlob): boolean {
  return pointInRing(point, blob.outer) && !blob.holes.some((hole) => pointInRing(point, hole));
}

function terrainAtPoint(point: WorldPoint, terrain: TerrainState): string | undefined {
  return terrain.blobs.find((blob) => pointInBlob(point, blob))?.id;
}

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

  it("keeps generated default-map spawn points out of terrain", () => {
    const freeForAll = new FreeForAllMapGenerator();
    const teamVersus = new TeamVersusMapGenerator();

    for (const presetId of mapSizePresetIds) {
      const bounds = worldBoundsForMapSize(presetId);
      for (let playerCount = 1; playerCount <= 10; playerCount += 1) {
        const playerIds = Array.from({ length: playerCount }, (_, index) => `player-${index}`);
        const maps = [
          { mode: "free-for-all", map: freeForAll.generate("seed", playerIds, bounds) },
          { mode: "team-versus", map: teamVersus.generate("seed", playerIds, bounds) }
        ];

        for (const generated of maps) {
          const blocked = generated.map.spawns.flatMap((spawn) => {
            const terrainId = terrainAtPoint(spawn.position, generated.map.terrain);
            return terrainId
              ? [{ presetId, playerCount, mode: generated.mode, playerId: spawn.playerId, terrainId }]
              : [];
          });

          expect(blocked).toEqual([]);
        }
      }
    }
  });
});
