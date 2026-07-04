import { describe, expect, it } from "vitest";
import type { TerrainState } from "@graphwar/shared";
import { CircleCraterExplosion } from "./Explosion";
import { TerrainSystem } from "./TerrainSystem";

describe("TerrainSystem", () => {
  it("removes terrain where a circular crater overlaps a blob", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "ground",
          outer: [
            { x: -5, y: -1 },
            { x: 5, y: -1 },
            { x: 5, y: 1 },
            { x: -5, y: 1 }
          ],
          holes: []
        }
      ]
    };

    const system = new TerrainSystem(0.05);
    const result = system.applyCircleCrater(terrain, { x: 0, y: 0 }, 1, "shot-1");

    expect(result.blobs.length).toBeGreaterThan(0);
    expect(result.blobs.map((blob) => blob.id)).not.toContain("ground");
    expect(JSON.stringify(result)).not.toContain("\"x\":0,\"y\":0");
  });

  it("keeps terrain unchanged when crater misses every blob", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "ground",
          outer: [
            { x: -5, y: -1 },
            { x: 5, y: -1 },
            { x: 5, y: 1 },
            { x: -5, y: 1 }
          ],
          holes: []
        }
      ]
    };

    const system = new TerrainSystem(0.05);
    expect(system.applyCircleCrater(terrain, { x: 20, y: 10 }, 1, "shot-1")).toEqual(terrain);
  });

  it("removes blobs fully covered by the crater", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "pebble",
          outer: [
            { x: -0.25, y: -0.25 },
            { x: 0.25, y: -0.25 },
            { x: 0.25, y: 0.25 },
            { x: -0.25, y: 0.25 }
          ],
          holes: []
        }
      ]
    };

    const system = new TerrainSystem(0.05);
    expect(system.applyCircleCrater(terrain, { x: 0, y: 0 }, 1, "shot-1")).toEqual({
      blobs: []
    });
  });

  it("circle crater explosion applies terrain removal", () => {
    const explosion = new CircleCraterExplosion(1.25, 35);
    const terrainSystem = new TerrainSystem(0.05);
    const terrain: TerrainState = {
      blobs: [
        {
          id: "ground",
          outer: [
            { x: -5, y: -1 },
            { x: 5, y: -1 },
            { x: 5, y: 1 },
            { x: -5, y: 1 }
          ],
          holes: []
        }
      ]
    };

    const result = explosion.apply(terrain, { x: 0, y: 0 }, terrainSystem, "shot-2");

    expect(explosion.type).toBe("circle-crater");
    expect(explosion.damage).toBe(35);
    expect(result.terrain).not.toEqual(terrain);
  });
});
