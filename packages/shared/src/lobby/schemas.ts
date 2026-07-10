import { z } from "zod";
import type { MapSizePresetId } from "../maps/types";
import { defaultMapSizePreset, mapSizePresetSchema } from "../maps/worldBounds";
import type { MatchModeId } from "../state/types";
import {
  craterRadiusBounds,
  damagePerHitBounds,
  defaultAdvancedFunctions,
  defaultFunctionHistory,
  defaultFunctionPreview,
  defaultFriendlyFire,
  defaultInputMode,
  defaultTurnDurationSeconds,
  defaultTurnTimerEnabled,
  defaultUniqueFunctionHits,
  inputModes,
  turnDurationSecondsBounds
} from "./gameplaySettings";
import type { LobbyGameplaySettings } from "./gameplaySettings";
import { defaultMaxFunctionLength, defaultPlayerColor, functionLengthBounds, playerColorPalette } from "./identity";
import type { PlayerColor } from "./identity";
import type { CreateLobbyRequest, LobbySlot } from "./types";

export const lobbyStatusSchema = z.enum(["open", "playing", "ended"]);
export const lobbySlotSchema = z.enum(["player", "spectator"]);
export const lobbyPlacementSchema = z.enum(["team-a", "team-b", "players", "spectator"]);
export const matchModeSchema = z.enum(["team-versus", "free-for-all"]);
export const playerColorSchema = z.enum(playerColorPalette);
export const avatarUrlMaxLength = 2048;

function isHttpAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const avatarUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(avatarUrlMaxLength)
  .refine(isHttpAvatarUrl, "Invalid avatar URL")
  .optional();

export const avatarUrlInputSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > avatarUrlMaxLength || !isHttpAvatarUrl(trimmed)) {
    return undefined;
  }

  return trimmed;
}, avatarUrlSchema);

function dropUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

type ParsedCreateLobbyRequest = Omit<
  CreateLobbyRequest,
  | "color"
  | "maxFunctionLength"
  | "damagePerHit"
  | "craterRadius"
  | "uniqueFunctionHits"
  | "friendlyFire"
  | "advancedFunctions"
  | "functionPreview"
  | "functionHistory"
  | "turnTimerEnabled"
  | "turnDurationSeconds"
  | "inputMode"
> &
  LobbyGameplaySettings & {
  color: PlayerColor;
  mode: MatchModeId;
  initialSlot: LobbySlot;
  maxFunctionLength: number;
  mapSizePreset?: MapSizePresetId;
};

function normalizeCreateLobbyRequest<T extends Record<string, unknown>>(value: T): ParsedCreateLobbyRequest {
  const normalized = dropUndefinedProperties(value);
  if (normalized.mapId !== undefined) {
    delete normalized.mapSizePreset;
  }
  return normalized as unknown as ParsedCreateLobbyRequest;
}

export const maxFunctionLengthSchema = z.preprocess((value) => {
  if (value === undefined) {
    return defaultMaxFunctionLength;
  }

  return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
}, z.number().int().min(functionLengthBounds.min).max(functionLengthBounds.max));

export const damagePerHitSchema = z.preprocess((value) => {
  if (value === undefined) {
    return damagePerHitBounds.default;
  }

  return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
}, z.number().int().min(damagePerHitBounds.min).max(damagePerHitBounds.max));

export const craterRadiusSchema = z.preprocess((value) => {
  if (value === undefined) {
    return craterRadiusBounds.default;
  }

  return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
}, z.number().finite().min(craterRadiusBounds.min).max(craterRadiusBounds.max));

export const turnDurationSecondsSchema = z.preprocess((value) => {
  if (value === undefined) {
    return defaultTurnDurationSeconds;
  }

  return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
}, z.number().int().min(turnDurationSecondsBounds.min).max(turnDurationSecondsBounds.max));

export const inputModeSchema = z.enum(inputModes).default(defaultInputMode);

export const guildSettingsSchema = z.object({
  guildId: z.string().min(1),
  defaultMode: matchModeSchema,
  allowSpectators: z.boolean()
});

export const playerStatsEntrySchema = z.object({
  guildId: z.string().min(1),
  discordUserId: z.string().min(1),
  lastAlias: z.string().min(1),
  gamesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  eliminations: z.number().int().nonnegative(),
  damageDealt: z.number().finite().nonnegative(),
  updatedAt: z.string().datetime()
});

