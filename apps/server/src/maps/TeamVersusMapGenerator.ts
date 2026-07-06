import {
  boundsHeight,
  boundsWidth,
  worldBoundsForMapSize,
  type PlayerId,
  type TeamState,
  type TerrainBlob,
  type TerrainState,
  type WorldBounds,
  type WorldPoint
} from "@graphwar/shared";
import {
  assignTeamIdByPlayerIndex,
  playerTeamIndexByPlayerIndex,
  teamVersusTeamIds,
  type TeamVersusTeamId
} from "../modes/TeamAssignment";
import { cloneWorldBounds, MapGenerator, type GeneratedMap, type SpawnPoint } from "./MapGenerator";

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

function scalePoint(point: WorldPoint, worldBounds: WorldBounds): WorldPoint {
  const scaleX = boundsWidth(worldBounds) / 50;
  const scaleY = boundsHeight(worldBounds) / 30;
  const centerX = (worldBounds.minX + worldBounds.maxX) / 2;
  const centerY = (worldBounds.minY + worldBounds.maxY) / 2;
  return {
    x: centerX + point.x * scaleX,
    y: centerY + point.y * scaleY
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

function spawnForTeam(
  playerId: PlayerId,
  teamId: TeamVersusTeamId,
  teamIndex: number,
  worldBounds: WorldBounds
): SpawnPoint {
  return {
    playerId,
    position: scalePoint({ x: spawnXByTeamId[teamId], y: -6 + teamIndex * 4 }, worldBounds)
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
  generate(_seed: string, playerIds: PlayerId[], worldBounds = worldBoundsForMapSize("standard")): GeneratedMap {
    return {
      spawns: playerIds.map((playerId, index) => {
        const teamId = assignTeamIdByPlayerIndex(index);
        const teamIndex = playerTeamIndexByPlayerIndex(index);

        return spawnForTeam(playerId, teamId, teamIndex, worldBounds);
      }),
      terrain: scaleTerrain(teamVersusTerrain(), worldBounds),
      worldBounds: cloneWorldBounds(worldBounds)
    };
  }

  generateForTeams(_seed: string, teams: TeamState[], worldBounds = worldBoundsForMapSize("standard")): GeneratedMap {
    const spawns = teamVersusTeamIds.flatMap((teamId) => {
      const team = teams.find((candidate) => candidate.id === teamId);
      return (team?.playerIds ?? []).map((playerId, teamIndex) =>
        spawnForTeam(playerId, teamId, teamIndex, worldBounds)
      );
    });

    return {
      spawns,
      terrain: scaleTerrain(teamVersusTerrain(), worldBounds),
      worldBounds: cloneWorldBounds(worldBounds)
    };
  }
}
