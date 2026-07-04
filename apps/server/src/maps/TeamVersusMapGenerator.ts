import type { PlayerId, TerrainBlob } from "@graphwar/shared";
import {
  assignTeamIdByPlayerIndex,
  playerTeamIndexByPlayerIndex,
  type TeamVersusTeamId
} from "../modes/TeamAssignment";
import { MapGenerator, type GeneratedMap } from "./MapGenerator";

const spawnXByTeamId: Record<TeamVersusTeamId, number> = {
  "team-a": -18,
  "team-b": 18
};

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
        const teamId = assignTeamIdByPlayerIndex(index);
        const teamIndex = playerTeamIndexByPlayerIndex(index);

        return {
          playerId,
          position: { x: spawnXByTeamId[teamId], y: -6 + teamIndex * 4 }
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