export const createLobbyRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  leaderDiscordUserId: z.string().trim().min(1),
  alias: z.string().trim().min(1).max(24),
  avatarUrl: avatarUrlInputSchema,
  color: playerColorSchema.default(defaultPlayerColor),
  mode: matchModeSchema,
  initialSlot: lobbySlotSchema,
  maxFunctionLength: maxFunctionLengthSchema,
  damagePerHit: damagePerHitSchema,
  craterRadius: craterRadiusSchema,
  uniqueFunctionHits: z.boolean().default(defaultUniqueFunctionHits),
  friendlyFire: z.boolean().default(defaultFriendlyFire),
  advancedFunctions: z.boolean().default(defaultAdvancedFunctions),
  functionPreview: z.boolean().default(defaultFunctionPreview),
  functionHistory: z.boolean().default(defaultFunctionHistory),
  turnTimerEnabled: z.boolean().default(defaultTurnTimerEnabled),
  turnDurationSeconds: turnDurationSecondsSchema,
  inputMode: inputModeSchema,
  mapSizePreset: mapSizePresetSchema.default(defaultMapSizePreset),
  mapId: z.string().trim().min(1).optional()
}).transform(normalizeCreateLobbyRequest);

export const joinLobbyRequestSchema = z.object({
  discordUserId: z.string().trim().min(1),
  alias: z.string().trim().min(1).max(24),
  avatarUrl: avatarUrlInputSchema,
  color: playerColorSchema.default(defaultPlayerColor),
  slot: lobbySlotSchema
}).transform(dropUndefinedProperties);

export const setLobbyPlacementRequestSchema = z.object({
  actorDiscordUserId: z.string().trim().min(1),
  targetDiscordUserId: z.string().trim().min(1),
  placement: lobbyPlacementSchema
});

export const autoAssignTeamsRequestSchema = z.object({
  actorDiscordUserId: z.string().trim().min(1)
});

export const lobbyOccupantSchema = z.object({
  discordUserId: z.string().min(1),
  playerId: z.string().min(1),
  alias: z.string().min(1),
  avatarUrl: avatarUrlSchema,
  color: playerColorSchema,
  slot: lobbySlotSchema,
  placement: lobbyPlacementSchema,
  connected: z.boolean(),
  isLeader: z.boolean()
}).transform(dropUndefinedProperties);

export const lobbyRuntimeSnapshotSchema = z.object({
  guildId: z.string().min(1),
  roomId: z.string().min(1),
  name: z.string().min(1),
  mode: matchModeSchema,
  status: lobbyStatusSchema,
  leaderDiscordUserId: z.string().min(1),
  occupants: z.array(lobbyOccupantSchema),
  canStart: z.boolean(),
  startBlockedReason: z.string().optional(),
  maxFunctionLength: maxFunctionLengthSchema,
  damagePerHit: damagePerHitSchema,
  craterRadius: craterRadiusSchema,
  uniqueFunctionHits: z.boolean().default(defaultUniqueFunctionHits),
  friendlyFire: z.boolean().default(defaultFriendlyFire),
  advancedFunctions: z.boolean().default(defaultAdvancedFunctions),
  functionPreview: z.boolean().default(defaultFunctionPreview),
  functionHistory: z.boolean().default(defaultFunctionHistory),
  turnTimerEnabled: z.boolean().default(defaultTurnTimerEnabled),
  turnDurationSeconds: turnDurationSecondsSchema,
  inputMode: inputModeSchema,
  mapSizePreset: mapSizePresetSchema.optional(),
  mapId: z.string().min(1).optional(),
  mapName: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional()
});

export const lobbySummarySchema = z.object({
  guildId: z.string().min(1),
  roomId: z.string().min(1),
  name: z.string().min(1),
  mode: matchModeSchema,
  status: lobbyStatusSchema,
  leaderAlias: z.string().min(1),
  leaderDiscordUserId: z.string().min(1),
  playerCount: z.number().int().nonnegative(),
  spectatorCount: z.number().int().nonnegative(),
  damagePerHit: damagePerHitSchema,
  craterRadius: craterRadiusSchema,
  uniqueFunctionHits: z.boolean().default(defaultUniqueFunctionHits),
  friendlyFire: z.boolean().default(defaultFriendlyFire),
  advancedFunctions: z.boolean().default(defaultAdvancedFunctions),
  functionPreview: z.boolean().default(defaultFunctionPreview),
  functionHistory: z.boolean().default(defaultFunctionHistory),
  turnTimerEnabled: z.boolean().default(defaultTurnTimerEnabled),
  turnDurationSeconds: turnDurationSecondsSchema,
  inputMode: inputModeSchema,
  mapSizePreset: mapSizePresetSchema.optional(),
  mapId: z.string().min(1).optional(),
  mapName: z.string().min(1).optional(),
  createdAt: z.string().datetime()
});

export const lobbyJoinResultSchema = z.object({
  lobby: lobbyRuntimeSnapshotSchema,
  session: z.object({
    guildId: z.string().min(1),
    roomId: z.string().min(1),
    discordUserId: z.string().min(1),
    playerId: z.string().min(1),
    alias: z.string().min(1),
    avatarUrl: avatarUrlSchema,
    color: playerColorSchema,
    slot: lobbySlotSchema,
    sessionToken: z.string().min(1)
  }).transform(dropUndefinedProperties)
});
