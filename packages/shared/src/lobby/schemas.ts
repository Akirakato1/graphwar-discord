import { z } from "zod";
import { defaultMaxFunctionLength, defaultPlayerColor, functionLengthBounds, playerColorPalette } from "./identity";

export const lobbyStatusSchema = z.enum(["open", "playing", "ended"]);
export const lobbySlotSchema = z.enum(["player", "spectator"]);
export const lobbyPlacementSchema = z.enum(["team-a", "team-b", "players", "spectator"]);
export const matchModeSchema = z.enum(["team-versus", "free-for-all"]);
export const playerColorSchema = z.enum(playerColorPalette);
export const maxFunctionLengthSchema = z.preprocess((value) => {
  if (value === undefined) {
    return defaultMaxFunctionLength;
  }

  return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
}, z.number().int().min(functionLengthBounds.min).max(functionLengthBounds.max));

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
  color: playerColorSchema.default(defaultPlayerColor),
  mode: matchModeSchema,
  initialSlot: lobbySlotSchema,
  maxFunctionLength: maxFunctionLengthSchema,
  mapId: z.string().trim().min(1).optional()
});

export const joinLobbyRequestSchema = z.object({
  discordUserId: z.string().trim().min(1),
  alias: z.string().trim().min(1).max(24),
  color: playerColorSchema.default(defaultPlayerColor),
  slot: lobbySlotSchema
});

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
  color: playerColorSchema,
  slot: lobbySlotSchema,
  placement: lobbyPlacementSchema,
  connected: z.boolean(),
  isLeader: z.boolean()
});

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
    color: playerColorSchema,
    slot: lobbySlotSchema,
    sessionToken: z.string().min(1)
  })
});
