import { describe, expect, it, vi } from "vitest";
import { LobbyDirectory, type LobbyDirectoryOptions } from "./LobbyDirectory";

function createDirectory(options: LobbyDirectoryOptions = {}): LobbyDirectory {
  return new LobbyDirectory({
    now: () => new Date("2026-07-05T00:00:00.000Z"),
    createRoomId: () => "room-1",
    upsertStatsEntry: async () => undefined,
    ...options
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

  it("upserts stats after successful create and join with trimmed aliases", async () => {
    const upsertStatsEntry = vi.fn(async () => undefined);
    const directory = createDirectory({ upsertStatsEntry });

    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: " Alice ",
      mode: "team-versus",
      initialSlot: "player"
    });
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: " Bob ",
      slot: "player"
    });

    expect(upsertStatsEntry).toHaveBeenNthCalledWith(1, "guild-1", "alice-id", "Alice");
    expect(upsertStatsEntry).toHaveBeenNthCalledWith(2, "guild-1", "bob-id", "Bob");
  });

  it("rejects empty aliases", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    await expect(
      directory.joinLobby("guild-1", "room-1", {
        discordUserId: "bob-id",
        alias: "  ",
        slot: "player"
      })
    ).rejects.toThrow("Alias is required.");
  });

  it("allows reconnects by the same discord user and updates their alias", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "alice-id",
      alias: " alice ",
      slot: "player"
    });
    const result = await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "alice-id",
      alias: " Captain Alice ",
      slot: "player"
    });

    expect(result.session.alias).toBe("Captain Alice");
    expect(result.lobby.occupants).toEqual([
      expect.objectContaining({
        discordUserId: "alice-id",
        alias: "Captain Alice",
        placement: "team-a",
        isLeader: true
      })
    ]);
  });

  it("blocks free-for-all starts with fewer than two players", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Free Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "free-for-all",
      initialSlot: "player"
    });

    expect(() => directory.assertCanStart("guild-1", "room-1", "alice-id")).toThrow(
      "Free for all needs at least two players."
    );
  });

  it("reports team-versus Team A and Team B start blockers", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "spectator"
    });

    expect(() => directory.assertCanStart("guild-1", "room-1", "alice-id")).toThrow(
      "Team A needs at least one player."
    );

    directory.moveOccupant("guild-1", "room-1", "alice-id", "alice-id", "team-a");

    expect(() => directory.assertCanStart("guild-1", "room-1", "alice-id")).toThrow(
      "Team B needs at least one player."
    );
  });

  it("marks lobbies playing with injected time and no longer startable", async () => {
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

    const snapshot = directory.markPlaying("guild-1", "room-1");

    expect(snapshot).toEqual(
      expect.objectContaining({
        status: "playing",
        startedAt: "2026-07-05T00:00:00.000Z",
        canStart: false
      })
    );
  });

  it("lists only lobbies for the requested guild with leader alias and slot counts", async () => {
    const roomIds = ["room-1", "room-2", "room-3"];
    const directory = createDirectory({ createRoomId: () => roomIds.shift() ?? "room-extra" });
    await directory.createLobby("guild-1", {
      name: "First Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "spectator"
    });
    await directory.createLobby("guild-2", {
      name: "Other Guild Room",
      leaderDiscordUserId: "carol-id",
      alias: "Carol",
      mode: "team-versus",
      initialSlot: "player"
    });
    await directory.createLobby("guild-1", {
      name: "Second Room",
      leaderDiscordUserId: "dana-id",
      alias: "Dana",
      mode: "free-for-all",
      initialSlot: "spectator"
    });

    expect(directory.listLobbies("guild-1")).toEqual([
      expect.objectContaining({
        guildId: "guild-1",
        roomId: "room-1",
        leaderAlias: "Alice",
        playerCount: 1,
        spectatorCount: 1
      }),
      expect.objectContaining({
        guildId: "guild-1",
        roomId: "room-3",
        leaderAlias: "Dana",
        playerCount: 0,
        spectatorCount: 1
      })
    ]);
  });

  it("returns only defensive copies of player occupants", async () => {
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
      slot: "spectator"
    });

    const players = directory.playerOccupants("guild-1", "room-1");
    expect(players).toEqual([
      expect.objectContaining({
        discordUserId: "alice-id",
        alias: "Alice",
        slot: "player"
      })
    ]);

    players[0].alias = "Changed";

    expect(directory.getLobby("guild-1", "room-1").occupants).toContainEqual(
      expect.objectContaining({
        discordUserId: "alice-id",
        alias: "Alice",
        slot: "player"
      })
    );
  });

  it("rejects non-leader auto-assign team requests", async () => {
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

    expect(() => directory.autoAssignTeams("guild-1", "room-1", "bob-id")).toThrow(
      "Only the lobby leader can start."
    );
  });
});
