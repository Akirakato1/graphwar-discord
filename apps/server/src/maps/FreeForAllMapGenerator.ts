import {
  boundsHeight,
  boundsWidth,
  worldBoundsForMapSize,
  type PlayerId,
  type TerrainBlob,
  type TerrainState,
  type WorldBounds,
  type WorldPoint
} from "@graphwar/shared";
import { cloneWorldBounds, MapGenerator, type GeneratedMap } from "./MapGenerator";

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function triangleBlob(id: string, points: TerrainBlob["outer"]): TerrainBlob {
  return { id, outer: points, holes: [] };
}

function squareBlob(id: string, min: number, max: number): TerrainBlob {
  return {
    id,
    outer: [
      { x: min, y: min },
      { x: max, y: min },
      { x: max, y: max },
      { x: min, y: max }
    ],
    holes: []
  };
}

function scalePoint(point: WorldPoint, worldBounds: WorldBounds): WorldPoint {
  const scaleX = boundsWidth(worldBounds) / 50;
  const scaleY = boundsHeight(worldBounds) / 30;
  const centerX = (worldBounds.minX + worldBounds.maxX) / 2;
  const centerY = (worldBounds.minY + worldBounds.maxY) / 2;
  return {
    x: roundToTwoDecimals(centerX + point.x * scaleX),
    y: roundToTwoDecimals(centerY + point.y * scaleY)
  };
}

function scaleTerrain(terrain: TerrainState, worldBounds: WorldBounds): TerrainState {
  return {
    blobs: terrain.blobs.map((blob) => ({
      ...blob,
      outer: blob.outer.map((point) => scalePoint(point, worldBounds)),
      holes: blob.holes.map((hole) => hole.map((point) => scalePoint(point, worldBounds)))
    }))
  };
}

export class FreeForAllMapGenerator extends MapGenerator {
  generate(_seed: string, playerIds: PlayerId[], worldBounds = worldBoundsForMapSize("standard")): GeneratedMap {
    const terrain: TerrainState = {
      blobs: [
        squareBlob("center-rock", -3, 3),
        triangleBlob("upper-cover", [
          { x: -10, y: 7 },
          { x: -4, y: 8 },
          { x: -6, y: 11 }
        ]),
        triangleBlob("lower-cover", [
          { x: 5, y: -11 },
          { x: 12, y: -10 },
          { x: 9, y: -7 }
        ])
      ]
    };

    return {
      spawns: playerIds.map((playerId, index) => {
        const angle = (2 * Math.PI * index) / playerIds.length;

        return {
          playerId,
          position: scalePoint(
            {
              x: roundToTwoDecimals(Math.cos(angle) * 16),
              y: roundToTwoDecimals(Math.sin(angle) * 9)
            },
            worldBounds
          )
        };
      }),
      terrain: scaleTerrain(terrain, worldBounds),
      worldBounds: cloneWorldBounds(worldBounds)
    };
  }
}
