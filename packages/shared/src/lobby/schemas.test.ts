import { describe, expect, it } from "vitest";
import { createLobbyRequestSchema, joinLobbyRequestSchema } from "./schemas";
import { defaultMaxFunctionLength, defaultPlayerColor, playerColorPalette } from "./identity";

describe("lobby schemas", () => {
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
        maxFunctionLength: defaultMaxFunctionLength
      })
    );
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
});
