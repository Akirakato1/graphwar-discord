import type { PersistedCustomMap } from "../maps/types";
import type { MatchModeId, PlayerId, RoomId } from "../state/types";

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
      customMaps?: Record<string, PersistedCustomMap>;
    }
  >;
};

export type LobbyOccupant = {
  discordUserId: DiscordUserId;
  playerId: PlayerId;
  alias: string;
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
  mapId?: string;
  mapName?: string;
  createdAt: string;
};

export type CreateLobbyRequest = {
  name: string;
  leaderDiscordUserId: DiscordUserId;
  alias: string;
  mode: MatchModeId;
  initialSlot: LobbySlot;
  mapId?: string;
};

export type JoinLobbyRequest = {
  discordUserId: DiscordUserId;
  alias: string;
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
