import { describe, expect, it } from "vitest";
import { FreeForAllMapGenerator } from "./FreeForAllMapGenerator";
import { TeamVersusMapGenerator } from "./TeamVersusMapGenerator";

describe("map generators", () => {
  it("creates team-versus spawns on opposite sides", () => {
    const map = new TeamVersusMapGenerator().generate("seed", ["alice", "bob"]);
    expect(map.spawns.find((spawn) => spawn.playerId === "alice")?.position.x).toBeLessThan(0);
    expect(map.spawns.find((spawn) => spawn.playerId === "bob")?.position.x).toBeGreaterThan(0);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });

  it("creates free-for-all spawns around the field", () => {
    const map = new FreeForAllMapGenerator().generate("seed", ["alice", "bob", "charlie"]);
    expect(map.spawns).toHaveLength(3);
    expect(new Set(map.spawns.map((spawn) => `${spawn.position.x},${spawn.position.y}`)).size).toBe(3);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });

  it("keeps free-for-all terrain when there are no players", () => {
    const map = new FreeForAllMapGenerator().generate("seed", []);

    expect(map.spawns).toEqual([]);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });
});
