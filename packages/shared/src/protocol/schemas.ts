import { z } from "zod";
import { aimDirections } from "../state/types";

export const finiteNumberSchema = z.number().finite();
export const nonNegativeFiniteNumberSchema = finiteNumberSchema.nonnegative();
export const positiveIntegerSchema = z.number().finite().int().positive();
export const aimDirectionSchema = z.enum(aimDirections);

export const pointSchema = z.object({ x: finiteNumberSchema, y: finiteNumberSchema });

export const terrainBlobSchema = z.object({
  id: z.string(),
  outer: z.array(pointSchema),
  holes: z.array(z.array(pointSchema))
});

export const terrainStateSchema = z.object({ blobs: z.array(terrainBlobSchema) });

export const matchSnapshotSchema = z.object({
  phase: z.enum(["lobby", "playing", "ended"]),
  mode: z.enum(["team-versus", "free-for-all"]),
  players: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      teamId: z.string(),
      position: pointSchema,
      hp: nonNegativeFiniteNumberSchema,
      alive: z.boolean()
    })
  ),
  teams: z.array(z.object({ id: z.string(), playerIds: z.array(z.string()) })),
  terrain: terrainStateSchema,
  turn: z.object({ activePlayerId: z.string(), order: z.array(z.string()), turnNumber: positiveIntegerSchema })
});

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join-room"), roomId: z.string(), playerId: z.string(), displayName: z.string() }),
  z.object({
    type: z.literal("select-mode"),
    roomId: z.string(),
    playerId: z.string(),
    mode: z.enum(["team-versus", "free-for-all"])
  }),
  z.object({ type: z.literal("set-team"), roomId: z.string(), playerId: z.string(), teamId: z.string() }),
  z.object({ type: z.literal("start-match"), roomId: z.string(), playerId: z.string() }),
  z.object({
    type: z.literal("submit-shot"),
    roomId: z.string(),
    playerId: z.string(),
    functionFamilyId: z.literal("normal"),
    aimDirection: aimDirectionSchema,
    expression: z.string().min(1)
  }),
  z.object({
    type: z.literal("send-chat"),
    roomId: z.string(),
    playerId: z.string(),
    message: z.string().min(1).max(500)
  }),
  z.object({ type: z.literal("request-rematch"), roomId: z.string(), playerId: z.string() })
]);

export const serverEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room-snapshot"), roomId: z.string(), snapshot: matchSnapshotSchema }),
  z.object({ type: z.literal("player-joined"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("player-left"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("match-started"), roomId: z.string(), snapshot: matchSnapshotSchema }),
  z.object({ type: z.literal("turn-started"), roomId: z.string(), playerId: z.string(), turnNumber: positiveIntegerSchema }),
  z.object({ type: z.literal("shot-accepted"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("shot-rejected"), roomId: z.string(), playerId: z.string(), reason: z.string() }),
  z.object({
    type: z.literal("shot-resolved"),
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
    snapshot: matchSnapshotSchema
  }),
  z.object({ type: z.literal("terrain-changed"), roomId: z.string(), terrain: terrainStateSchema }),
  z.object({
    type: z.literal("player-damaged"),
    roomId: z.string(),
    damage: z.object({ playerId: z.string(), amount: nonNegativeFiniteNumberSchema, hpAfter: nonNegativeFiniteNumberSchema })
  }),
  z.object({ type: z.literal("player-eliminated"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("turn-advanced"), roomId: z.string(), playerId: z.string(), turnNumber: positiveIntegerSchema }),
  z.object({ type: z.literal("match-ended"), roomId: z.string(), winnerIds: z.array(z.string()), snapshot: matchSnapshotSchema })
]);
