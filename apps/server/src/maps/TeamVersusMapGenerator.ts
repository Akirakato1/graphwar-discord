import type { PlayerId, TeamState, TerrainBlob, TerrainState } from "@graphwar/shared";
import {
  assignTeamIdByPlayerIndex,
  playerTeamIndexByPlayerIndex,
  teamVersusTeamIds,
  type TeamVersusTeamId
} from "../modes/TeamAssignment";
import { MapGenerator, type GeneratedMap, type SpawnPoint } from "./MapGenerator";

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

function spawnForTeam(playerId: PlayerId, teamId: TeamVersusTeamId, teamIndex: number): SpawnPoint {
  return {
    playerId,
    position: { x: spawnXByTeamId[teamId], y: -6 + teamIndex * 4 }
  };
}

function teamVersusTerrain(): TerrainState {
  return {
    blobs: [
      rectangleBlob("center-cover", -2, 2, -8, 8),
      rectangleBlob("low-left", -14, -9, -12, -9),
      rectangleBlob("low-right", 9, 14, -12, -9)
    ]
  };
}

export class TeamVersusMapGenerator extends MapGenerator {
  generate(_seed: string, playerIds: PlayerId[]): GeneratedMap {
    return {
      spawns: playerIds.map((playerId, index) => {
        const teamId = assignTeamIdByPlayerIndex(index);
        const teamIndex = playerTeamIndexByPlayerIndex(index);

        return spawnForTeam(playerId, teamId, teamIndex);
      }),
      terrain: teamVersusTerrain()
    };
  }

  generateForTeams(_seed: string, teams: TeamState[]): GeneratedMap {
    const spawns = teamVersusTeamIds.flatMap((teamId) => {
      const team = teams.find((candidate) => candidate.id === teamId);
      return (team?.playerIds ?? []).map((playerId, teamIndex) => spawnForTeam(playerId, teamId, teamIndex));
    });

    return {
      spawns,
      terrain: teamVersusTerrain()
    };
  }
}
