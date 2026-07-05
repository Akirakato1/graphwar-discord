import type { MatchModeId, PlayerId, TeamState } from "@graphwar/shared";
import { GameMode, type LobbyPlayer, type TurnPlayer } from "./GameMode";
import { splitPlayerIdsByTeam, teamVersusTeamIds } from "./TeamAssignment";

export class TeamVersusMode extends GameMode {
  readonly id: MatchModeId = "team-versus";

  buildTeams(players: LobbyPlayer[]): TeamState[] {
    const explicitTeamPlayers = players.filter((player) =>
      teamVersusTeamIds.some((teamId) => teamId === player.teamId)
    );
    if (explicitTeamPlayers.length === players.length && players.length > 0) {
      return teamVersusTeamIds.map((teamId) => ({
        id: teamId,
        playerIds: players.filter((player) => player.teamId === teamId).map((player) => player.id)
      }));
    }

    return splitPlayerIdsByTeam(players.map((player) => player.id));
  }

  createTurnOrder(players: TurnPlayer[]): PlayerId[] {
    return players.filter((player) => player.alive).map((player) => player.id);
  }

  isVictory(players: TurnPlayer[]): { ended: boolean; winnerIds: PlayerId[] } {
    const livingPlayers = players.filter((player) => player.alive);
    const livingTeamIds = new Set(livingPlayers.map((player) => player.teamId));

    if (livingTeamIds.size !== 1) {
      return { ended: false, winnerIds: [] };
    }

    const winningTeamId = livingTeamIds.values().next().value;
    const winnerIds = players.filter((player) => player.teamId === winningTeamId).map((player) => player.id);

    return { ended: true, winnerIds };
  }
}
