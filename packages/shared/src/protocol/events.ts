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

export type PlayerForfeitedEvent = {
  type: "player-forfeited";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  snapshot: MatchSnapshot;
  lobby?: LobbyRuntimeSnapshot;
};

export type TurnTimerFields = {
  startedAt?: string;
  deadlineAt?: string;
  durationSeconds?: number;
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

export type FunctionDraftRestoredEvent = {
  type: "function-draft-restored";
  guildId?: GuildId;
  roomId: RoomId;
  playerId: PlayerId;
  expression: string;
  aimDirection: AimDirectionId;
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
  | PlayerForfeitedEvent
  | ({ type: "turn-started"; roomId: RoomId; playerId: PlayerId; turnNumber: number } & TurnTimerFields)
  | { type: "shot-accepted"; roomId: RoomId; playerId: PlayerId }
  | { type: "shot-rejected"; roomId: RoomId; playerId: PlayerId; reason: string }
  | ShotResolvedEvent
  | FunctionDraftRestoredEvent
  | { type: "terrain-changed"; roomId: RoomId; terrain: TerrainState }
  | { type: "player-damaged"; roomId: RoomId; damage: DamageEvent }
  | { type: "player-eliminated"; roomId: RoomId; playerId: PlayerId }
  | ({ type: "turn-advanced"; roomId: RoomId; playerId: PlayerId; turnNumber: number } & TurnTimerFields)
  | MatchEndedEvent;
