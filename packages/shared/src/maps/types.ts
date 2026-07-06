import type { TerrainState, WorldPoint } from "../geometry/types";
import type { DiscordUserId, GuildId } from "../lobby/types";
import type { WorldBounds } from "./worldBounds";
export type { MapSizePreset, MapSizePresetId, WorldBounds } from "./worldBounds";

export type CustomMapFormat = "graphwar-map";
export type CustomMapVersion = 1;

export type CustomMapWorldBounds = WorldBounds;

export type CustomMapSpawnPoint = {
  id: string;
  position: WorldPoint;
};

export type CustomMapTeamId = "team-a" | "team-b";

export type CustomMapTeamSpawnPointIds = Record<CustomMapTeamId, string[]>;

export type CustomMapImport = {
  format: CustomMapFormat;
  version: CustomMapVersion;
  name: string;
  worldBounds?: CustomMapWorldBounds;
  terrain: TerrainState;
  spawnPoints: CustomMapSpawnPoint[];
  teamSpawnPointIds: CustomMapTeamSpawnPointIds;
};

export type PersistedCustomMap = CustomMapImport & {
  id: string;
  guildId: GuildId;
  ownerDiscordUserId: DiscordUserId;
  createdAt: string;
  updatedAt: string;
};

export type SaveCustomMapRequest = {
  ownerDiscordUserId: DiscordUserId;
  map: CustomMapImport;
};

export type CustomMapSummary = {
  id: string;
  guildId: GuildId;
  ownerDiscordUserId: DiscordUserId;
  name: string;
  createdAt: string;
  updatedAt: string;
};
