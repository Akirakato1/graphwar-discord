import type { MatchModeId, PlayerId, TeamId, TeamState } from "@graphwar/shared";

export type LobbyPlayer = { id: PlayerId; displayName: string };
export type TurnPlayer = { id: PlayerId; teamId: TeamId; alive: boolean };

export abstract class GameMode {
  abstract readonly id: MatchModeId;
  abstract buildTeams(players: LobbyPlayer[]): TeamState[];
  abstract createTurnOrder(players: TurnPlayer[]): PlayerId[];
  abstract isVictory(players: TurnPlayer[]): { ended: boolean; winnerIds: PlayerId[] };
}
