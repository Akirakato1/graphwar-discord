import { describe, expect, it } from "vitest";
import { LobbyDirectory } from "./LobbyDirectory";

function createDirectory(): LobbyDirectory {
  return new LobbyDirectory({
    now: () => new Date("2026-07-05T00:00:00.000Z"),
    createRoomId: () => "room-1",
    upsertStatsEntry: async () => undefined
  });
}

describe("LobbyDirectory", () => {
  it("creates a lobby with the creator as leader", async () => {
    const directory = createDirectory();

    const result = await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    expect(result.session).toEqual({
      guildId: "guild-1",
      roomId: "room-1",
      discordUserId: "alice-id",
      playerId: "alice-id",
      alias: "Alice",
      slot: "player"
    });
    expect(result.lobby.occupants).toEqual([
      {
        discordUserId: "alice-id",
        playerId: "alice-id",
        alias: "Alice",
        slot: "player",
        placement: "team-a",
        connected: true,
        isLeader: true
      }
    ]);
  });

  it("rejects duplicate aliases in the same lobby case-insensitively after trim but allows them in different lobbies", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "First Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    await expect(
      directory.joinLobby("guild-1", "room-1", {
        discordUserId: "bob-id",
        alias: " alice ",
        slot: "player"
      })
    ).rejects.toThrow("Alias is already taken.");

    await directory.createLobby("guild-2", {
      name: "Second Room",
      leaderDiscordUserId: "carol-id",
      alias: " alice ",
      mode: "team-versus",
      initialSlot: "player"
    });

    expect(directory.getLobby("guild-2", "room-1").occupants).toEqual([
      expect.objectContaining({
        discordUserId: "carol-id",
        alias: "alice",
        placement: "team-a",
        isLeader: true
      })
    ]);
  });

  it("only lets the leader start and auto-assign team-versus lobbies", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "player"
    });

    expect(() => directory.assertCanStart("guild-1", "room-1", "bob-id")).toThrow(
      "Only the lobby leader can start."
    );

    const assigned = directory.autoAssignTeams("guild-1", "room-1", "alice-id");

    expect(assigned.occupants).toEqual([
      expect.objectContaining({ alias: "Alice", placement: "team-a" }),
      expect.objectContaining({ alias: "Bob", placement: "team-b" })
    ]);
    expect(directory.assertCanStart("guild-1", "room-1", "alice-id")).toEqual({ canStart: true });
  });

  it("moves players and spectators with leader or self authority", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "player"
    });
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "carol-id",
      alias: "Carol",
      slot: "spectator"
    });

    expect(() => directory.moveOccupant("guild-1", "room-1", "carol-id", "bob-id", "team-a")).toThrow(
      "Only the lobby leader can move another player."
    );

    const snapshot = directory.moveOccupant("guild-1", "room-1", "bob-id", "bob-id", "spectator");

    expect(snapshot.occupants).toContainEqual(
      expect.objectContaining({
        discordUserId: "bob-id",
        alias: "Bob",
        slot: "spectator",
        placement: "spectator"
      })
    );
  });

  it("only lets started lobbies be joined as spectators", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    directory.markPlaying("guild-1", "room-1");

    await expect(
      directory.joinLobby("guild-1", "room-1", {
        discordUserId: "bob-id",
        alias: "Bob",
        slot: "player"
      })
    ).rejects.toThrow("Started lobbies can only be joined as a spectator.");

    const result = await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "carol-id",
      alias: "Carol",
      slot: "spectator"
    });

    expect(result.session).toEqual({
      guildId: "guild-1",
      roomId: "room-1",
      discordUserId: "carol-id",
      playerId: "carol-id",
      alias: "Carol",
      slot: "spectator"
    });
    expect(result.lobby.occupants).toContainEqual(
      expect.objectContaining({
        discordUserId: "carol-id",
        alias: "Carol",
        slot: "spectator",
        placement: "spectator"
      })
    );
  });
});
