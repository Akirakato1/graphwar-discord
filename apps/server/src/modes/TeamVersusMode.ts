import type { MatchModeId, PlayerId, TeamState } from "@graphwar/shared";
import { GameMode, type LobbyPlayer, type TurnPlayer } from "./GameMode";

export class TeamVersusMode extends GameMode {
  readonly id: MatchModeId = "team-versus";

  buildTeams(players: LobbyPlayer[]): TeamState[] {
    return [
      { id: "team-a", playerIds: players.filter((_, index) => index % 2 === 0).map((player) => player.id) },
      { id: "team-b", playerIds: players.filter((_, index) => index % 2 === 1).map((player) => player.id) }
    ];
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

    return { ended: true, winnerIds: livingPlayers.map((player) => player.id) };
  }
}
