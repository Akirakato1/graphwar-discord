import {
  worldBoundsForMapSize,
  normalizeTerrainState,
  type LobbyPlacementId,
  type MatchModeId,
  type PersistedCustomMap,
  type TerrainState,
  type WorldBounds,
  type WorldPoint
} from "@graphwar/shared";
import { cloneWorldBounds, type GeneratedMap, type SpawnPoint } from "./MapGenerator";

export type CustomMapSpawnPlayer = {
  playerId: string;
  placement: LobbyPlacementId;
};

const teamSpawnLabels = {
  "team-a": "Team A",
  "team-b": "Team B"
} as const;

const derivedBoundsPadding = 2;

function distanceSquared(left: WorldPoint, right: WorldPoint): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function pointBounds(points: WorldPoint[]): WorldBounds | undefined {
  if (points.length === 0) {
    return undefined;
  }

  return points.reduce<WorldBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    { minX: points[0].x, maxX: points[0].x, minY: points[0].y, maxY: points[0].y }
  );
}

function terrainPoints(terrain: TerrainState): WorldPoint[] {
  return terrain.blobs.flatMap((blob) => [...blob.outer, ...blob.holes.flat()]);
}

function padBounds(bounds: WorldBounds): WorldBounds {
  return {
    minX: bounds.minX - derivedBoundsPadding,
    maxX: bounds.maxX + derivedBoundsPadding,
    minY: bounds.minY - derivedBoundsPadding,
    maxY: bounds.maxY + derivedBoundsPadding
  };
}

function deriveBoundsFromTerrainAndSpawns(map: PersistedCustomMap): WorldBounds | undefined {
  const bounds = pointBounds([...terrainPoints(map.terrain), ...map.spawnPoints.map((spawnPoint) => spawnPoint.position)]);
  return bounds ? padBounds(bounds) : undefined;
}

export class CustomMapSpawner {
  generate(mode: MatchModeId, map: PersistedCustomMap, players: CustomMapSpawnPlayer[]): GeneratedMap {
    return {
      terrain: normalizeTerrainState(map.terrain),
      spawns: mode === "team-versus" ? this.teamVersusSpawns(map, players) : this.freeForAllSpawns(map, players),
      worldBounds: cloneWorldBounds(
        map.worldBounds ?? deriveBoundsFromTerrainAndSpawns(map) ?? worldBoundsForMapSize("standard")
      )
    };
  }

  private teamVersusSpawns(map: PersistedCustomMap, players: CustomMapSpawnPlayer[]): SpawnPoint[] {
    const spawns: SpawnPoint[] = [];

    for (const teamId of ["team-a", "team-b"] as const) {
      const teamPlayers = players.filter((player) => player.placement === teamId);
      const teamSpawnPoints = map.teamSpawnPointIds[teamId].map((spawnPointId) => {
        const spawnPoint = map.spawnPoints.find((candidate) => candidate.id === spawnPointId);
        if (!spawnPoint) {
          throw new Error(`${teamSpawnLabels[teamId]} custom map spawn point is missing: ${spawnPointId}.`);
        }
        return spawnPoint;
      });

      if (teamSpawnPoints.length < teamPlayers.length) {
        throw new Error(`${teamSpawnLabels[teamId]} needs at least ${teamPlayers.length} custom map spawn point.`);
      }

      spawns.push(
        ...teamPlayers.map((player, index) => ({
          playerId: player.playerId,
          position: { ...teamSpawnPoints[index].position }
        }))
      );
    }

    return spawns;
  }

  private freeForAllSpawns(map: PersistedCustomMap, players: CustomMapSpawnPlayer[]): SpawnPoint[] {
    if (map.spawnPoints.length < players.length) {
      throw new Error(`Free-for-all needs at least ${players.length} custom map spawn points.`);
    }

    const selectedIndexes: number[] = [];
    const remainingIndexes = map.spawnPoints.map((_spawnPoint, index) => index);

    while (selectedIndexes.length < players.length) {
      let bestRemainingOffset = 0;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const [remainingOffset, spawnIndex] of remainingIndexes.entries()) {
        const candidate = map.spawnPoints[spawnIndex];
        const score =
          selectedIndexes.length === 0
            ? Number.POSITIVE_INFINITY
            : Math.min(
                ...selectedIndexes.map((selectedIndex) =>
                  distanceSquared(candidate.position, map.spawnPoints[selectedIndex].position)
                )
              );

        if (score > bestScore) {
          bestScore = score;
          bestRemainingOffset = remainingOffset;
        }
      }

      selectedIndexes.push(remainingIndexes.splice(bestRemainingOffset, 1)[0]);
    }

    return players.map((player, index) => ({
      playerId: player.playerId,
      position: { ...map.spawnPoints[selectedIndexes[index]].position }
    }));
  }
}
