import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import {
  clientCommandSchema,
  autoAssignTeamsRequestSchema,
  createLobbyRequestSchema,
  joinLobbyRequestSchema,
  lobbyRuntimeSnapshotSchema,
  matchSnapshotSchema,
  defaultMaxFunctionLength,
  defaultLobbyGameplaySettings,
  defaultPlayerColor,
  serverEventSchema,
  setLobbyPlacementRequestSchema,
  type ClientCommand,
  type ServerEvent
} from "@graphwar/shared";

describe("protocol schemas", () => {
  const standardWorldBounds = { minX: -25, maxX: 25, minY: -15, maxY: 15 };

  it("keeps client command schema output aligned with ClientCommand", () => {
    expectTypeOf<z.infer<typeof clientCommandSchema>>().toEqualTypeOf<ClientCommand>();
  });

  it("keeps server event schema output aligned with ServerEvent", () => {
    expectTypeOf<z.infer<typeof serverEventSchema>>().toEqualTypeOf<ServerEvent>();
  });

  it("accepts a valid submit-shot command", () => {
    const parsed = clientCommandSchema.parse({
      type: "submit-shot",
      roomId: "local-test",
      playerId: "alice",
      functionFamilyId: "normal",
      aimDirection: "west",
      expression: "sin(x)"
    });

    expect(parsed.type).toBe("submit-shot");
    expect(parsed).toMatchObject({ aimDirection: "west" });
  });

  it("accepts a forfeit-match command", () => {
    const command = {
      type: "forfeit-match",
      guildId: "local-guild",
      roomId: "local-test",
      playerId: "alice",
      sessionToken: "session-token"
    } satisfies ClientCommand;

    expect(clientCommandSchema.parse(command)).toEqual(command);
  });

  it("rejects a submit-shot command without expression", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal",
        aimDirection: "west"
      })
    ).toThrow();
  });

  it("rejects a submit-shot command without aim direction", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal",
        expression: "sin(x)"
      })
    ).toThrow();
  });

  it("accepts a shot-resolved event with a path and snapshot", () => {
    const parsed = serverEventSchema.parse({
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "west",
      expression: "x",
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot: {
        phase: "playing",
        mode: "team-versus",
        worldBounds: standardWorldBounds,
        players: [],
        teams: [],
        terrain: { blobs: [] },
        turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
      }
    });

    expect(parsed.type).toBe("shot-resolved");
    expect(parsed).toMatchObject({ aimDirection: "west" });
  });

  it("accepts a player-forfeited event with an authoritative snapshot", () => {
    const event = {
      type: "player-forfeited",
      guildId: "local-guild",
      roomId: "local-test",
      playerId: "alice",
      snapshot: {
        phase: "playing",
        mode: "team-versus",
        worldBounds: standardWorldBounds,
        players: [{ id: "alice", displayName: "Alice", teamId: "team-a", position: { x: 0, y: 0 }, hp: 0, alive: false }],
        teams: [{ id: "team-a", playerIds: ["alice"] }],
        terrain: { blobs: [] },
        turn: { activePlayerId: "", order: ["alice"], turnNumber: 2 }
      }
    } satisfies ServerEvent;

    expect(serverEventSchema.parse(event)).toEqual(event);
  });

  it("rejects a shot-resolved event without aim direction", () => {
    expect(() =>
      serverEventSchema.parse({
        type: "shot-resolved",
        roomId: "local-test",
        shooterId: "alice",
        functionFamilyId: "normal",
        expression: "x",
        path: [{ x: 0, y: 0 }],
        impact: { reason: "miss" },
        damage: [],
        eliminations: [],
        snapshot: {
          phase: "playing",
          mode: "team-versus",
          worldBounds: standardWorldBounds,
          players: [],
          teams: [],
          terrain: { blobs: [] },
          turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
        }
      })
    ).toThrow();
  });

  it("rejects non-finite point data", () => {
    expect(() =>
      serverEventSchema.parse({
        type: "shot-resolved",
        roomId: "local-test",
        shooterId: "alice",
        functionFamilyId: "normal",
        aimDirection: "east",
        expression: "x",
        path: [{ x: Number.POSITIVE_INFINITY, y: 0 }],
        impact: { reason: "miss" },
        damage: [],
        eliminations: [],
        snapshot: {
          phase: "playing",
          mode: "team-versus",
          worldBounds: standardWorldBounds,
          players: [],
          teams: [],
          terrain: { blobs: [] },
          turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
        }
      })
    ).toThrow();
  });

  it("rejects invalid impact reasons", () => {
    expect(() =>
      serverEventSchema.parse({
        type: "shot-resolved",
        roomId: "local-test",
        shooterId: "alice",
        functionFamilyId: "normal",
        aimDirection: "east",
        expression: "x",
        path: [{ x: 0, y: 0 }],
        impact: { reason: "near-miss" },
        damage: [],
        eliminations: [],
        snapshot: {
          phase: "playing",
          mode: "team-versus",
          worldBounds: standardWorldBounds,
          players: [],
          teams: [],
          terrain: { blobs: [] },
          turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
        }
      })
    ).toThrow();
  });

  it("rejects invalid function family ids", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "parametric",
        aimDirection: "west",
        expression: "sin(x)"
      })
    ).toThrow();
  });

  it("accepts legacy and guild-scoped set-team commands", () => {
    const legacyCommand: ClientCommand = {
      type: "set-team",
      roomId: "local-test",
      playerId: "alice",
      teamId: "team-a"
    };

    expect(clientCommandSchema.parse(legacyCommand)).toEqual(legacyCommand);

    const lobbyCommand: ClientCommand = {
      type: "set-team",
      guildId: "local-guild",
      roomId: "room-1",
      playerId: "alice-id",
      targetPlayerId: "bob-id",
      placement: "team-b"
    };

    expect(clientCommandSchema.parse(lobbyCommand)).toEqual(lobbyCommand);
  });

  it("accepts auto-assign-teams commands", () => {
    const command: ClientCommand = {
      type: "auto-assign-teams",
      guildId: "local-guild",
      roomId: "room-1",
      playerId: "alice-id"
    };

    expect(clientCommandSchema.parse(command)).toEqual(command);
  });

  it("validates create and join lobby HTTP payloads", () => {
    expect(
      createLobbyRequestSchema.parse({
        name: "Friday Graphwar",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
      })
    ).toMatchObject({ name: "Friday Graphwar", alias: "Alice" });

    expect(
      joinLobbyRequestSchema.parse({
        discordUserId: "bob-id",
        alias: "Bob",
        slot: "spectator"
      })
    ).toMatchObject({ discordUserId: "bob-id", slot: "spectator" });
  });

  it("validates lobby placement and auto-assign HTTP payloads", () => {
    expect(
      setLobbyPlacementRequestSchema.parse({
        actorDiscordUserId: "alice-id",
        targetDiscordUserId: "bob-id",
        placement: "spectator"
      })
    ).toMatchObject({ actorDiscordUserId: "alice-id", placement: "spectator" });

    expect(autoAssignTeamsRequestSchema.parse({ actorDiscordUserId: "alice-id" })).toEqual({
      actorDiscordUserId: "alice-id"
    });
  });

  it("validates guild-scoped lobby command and snapshot events", () => {
    const joinCommand: ClientCommand = {
      type: "join-room",
      guildId: "local-guild",
      roomId: "room-1",
      playerId: "alice-id",
      discordUserId: "alice-id",
      alias: "Alice",
      avatarUrl: "https://example.com/alice.png",
      displayName: "Alice",
      slot: "player"
    };

    expect(clientCommandSchema.parse(joinCommand)).toEqual(joinCommand);
    expect(
      clientCommandSchema.parse({
        type: "cancel-lobby",
        guildId: "local-guild",
        roomId: "room-1",
        playerId: "alice-id",
        sessionToken: "session-token"
      } satisfies ClientCommand)
    ).toEqual({
      type: "cancel-lobby",
      guildId: "local-guild",
      roomId: "room-1",
      playerId: "alice-id",
      sessionToken: "session-token"
    });

    expect(
      clientCommandSchema.parse({
        ...joinCommand,
        avatarUrl: "not a url"
      })
    ).not.toHaveProperty("avatarUrl");

    const snapshot = {
      phase: "lobby" as const,
      mode: "team-versus" as const,
      worldBounds: standardWorldBounds,
      players: [],
      teams: [],
      terrain: { blobs: [] },
      turn: { activePlayerId: "alice-id", order: ["alice-id"], turnNumber: 1 }
    };

    const event: ServerEvent = {
      type: "room-snapshot",
      guildId: "local-guild",
      roomId: "room-1",
      lobby: {
        guildId: "local-guild",
        roomId: "room-1",
        name: "Friday Graphwar",
        mode: "team-versus",
        status: "open",
        leaderDiscordUserId: "alice-id",
        occupants: [
          {
            discordUserId: "alice-id",
            playerId: "alice-id",
            alias: "Alice",
            color: defaultPlayerColor,
            slot: "player",
            placement: "team-a",
            connected: true,
            isLeader: true
          }
        ],
        canStart: false,
        startBlockedReason: "Team B needs at least one player.",
        maxFunctionLength: defaultMaxFunctionLength,
        ...defaultLobbyGameplaySettings,
        createdAt: "2026-07-05T00:00:00.000Z"
      },
      snapshot
    };

    expect(serverEventSchema.parse(event)).toEqual(event);
    expect(lobbyRuntimeSnapshotSchema.parse(event.lobby)).toEqual(event.lobby);
    expect(
      serverEventSchema.parse({
        type: "lobby-cancelled",
        guildId: "local-guild",
        roomId: "room-1",
        lobby: { ...event.lobby!, status: "ended", canStart: false, startBlockedReason: "Lobby has ended." }
      } satisfies ServerEvent)
    ).toEqual({
      type: "lobby-cancelled",
      guildId: "local-guild",
      roomId: "room-1",
      lobby: { ...event.lobby!, status: "ended", canStart: false, startBlockedReason: "Lobby has ended." }
    });
  });

  it("keeps world bounds and player avatar URLs on match snapshots", () => {
    const parsed = matchSnapshotSchema.parse({
      phase: "playing",
      mode: "team-versus",
      worldBounds: standardWorldBounds,
      players: [
        {
          id: "alice",
          displayName: "Alice",
          avatarUrl: "https://example.com/alice.png",
          teamId: "team-a",
          position: { x: 0, y: 0 },
          hp: 100,
          alive: true
        }
      ],
      teams: [{ id: "team-a", playerIds: ["alice"] }],
      terrain: { blobs: [] },
      turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
    });

    expect(parsed.worldBounds).toEqual(standardWorldBounds);
    expect(parsed.players[0]).toEqual(expect.objectContaining({ avatarUrl: "https://example.com/alice.png" }));
  });

  it("requires world bounds on match snapshots", () => {
    expect(() =>
      matchSnapshotSchema.parse({
        phase: "playing",
        mode: "team-versus",
        players: [],
        teams: [],
        terrain: { blobs: [] },
        turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
      })
    ).toThrow();
  });

  it("rejects malformed player avatar URLs in match snapshots", () => {
    expect(() =>
      matchSnapshotSchema.parse({
        phase: "playing",
        mode: "team-versus",
        worldBounds: standardWorldBounds,
        players: [
          {
            id: "alice",
            displayName: "Alice",
            avatarUrl: "not a url",
            teamId: "team-a",
            position: { x: 0, y: 0 },
            hp: 100,
            alive: true
          }
        ],
        teams: [{ id: "team-a", playerIds: ["alice"] }],
        terrain: { blobs: [] },
        turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
      })
    ).toThrow();
  });
});
