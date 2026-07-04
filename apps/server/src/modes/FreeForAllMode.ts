import type { MatchModeId, PlayerId, TeamState } from "@graphwar/shared";
import { GameMode, type LobbyPlayer, type TurnPlayer } from "./GameMode";

export class FreeForAllMode extends GameMode {
  readonly id: MatchModeId = "free-for-all";

  buildTeams(players: LobbyPlayer[]): TeamState[] {
    return players.map((player) => ({ id: `player-${player.id}`, playerIds: [player.id] }));
  }

  createTurnOrder(players: TurnPlayer[]): PlayerId[] {
    return players.filter((player) => player.alive).map((player) => player.id);
  }

  isVictory(players: TurnPlayer[]): { ended: boolean; winnerIds: PlayerId[] } {
    const livingPlayers = players.filter((player) => player.alive);

    if (livingPlayers.length !== 1) {
      return { ended: false, winnerIds: [] };
    }

    return { ended: true, winnerIds: [livingPlayers[0].id] };
  }
}
