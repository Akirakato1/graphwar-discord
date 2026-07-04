import type { PlayerId, TerrainBlob } from "@graphwar/shared";
import { MapGenerator, type GeneratedMap } from "./MapGenerator";

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

export class FreeForAllMapGenerator extends MapGenerator {
  generate(_seed: string, playerIds: PlayerId[]): GeneratedMap {
    return {
      spawns: playerIds.map((playerId, index) => {
        const angle = (2 * Math.PI * index) / playerIds.length;

        return {
          playerId,
          position: {
            x: roundToTwoDecimals(Math.cos(angle) * 16),
            y: roundToTwoDecimals(Math.sin(angle) * 9)
          }
        };
      }),
      terrain: {
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
      }
    };
  }
}
