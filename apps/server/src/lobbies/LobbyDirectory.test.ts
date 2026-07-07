import { describe, expect, it, vi } from "vitest";
import { craterRadiusBounds, defaultPlayerColor, playerColorPalette } from "@graphwar/shared";
import { LobbyDirectory, type LobbyDirectoryOptions } from "./LobbyDirectory";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDirectory(options: LobbyDirectoryOptions = {}): LobbyDirectory {
  return new LobbyDirectory({
    now: () => new Date("2026-07-05T00:00:00.000Z"),
    createRoomId: () => "room-1",
    upsertStatsEntry: async () => undefined,
    ...options
  });
}

function createDeferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
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
      color: defaultPlayerColor,
      slot: "player",
      sessionToken: expect.any(String)
    });
    expect(result.lobby.occupants).toEqual([
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
    ]);
  });

  it("stores selected player colors and max function length in lobby snapshots and sessions", async () => {
    const directory = createDirectory();

    const created = await directory.createLobby("guild-1", {
      name: "Color Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: playerColorPalette[2],
      maxFunctionLength: 35
    });
    const joined = await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "player",
      color: playerColorPalette[4]
    });

    expect(created.session).toEqual(expect.objectContaining({ color: playerColorPalette[2] }));
    expect(created.lobby.maxFunctionLength).toBe(35);
    expect(created.lobby.occupants[0]).toEqual(expect.objectContaining({ color: playerColorPalette[2] }));
    expect(joined.session).toEqual(expect.objectContaining({ color: playerColorPalette[4] }));
    expect(joined.lobby).toEqual(expect.objectContaining({ maxFunctionLength: 35 }));
    expect(joined.lobby.occupants).toEqual([
      expect.objectContaining({ discordUserId: "alice-id", color: playerColorPalette[2] }),
      expect.objectContaining({ discordUserId: "bob-id", color: playerColorPalette[4] })
    ]);
  });

  it("stores gameplay settings in lobby snapshots and summaries", async () => {
    const directory = createDirectory();

    const created = await directory.createLobby("guild-1", {
      name: "Rules Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      damagePerHit: 80,
      craterRadius: 2.5,
      uniqueFunctionHits: false,
      friendlyFire: true,
      advancedFunctions: true,
      functionPreview: false
    });

    expect(created.lobby).toEqual(
      expect.objectContaining({
        damagePerHit: 80,
        craterRadius: 2.5,
        uniqueFunctionHits: false,
        friendlyFire: true,
        advancedFunctions: true,
        functionPreview: false
      })
    );
    expect(directory.getLobby("guild-1", "room-1")).toEqual(
      expect.objectContaining({
        damagePerHit: 80,
        craterRadius: 2.5,
        uniqueFunctionHits: false,
        friendlyFire: true,
        advancedFunctions: true,
        functionPreview: false
      })
    );
    expect(directory.listLobbies("guild-1")).toEqual([
      expect.objectContaining({
        damagePerHit: 80,
        craterRadius: 2.5,
        uniqueFunctionHits: false,
        friendlyFire: true,
        advancedFunctions: true,
        functionPreview: false
      })
    ]);
  });

  it("ignores friendly-fire requests for free-for-all lobbies", async () => {
    const directory = createDirectory();

    const created = await directory.createLobby("guild-1", {
      name: "Free Rules Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "free-for-all",
      initialSlot: "player",
      friendlyFire: true
    });

    expect(created.lobby).toEqual(
      expect.objectContaining({ mode: "free-for-all", craterRadius: craterRadiusBounds.default, friendlyFire: false })
    );
    expect(directory.listLobbies("guild-1")).toEqual([
      expect.objectContaining({ mode: "free-for-all", friendlyFire: false })
    ]);
  });

  it("preserves avatar URLs in lobby occupants and sessions", async () => {
    const directory = createDirectory();

    const created = await directory.createLobby("guild-1", {
      name: "Avatar Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      avatarUrl: "https://cdn.example/alice.png",
      mode: "team-versus",
      initialSlot: "player"
    });
    const joined = await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      avatarUrl: "https://cdn.example/bob.png",
      slot: "player"
    });

    expect(created.session.avatarUrl).toBe("https://cdn.example/alice.png");
    expect(created.lobby.occupants[0].avatarUrl).toBe("https://cdn.example/alice.png");
    expect(joined.session.avatarUrl).toBe("https://cdn.example/bob.png");
    expect(joined.lobby.occupants).toEqual([
      expect.objectContaining({ discordUserId: "alice-id", avatarUrl: "https://cdn.example/alice.png" }),
      expect.objectContaining({ discordUserId: "bob-id", avatarUrl: "https://cdn.example/bob.png" })
    ]);
  });

  it("stores default map size presets for default-map lobby snapshots and summaries", async () => {
    const directory = createDirectory();

    const result = await directory.createLobby("guild-1", {
      name: "Huge Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      mapSizePreset: "huge"
    });

    expect(result.lobby.mapSizePreset).toBe("huge");
    expect(directory.getLobby("guild-1", "room-1").mapSizePreset).toBe("huge");
    expect(directory.listLobbies("guild-1")).toEqual([expect.objectContaining({ mapSizePreset: "huge" })]);
  });

  it("resolves selected custom map metadata into lobby snapshots and summaries", async () => {
    const resolveCustomMapName = vi.fn(async () => "Skyline Arena");
    const directory = createDirectory({ resolveCustomMapName });

    const result = await directory.createLobby("guild-1", {
      name: "Map Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "free-for-all",
      initialSlot: "player",
      mapId: "map-1"
    });

    expect(resolveCustomMapName).toHaveBeenCalledWith("guild-1", "map-1");
    expect(result.lobby).toEqual(expect.objectContaining({ mapId: "map-1", mapName: "Skyline Arena" }));
    expect(result.lobby.mapSizePreset).toBeUndefined();
    expect(directory.getLobby("guild-1", "room-1")).toEqual(
      expect.objectContaining({ mapId: "map-1", mapName: "Skyline Arena" })
    );
    expect(directory.getLobby("guild-1", "room-1")).not.toHaveProperty("mapSizePreset");
    expect(directory.listLobbies("guild-1")).toEqual([
      expect.objectContaining({ mapId: "map-1", mapName: "Skyline Arena" })
    ]);
  });

  it("rejects lobby creation when the selected custom map is unknown", async () => {
    const directory = createDirectory({
      resolveCustomMapName: async () => undefined
    });

    await expect(
      directory.createLobby("guild-1", {
        name: "Missing Map Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "free-for-all",
        initialSlot: "player",
        mapId: "missing-map"
      })
    ).rejects.toThrow("Custom map not found.");
    expect(() => directory.getLobby("guild-1", "room-1")).toThrow("Lobby not found.");
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

  it("allows duplicate aliases in different lobbies in the same guild", async () => {
    const roomIds = ["room-1", "room-2"];
    const directory = createDirectory({ createRoomId: () => roomIds.shift() ?? "room-extra" });

    await directory.createLobby("guild-1", {
      name: "First Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });
    await directory.createLobby("guild-1", {
      name: "Second Room",
      leaderDiscordUserId: "carol-id",
      alias: " alice ",
      mode: "team-versus",
      initialSlot: "player"
    });

    expect(directory.listLobbies("guild-1")).toEqual([
      expect.objectContaining({
        roomId: "room-1",
        leaderAlias: "Alice"
      }),
      expect.objectContaining({
        roomId: "room-2",
        leaderAlias: "alice"
      })
    ]);
  });

  it("serializes concurrent joins before checking aliases", async () => {
    const firstJoinStarted = createDeferred();
    const releaseFirstJoin = createDeferred();
    const directory = createDirectory({
      upsertStatsEntry: async (_guildId, discordUserId) => {
        if (discordUserId === "bob-id") {
          firstJoinStarted.resolve();
          await releaseFirstJoin.promise;
        }
      }
    });
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    const bobJoin = directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "player"
    });
    await firstJoinStarted.promise;
    const charlieJoin = directory.joinLobby("guild-1", "room-1", {
      discordUserId: "charlie-id",
      alias: "bob",
      slot: "player"
    });
    releaseFirstJoin.resolve();

    const results = await Promise.allSettled([bobJoin, charlieJoin]);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1]).toEqual(expect.objectContaining({ status: "rejected" }));
    await expect(charlieJoin).rejects.toThrow("Alias is already taken.");
    expect(directory.getLobby("guild-1", "room-1").occupants).toEqual([
      expect.objectContaining({ discordUserId: "alice-id", alias: "Alice" }),
      expect.objectContaining({ discordUserId: "bob-id", alias: "Bob" })
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

  it("promotes spectators into teams when the leader auto-assigns", async () => {
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
    directory.moveOccupant("guild-1", "room-1", "alice-id", "bob-id", "spectator");

    const assigned = directory.autoAssignTeams("guild-1", "room-1", "alice-id");

    expect(assigned.occupants).toEqual([
      expect.objectContaining({ alias: "Alice", slot: "player", placement: "team-a" }),
      expect.objectContaining({ alias: "Bob", slot: "player", placement: "team-b" })
    ]);
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
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "player"
    });

    directory.markPlaying("guild-1", "room-1");

    await expect(
      directory.joinLobby("guild-1", "room-1", {
        discordUserId: "dana-id",
        alias: "Dana",
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
      color: defaultPlayerColor,
      slot: "spectator",
      sessionToken: expect.any(String)
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

  it("does not mark invalid team-versus lobbies as playing", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    expect(() => directory.markPlaying("guild-1", "room-1")).toThrow("Team B needs at least one player.");
    expect(directory.getLobby("guild-1", "room-1")).toEqual(
      expect.objectContaining({
        status: "open",
        startedAt: undefined
      })
    );
  });

  it("does not overwrite startedAt on repeated markPlaying calls", async () => {
    const timestamps = [
      "2026-07-05T00:00:00.000Z",
      "2026-07-05T00:00:01.000Z",
      "2026-07-05T00:00:02.000Z"
    ];
    const directory = createDirectory({
      now: () => new Date(timestamps.shift() ?? "2026-07-05T00:00:03.000Z")
    });
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
    directory.autoAssignTeams("guild-1", "room-1", "alice-id");

    expect(directory.markPlaying("guild-1", "room-1")).toEqual(
      expect.objectContaining({
        status: "playing",
        startedAt: "2026-07-05T00:00:01.000Z"
      })
    );
    expect(() => directory.markPlaying("guild-1", "room-1")).toThrow("Match has already started.");
    expect(directory.getLobby("guild-1", "room-1")).toEqual(
      expect.objectContaining({
        status: "playing",
        startedAt: "2026-07-05T00:00:01.000Z"
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

  it("rejects start checks after the match has already started", async () => {
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
    directory.autoAssignTeams("guild-1", "room-1", "alice-id");
    directory.markPlaying("guild-1", "room-1");

    expect(() => directory.assertCanStart("guild-1", "room-1", "alice-id")).toThrow(
      "Match has already started."
    );
  });

  it("allows started player reconnects while keeping new users spectator-only", async () => {
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
    directory.autoAssignTeams("guild-1", "room-1", "alice-id");
    directory.markPlaying("guild-1", "room-1");

    const playerReconnect = await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bobby",
      slot: "player"
    });

    expect(playerReconnect.session).toEqual(
      expect.objectContaining({
        discordUserId: "bob-id",
        alias: "Bobby",
        slot: "player"
      })
    );
    expect(playerReconnect.lobby.occupants).toContainEqual(
      expect.objectContaining({
        discordUserId: "bob-id",
        alias: "Bobby",
        slot: "player",
        placement: "team-b"
      })
    );

    const spectatorReconnect = await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Robert",
      slot: "spectator"
    });

    expect(spectatorReconnect.session).toEqual(
      expect.objectContaining({
        discordUserId: "bob-id",
        alias: "Robert",
        slot: "player"
      })
    );
    expect(spectatorReconnect.lobby.occupants).toContainEqual(
      expect.objectContaining({
        discordUserId: "bob-id",
        alias: "Robert",
        slot: "player",
        placement: "team-b"
      })
    );

    await expect(
      directory.joinLobby("guild-1", "room-1", {
        discordUserId: "carol-id",
        alias: "Carol",
        slot: "player"
      })
    ).rejects.toThrow("Started lobbies can only be joined as a spectator.");

    const spectatorJoin = await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "dana-id",
      alias: "Dana",
      slot: "spectator"
    });

    expect(spectatorJoin.lobby.occupants).toContainEqual(
      expect.objectContaining({
        discordUserId: "dana-id",
        slot: "spectator",
        placement: "spectator"
      })
    );
  });

  it("validates moved placements for team-versus lobbies", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    expect(() => directory.moveOccupant("guild-1", "room-1", "alice-id", "alice-id", "players")).toThrow(
      "Invalid placement for team-versus lobby."
    );
  });

  it("validates moved placements for free-for-all lobbies", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Free Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "free-for-all",
      initialSlot: "player"
    });

    expect(() => directory.moveOccupant("guild-1", "room-1", "alice-id", "alice-id", "team-a")).toThrow(
      "Invalid placement for free-for-all lobby."
    );
    expect(() => directory.moveOccupant("guild-1", "room-1", "alice-id", "alice-id", "team-b")).toThrow(
      "Invalid placement for free-for-all lobby."
    );
  });

  it("rolls back occupant changes when stats upsert fails", async () => {
    const upsertStatsEntry = vi.fn(async (_guildId: string, discordUserId: string) => {
      if (discordUserId === "bob-id") {
        throw new Error("stats unavailable");
      }
    });
    const directory = createDirectory({ upsertStatsEntry });
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
        alias: "Bob",
        slot: "player"
      })
    ).rejects.toThrow("stats unavailable");

    expect(directory.getLobby("guild-1", "room-1").occupants).not.toContainEqual(
      expect.objectContaining({ discordUserId: "bob-id" })
    );
  });

  it("prevents spectators from moving into player slots after the match has started", async () => {
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
    directory.autoAssignTeams("guild-1", "room-1", "alice-id");
    directory.markPlaying("guild-1", "room-1");
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "charlie-id",
      alias: "Charlie",
      slot: "spectator"
    });

    expect(() => directory.moveOccupant("guild-1", "room-1", "charlie-id", "charlie-id", "team-a")).toThrow(
      "Cannot move occupants after match has started."
    );
    expect(directory.getLobby("guild-1", "room-1").occupants).toContainEqual(
      expect.objectContaining({
        discordUserId: "charlie-id",
        slot: "spectator",
        placement: "spectator"
      })
    );
  });

  it("prevents auto-assigning teams after the match has started", async () => {
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
    directory.autoAssignTeams("guild-1", "room-1", "alice-id");
    directory.moveOccupant("guild-1", "room-1", "alice-id", "alice-id", "team-b");
    directory.moveOccupant("guild-1", "room-1", "alice-id", "bob-id", "team-a");
    directory.markPlaying("guild-1", "room-1");

    expect(() => directory.autoAssignTeams("guild-1", "room-1", "alice-id")).toThrow(
      "Cannot move occupants after match has started."
    );
    expect(directory.getLobby("guild-1", "room-1").occupants).toEqual([
      expect.objectContaining({
        discordUserId: "alice-id",
        placement: "team-b"
      }),
      expect.objectContaining({
        discordUserId: "bob-id",
        placement: "team-a"
      })
    ]);
  });

  it("hides ended lobbies from listings and rejects later joins", async () => {
    const directory = createDirectory();
    await directory.createLobby("guild-1", {
      name: "Finished Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "free-for-all",
      initialSlot: "player"
    });
    await directory.joinLobby("guild-1", "room-1", {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "player"
    });
    directory.markPlaying("guild-1", "room-1");
    directory.markEnded("guild-1", "room-1");

    expect(directory.listLobbies("guild-1")).toEqual([]);
    await expect(
      directory.joinLobby("guild-1", "room-1", {
        discordUserId: "carol-id",
        alias: "Carol",
        slot: "spectator"
      })
    ).rejects.toThrow("Lobby has ended.");
  });
});
