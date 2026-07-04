import type { PlayerId, TeamId, TeamState } from "@graphwar/shared";

export type TeamVersusTeamId = TeamId & ("team-a" | "team-b");

export const teamVersusTeamIds: readonly TeamVersusTeamId[] = ["team-a", "team-b"];

export function assignTeamIdByPlayerIndex(index: number): TeamVersusTeamId {
  return teamVersusTeamIds[index % teamVersusTeamIds.length];
}

export function playerTeamIndexByPlayerIndex(index: number): number {
  return Math.floor(index / teamVersusTeamIds.length);
}

export function splitPlayerIdsByTeam(playerIds: PlayerId[]): TeamState[] {
  return teamVersusTeamIds.map((teamId) => ({
    id: teamId,
    playerIds: playerIds.filter((_, index) => assignTeamIdByPlayerIndex(index) === teamId)
  }));
}
