import type { PersistedCustomMap } from "../maps/types";
import type { MapSizePresetId } from "../maps/worldBounds";
import type { MatchModeId, PlayerId, RoomId } from "../state/types";
import type { LobbyGameplaySettings } from "./gameplaySettings";
import type { PlayerColor } from "./identity";

export type GuildId = string;
export type DiscordUserId = string;
export type LobbyStatus = "open" | "playing" | "ended";
export type LobbySlot = "player" | "spectator";
export type LobbyPlacementId = "team-a" | "team-b" | "players" | "spectator";

export type GuildSettings = {
  guildId: GuildId;
  defaultMode: MatchModeId;
  allowSpectators: boolean;
};

export type PlayerStatsEntry = {
  guildId: GuildId;
  discordUserId: DiscordUserId;
  lastAlias: string;
  gamesPlayed: number;
  wins: number;
  eliminations: number;
  damageDealt: number;
  updatedAt: string;
};

export type PersistedServerState = {
  guilds: Record<
    GuildId,
    {
      settings: GuildSettings;
      leaderboard: Record<DiscordUserId, PlayerStatsEntry>;
      customMaps: Record<string, PersistedCustomMap>;
    }
  >;
};

export type LobbyOccupant = {
  discordUserId: DiscordUserId;
  playerId: PlayerId;
  alias: string;
  avatarUrl?: string;
  color: PlayerColor;
  slot: LobbySlot;
  placement: LobbyPlacementId;
  connected: boolean;
  isLeader: boolean;
};

export type LobbyRuntimeSnapshot = {
  guildId: GuildId;
  roomId: RoomId;
  name: string;
  mode: MatchModeId;
  status: LobbyStatus;
  leaderDiscordUserId: DiscordUserId;
  occupants: LobbyOccupant[];
  canStart: boolean;
  startBlockedReason?: string;
  maxFunctionLength: number;
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  mapSizePreset?: MapSizePresetId;
  mapId?: string;
  mapName?: string;
  createdAt: string;
  startedAt?: string;
};

export type LobbySummary = {
  guildId: GuildId;
  roomId: RoomId;
  name: string;
  mode: MatchModeId;
  status: LobbyStatus;
  leaderAlias: string;
  leaderDiscordUserId: DiscordUserId;
  playerCount: number;
  spectatorCount: number;
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  mapSizePreset?: MapSizePresetId;
  mapId?: string;
  mapName?: string;
  createdAt: string;
};

export type CreateLobbyRequest = {
  name: string;
  leaderDiscordUserId: DiscordUserId;
  alias: string;
  avatarUrl?: string;
  color?: PlayerColor;
  mode: MatchModeId;
  initialSlot: LobbySlot;
  maxFunctionLength?: number;
  damagePerHit?: number;
  uniqueFunctionHits?: boolean;
  friendlyFire?: boolean;
  mapSizePreset?: MapSizePresetId;
  mapId?: string;
};

export type LobbyGameplaySettingsSnapshot = LobbyGameplaySettings;

export type JoinLobbyRequest = {
  discordUserId: DiscordUserId;
  alias: string;
  avatarUrl?: string;
  color?: PlayerColor;
  slot: LobbySlot;
};

export type LobbyJoinResult = {
  lobby: LobbyRuntimeSnapshot;
  session: {
    guildId: GuildId;
    roomId: RoomId;
    discordUserId: DiscordUserId;
    playerId: PlayerId;
    alias: string;
    avatarUrl?: string;
    color: PlayerColor;
    slot: LobbySlot;
    sessionToken: string;
  };
};

export type SetLobbyPlacementRequest = {
  actorDiscordUserId: DiscordUserId;
  targetDiscordUserId: DiscordUserId;
  placement: LobbyPlacementId;
};

export type AutoAssignTeamsRequest = {
  actorDiscordUserId: DiscordUserId;
};

export type LobbyHttpError = {
  error: string;
  code:
    | "alias-empty"
    | "alias-taken"
    | "forbidden"
    | "not-found"
    | "invalid-lobby"
    | "invalid-map"
    | "invalid-settings";
};
