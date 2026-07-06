import { z } from "zod";
import {
  lobbyPlacementSchema,
  lobbyRuntimeSnapshotSchema,
  lobbySlotSchema,
  matchModeSchema,
  playerColorSchema,
  avatarUrlInputSchema,
  avatarUrlSchema
} from "../lobby/schemas";
import { worldBoundsSchema } from "../maps/worldBounds";
import { aimDirections } from "../state/types";

export const finiteNumberSchema = z.number().finite();
export const nonNegativeFiniteNumberSchema = finiteNumberSchema.nonnegative();
export const positiveIntegerSchema = z.number().finite().int().positive();
export const aimDirectionSchema = z.enum(aimDirections);
const optionalGuildIdSchema = z.string().min(1).optional();
const optionalSessionTokenSchema = z.string().min(1).optional();

function dropUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

export const pointSchema = z.object({ x: finiteNumberSchema, y: finiteNumberSchema });

export const terrainBlobSchema = z.object({
  id: z.string(),
  outer: z.array(pointSchema),
  holes: z.array(z.array(pointSchema))
});

export const terrainStateSchema = z.object({ blobs: z.array(terrainBlobSchema) });

export const matchSnapshotSchema = z.object({
  phase: z.enum(["lobby", "playing", "ended"]),
  mode: matchModeSchema,
  worldBounds: worldBoundsSchema,
  players: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      avatarUrl: avatarUrlSchema,
      color: playerColorSchema.optional(),
      teamId: z.string(),
      position: pointSchema,
      hp: nonNegativeFiniteNumberSchema,
      alive: z.boolean()
    }).transform(
      (player) => Object.fromEntries(Object.entries(player).filter(([, value]) => value !== undefined)) as typeof player
    )
  ),
  teams: z.array(z.object({ id: z.string(), playerIds: z.array(z.string()) })),
  terrain: terrainStateSchema,
  turn: z.object({ activePlayerId: z.string(), order: z.array(z.string()), turnNumber: positiveIntegerSchema })
});

const clientCommandUnionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join-room"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    discordUserId: z.string().optional(),
    alias: z.string().optional(),
    avatarUrl: avatarUrlInputSchema,
    displayName: z.string(),
    slot: lobbySlotSchema.optional(),
    sessionToken: optionalSessionTokenSchema
  }),
  z.object({
    type: z.literal("select-mode"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    mode: matchModeSchema,
    sessionToken: optionalSessionTokenSchema
  }),
  z.object({
    type: z.literal("set-team"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    targetPlayerId: z.string().optional(),
    placement: lobbyPlacementSchema.optional(),
    teamId: z.string().optional(),
    sessionToken: optionalSessionTokenSchema
  }),
  z.object({
    type: z.literal("auto-assign-teams"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    sessionToken: optionalSessionTokenSchema
  }),
  z.object({
    type: z.literal("start-match"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    sessionToken: optionalSessionTokenSchema
  }),
  z.object({
    type: z.literal("submit-shot"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    functionFamilyId: z.literal("normal"),
    aimDirection: aimDirectionSchema,
    expression: z.string().min(1),
    sessionToken: optionalSessionTokenSchema
  }),
  z.object({
    type: z.literal("send-chat"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    message: z.string().min(1).max(500),
    sessionToken: optionalSessionTokenSchema
  }),
  z.object({
    type: z.literal("request-rematch"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    playerId: z.string(),
    sessionToken: optionalSessionTokenSchema
  })
]);

export const clientCommandSchema = clientCommandUnionSchema
  .superRefine((command, context) => {
    if (command.type !== "set-team") {
      return;
    }

    if (command.teamId || (command.targetPlayerId && command.placement)) {
      return;
    }

    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "set-team requires either teamId or targetPlayerId and placement"
    });
  })
  .transform((command) => {
    return dropUndefinedProperties(command);
  });

export const serverEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("room-snapshot"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    snapshot: matchSnapshotSchema,
    lobby: lobbyRuntimeSnapshotSchema.optional()
  }),
  z.object({ type: z.literal("player-joined"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("player-left"), roomId: z.string(), playerId: z.string() }),
  z.object({
    type: z.literal("match-started"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    snapshot: matchSnapshotSchema,
    lobby: lobbyRuntimeSnapshotSchema.optional()
  }),
  z.object({ type: z.literal("turn-started"), roomId: z.string(), playerId: z.string(), turnNumber: positiveIntegerSchema }),
  z.object({ type: z.literal("shot-accepted"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("shot-rejected"), roomId: z.string(), playerId: z.string(), reason: z.string() }),
  z.object({
    type: z.literal("shot-resolved"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    shooterId: z.string(),
    functionFamilyId: z.literal("normal"),
    aimDirection: aimDirectionSchema,
    expression: z.string(),
    path: z.array(pointSchema),
    impact: z.object({
      reason: z.enum(["terrain-hit", "player-hit", "undefined-function", "path-too-long", "field-boundary", "miss"]),
      point: pointSchema.optional(),
      targetPlayerId: z.string().optional()
    }),
    terrain: terrainStateSchema.optional(),
    damage: z.array(
      z.object({ playerId: z.string(), amount: nonNegativeFiniteNumberSchema, hpAfter: nonNegativeFiniteNumberSchema })
    ),
    eliminations: z.array(z.string()),
    snapshot: matchSnapshotSchema,
    lobby: lobbyRuntimeSnapshotSchema.optional()
  }),
  z.object({ type: z.literal("terrain-changed"), roomId: z.string(), terrain: terrainStateSchema }),
  z.object({
    type: z.literal("player-damaged"),
    roomId: z.string(),
    damage: z.object({ playerId: z.string(), amount: nonNegativeFiniteNumberSchema, hpAfter: nonNegativeFiniteNumberSchema })
  }),
  z.object({ type: z.literal("player-eliminated"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("turn-advanced"), roomId: z.string(), playerId: z.string(), turnNumber: positiveIntegerSchema }),
  z.object({
    type: z.literal("match-ended"),
    guildId: optionalGuildIdSchema,
    roomId: z.string(),
    winnerIds: z.array(z.string()),
    snapshot: matchSnapshotSchema,
    lobby: lobbyRuntimeSnapshotSchema.optional()
  })
]);
