import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import {
  createLobbyRequestSchema,
  joinLobbyRequestSchema,
  lobbyJoinResultSchema,
  lobbyRuntimeSnapshotSchema
} from "./schemas";
import { defaultMaxFunctionLength, defaultPlayerColor, playerColorPalette } from "./identity";

type IsOptional<T, K extends keyof T> = Record<string, never> extends Pick<T, K> ? true : false;

describe("lobby schemas", () => {
  it("types parsed create requests with optional map size preset", () => {
    type CreateLobbyOutput = z.output<typeof createLobbyRequestSchema>;

    expectTypeOf<IsOptional<CreateLobbyOutput, "mapSizePreset">>().toEqualTypeOf<true>();
  });

  it("defaults lobby color and max function length for backward-compatible create requests", () => {
    expect(
      createLobbyRequestSchema.parse({
        name: "Team Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
      })
    ).toEqual(
      expect.objectContaining({
        color: defaultPlayerColor,
        mapSizePreset: "standard",
        maxFunctionLength: defaultMaxFunctionLength
      })
    );
  });

  it("keeps valid avatar URLs and drops empty, malformed, or too-long avatar URLs", () => {
    const validAvatarUrl = "https://cdn.discordapp.com/avatars/alice/avatar.png";

    expect(
      createLobbyRequestSchema.parse({
        name: "Team Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        avatarUrl: validAvatarUrl
      })
    ).toEqual(expect.objectContaining({ avatarUrl: validAvatarUrl }));

    expect(
      joinLobbyRequestSchema.parse({
        discordUserId: "bob-id",
        alias: "Bob",
        slot: "player",
        avatarUrl: "not a url"
      })
    ).not.toHaveProperty("avatarUrl");

    expect(
      createLobbyRequestSchema.parse({
        name: "Team Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        avatarUrl: ""
      })
    ).not.toHaveProperty("avatarUrl");

    expect(
      joinLobbyRequestSchema.parse({
        discordUserId: "bob-id",
        alias: "Bob",
        slot: "player",
        avatarUrl: `https://example.com/${"a".repeat(2050)}`
      })
    ).not.toHaveProperty("avatarUrl");
  });

  it("drops map size preset when a custom map id is provided", () => {
    const parsed = createLobbyRequestSchema.parse({
      name: "Custom Map Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      mapId: "map-1"
    });

    expect(parsed).toEqual(expect.objectContaining({ mapId: "map-1" }));
    expect(parsed).not.toHaveProperty("mapSizePreset");
  });

  it("validates fixed player colors and rejects out-of-range max function length", () => {
    expect(
      createLobbyRequestSchema.parse({
        name: "Team Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: playerColorPalette[2],
        maxFunctionLength: 75
      })
    ).toEqual(expect.objectContaining({ color: playerColorPalette[2], maxFunctionLength: 75 }));

    expect(() =>
      createLobbyRequestSchema.parse({
        name: "Team Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: playerColorPalette[2],
        maxFunctionLength: 150
      })
    ).toThrow();

    expect(() =>
      createLobbyRequestSchema.parse({
        name: "Team Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: "#ffffff"
      })
    ).toThrow();
  });

  it("defaults lobby color for join requests", () => {
    expect(
      joinLobbyRequestSchema.parse({
        discordUserId: "bob-id",
        alias: "Bob",
        slot: "player"
      })
    ).toEqual(expect.objectContaining({ color: defaultPlayerColor }));
  });

  it("allows avatar URLs on lobby occupants and join result sessions", () => {
    const avatarUrl = "https://example.com/avatar.png";
    const lobby = {
      guildId: "guild-1",
      roomId: "room-1",
      name: "Team Room",
      mode: "team-versus",
      status: "open",
      leaderDiscordUserId: "alice-id",
      occupants: [
        {
          discordUserId: "alice-id",
          playerId: "alice-player",
          alias: "Alice",
          avatarUrl,
          color: defaultPlayerColor,
          slot: "player",
          placement: "team-a",
          connected: true,
          isLeader: true
        }
      ],
      canStart: false,
      maxFunctionLength: defaultMaxFunctionLength,
      createdAt: "2026-07-05T00:00:00.000Z"
    } as const;

    expect(lobbyRuntimeSnapshotSchema.parse(lobby).occupants[0]).toEqual(expect.objectContaining({ avatarUrl }));
    expect(
      lobbyJoinResultSchema.parse({
        lobby,
        session: {
          guildId: "guild-1",
          roomId: "room-1",
          discordUserId: "alice-id",
          playerId: "alice-player",
          alias: "Alice",
          avatarUrl,
          color: defaultPlayerColor,
          slot: "player",
          sessionToken: "session-token"
        }
      }).session
    ).toEqual(expect.objectContaining({ avatarUrl }));
  });
});
