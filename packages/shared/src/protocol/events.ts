import type { TerrainState, WorldPoint } from "../geometry/types";
import type { GuildId, LobbyRuntimeSnapshot } from "../lobby/types";
import type { AimDirectionId, FunctionFamilyId, MatchSnapshot, PlayerId, RoomId } from "../state/types";

export type ImpactReason =
  | "terrain-hit"
  | "player-hit"
  | "undefined-function"
  | "path-too-long"
  | "field-boundary"
  | "miss";

export type ImpactEvent = {
  reason: ImpactReason;
  point?: WorldPoint;
  targetPlayerId?: PlayerId;
  craterRadius?: number;
};
export type DamageEvent = { playerId: PlayerId; amount: number; hpAfter: number };
export type RoomSnapshotEvent = {
  type: "room-snapshot";
  guildId?: GuildId;
  roomId: RoomId;
  snapshot: MatchSnapshot;
  lobby?: LobbyRuntimeSnapshot;
};

export type MatchStartedEvent = {
  type: "match-started";
  guildId?: GuildId;
  roomId: RoomId;
  snapshot: MatchSnapshot;
  lobby?: LobbyRuntimeSnapshot;
};

export type LobbyCancelledEvent = {
  type: "lobby-cancelled";
  guildId?: GuildId;
  roomId: RoomId;
  lobby: LobbyRuntimeSnapshot;
};

export type ShotResolvedEvent = {
  type: "shot-resolved";
  guildId?: GuildId;
  roomId: RoomId;
  shooterId: PlayerId;
  functionFamilyId: FunctionFamilyId;
  aimDirection: AimDirectionId;
  expression: string;
  path: WorldPoint[];
  impact: ImpactEvent;
  terrain?: TerrainState;
  damage: DamageEvent[];
  eliminations: PlayerId[];
  snapshot: MatchSnapshot;
  lobby?: LobbyRuntimeSnapshot;
};

export type MatchEndedEvent = {
  type: "match-ended";
  guildId?: GuildId;
  roomId: RoomId;
  winnerIds: PlayerId[];
  snapshot: MatchSnapshot;
  lobby?: LobbyRuntimeSnapshot;
};

export type ServerEvent =
  | RoomSnapshotEvent
  | { type: "player-joined"; roomId: RoomId; playerId: PlayerId }
  | { type: "player-left"; roomId: RoomId; playerId: PlayerId }
  | MatchStartedEvent
  | LobbyCancelledEvent
  | { type: "turn-started"; roomId: RoomId; playerId: PlayerId; turnNumber: number }
  | { type: "shot-accepted"; roomId: RoomId; playerId: PlayerId }
  | { type: "shot-rejected"; roomId: RoomId; playerId: PlayerId; reason: string }
  | ShotResolvedEvent
  | { type: "terrain-changed"; roomId: RoomId; terrain: TerrainState }
  | { type: "player-damaged"; roomId: RoomId; damage: DamageEvent }
  | { type: "player-eliminated"; roomId: RoomId; playerId: PlayerId }
  | { type: "turn-advanced"; roomId: RoomId; playerId: PlayerId; turnNumber: number }
  | MatchEndedEvent;
