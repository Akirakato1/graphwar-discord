import type { PlayerId, TerrainBlob } from "@graphwar/shared";
import { MapGenerator, type GeneratedMap } from "./MapGenerator";

function rectangleBlob(id: string, minX: number, maxX: number, minY: number, maxY: number): TerrainBlob {
  return {
    id,
    outer: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ],
    holes: []
  };
}

export class TeamVersusMapGenerator extends MapGenerator {
  generate(_seed: string, playerIds: PlayerId[]): GeneratedMap {
    return {
      spawns: playerIds.map((playerId, index) => {
        const teamIndex = Math.floor(index / 2);

        return {
          playerId,
          position: { x: index % 2 === 0 ? -18 : 18, y: -6 + teamIndex * 4 }
        };
      }),
      terrain: {
        blobs: [
          rectangleBlob("center-cover", -2, 2, -8, 8),
          rectangleBlob("low-left", -14, -9, -12, -9),
          rectangleBlob("low-right", 9, 14, -12, -9)
        ]
      }
    };
  }
}
