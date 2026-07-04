import { describe, expect, it } from "vitest";
import { polygonArea, type TerrainBlob, type TerrainState } from "@graphwar/shared";
import { CircleCraterExplosion } from "./Explosion";
import { TerrainSystem } from "./TerrainSystem";

function netBlobArea(blob: TerrainBlob): number {
  return polygonArea(blob.outer) - blob.holes.reduce((sum, hole) => sum + polygonArea(hole), 0);
}

function totalTerrainNetArea(terrain: TerrainState): number {
  return terrain.blobs.reduce((sum, blob) => sum + netBlobArea(blob), 0);
}

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
    expect(result.blobs.length).toBeGreaterThan(1);
    expect(totalTerrainNetArea(result)).toBeLessThan(totalTerrainNetArea(terrain));
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
    expect(system.applyCircleCrater(terrain, { x: 20, y: 10 }, 1, "shot-1")).toBe(terrain);
  });

  it("keeps redundant-point terrain unchanged when the crater misses", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "ground",
          outer: [
            { x: -5, y: -1 },
            { x: -2, y: -1 },
            { x: 5, y: -1 },
            { x: 5, y: 1 },
            { x: 0, y: 1 },
            { x: -5, y: 1 },
            { x: -5, y: 0 },
            { x: -5, y: -1 }
          ],
          holes: []
        }
      ]
    };

    const system = new TerrainSystem(0.05);
    expect(system.applyCircleCrater(terrain, { x: 20, y: 10 }, 1, "shot-1")).toBe(terrain);
  });

  it("preserves untouched blobs when another blob is cratered", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "left",
          outer: [
            { x: -5, y: -1 },
            { x: -1, y: -1 },
            { x: -1, y: 1 },
            { x: -5, y: 1 }
          ],
          holes: []
        },
        {
          id: "right",
          outer: [
            { x: 2, y: -1 },
            { x: 5, y: -1 },
            { x: 5, y: 1 },
            { x: 2, y: 1 }
          ],
          holes: []
        }
      ]
    };

    const system = new TerrainSystem(0.05);
    const result = system.applyCircleCrater(terrain, { x: -3, y: 0 }, 0.75, "shot-1");
    const untouchedBlob = result.blobs.find((blob) => blob.id === "right");

    expect(result).not.toBe(terrain);
    expect(untouchedBlob).toBe(terrain.blobs[1]);
    expect(result.blobs.some((blob) => blob.id.startsWith("shot-1-0-"))).toBe(true);
  });

  it("filters changed terrain by net area including holes", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "thin-shell",
          outer: [
            { x: -5, y: -5 },
            { x: 5, y: -5 },
            { x: 5, y: 5 },
            { x: -5, y: 5 }
          ],
          holes: [
            [
              { x: -4.9, y: -4.9 },
              { x: -4.9, y: 4.1 },
              { x: 4.9, y: 4.1 },
              { x: 4.9, y: -4.9 }
            ]
          ]
        }
      ]
    };

    const system = new TerrainSystem(12);
    const result = system.applyCircleCrater(terrain, { x: 0, y: 4.55 }, 0.2, "shot-1");

    expect(totalTerrainNetArea(terrain)).toBeLessThan(12);
    expect(result.blobs).toEqual([]);
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
