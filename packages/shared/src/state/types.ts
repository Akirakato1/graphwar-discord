import type { TerrainState, WorldPoint } from "../geometry/types";
import type { PlayerColor } from "../lobby/identity";

export type PlayerId = string;
export type TeamId = string;
export type RoomId = string;
export type FunctionFamilyId = "normal";
export const aimDirections = [
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
  "south",
  "south-east"
] as const;
export type AimDirectionId = (typeof aimDirections)[number];
export type MatchModeId = "team-versus" | "free-for-all";
export type MatchPhase = "lobby" | "playing" | "ended";

export type PlayerState = {
  id: PlayerId;
  displayName: string;
  color?: PlayerColor;
  teamId: TeamId;
  position: WorldPoint;
  hp: number;
  alive: boolean;
};

export type TeamState = {
  id: TeamId;
  playerIds: PlayerId[];
};

export type TurnState = {
  activePlayerId: PlayerId;
  order: PlayerId[];
  turnNumber: number;
};

export type MatchSnapshot = {
  phase: MatchPhase;
  mode: MatchModeId;
  players: PlayerState[];
  teams: TeamState[];
  terrain: TerrainState;
  turn: TurnState;
};
