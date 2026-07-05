import type { LobbyPlacementId, MatchModeId, PersistedCustomMap, WorldPoint } from "@graphwar/shared";
import type { GeneratedMap, SpawnPoint } from "./MapGenerator";

export type CustomMapSpawnPlayer = {
  playerId: string;
  placement: LobbyPlacementId;
};

const teamSpawnLabels = {
  "team-a": "Team A",
  "team-b": "Team B"
} as const;

function distanceSquared(left: WorldPoint, right: WorldPoint): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

export class CustomMapSpawner {
  generate(mode: MatchModeId, map: PersistedCustomMap, players: CustomMapSpawnPlayer[]): GeneratedMap {
    return {
      terrain: structuredClone(map.terrain),
      spawns: mode === "team-versus" ? this.teamVersusSpawns(map, players) : this.freeForAllSpawns(map, players)
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
