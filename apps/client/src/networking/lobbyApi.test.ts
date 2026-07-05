import { afterEach, describe, expect, it, vi } from "vitest";
import { createLobbyApi } from "./lobbyApi";

const customMap = {
  format: "graphwar-map" as const,
  version: 1 as const,
  name: "Imported Arena",
  terrain: { blobs: [] },
  spawnPoints: Array.from({ length: 10 }, (_, index) => ({
    id: `spawn-${index}`,
    position: { x: index, y: 0 }
  })),
  teamSpawnPointIds: {
    "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
    "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
  }
};

const persistedCustomMap = {
  ...customMap,
  id: "map-1",
  guildId: "local-guild",
  ownerDiscordUserId: "alice-id",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z"
};

const customMapSummary = {
  id: persistedCustomMap.id,
  guildId: persistedCustomMap.guildId,
  ownerDiscordUserId: persistedCustomMap.ownerDiscordUserId,
  name: persistedCustomMap.name,
  createdAt: persistedCustomMap.createdAt,
  updatedAt: persistedCustomMap.updatedAt
};

function lobbyJoinResult() {
  return {
    lobby: {
      guildId: "local-guild",
      roomId: "room-1",
      name: "Practice Room",
      mode: "team-versus",
      status: "open",
      leaderDiscordUserId: "alice-id",
      occupants: [
        {
          discordUserId: "alice-id",
          playerId: "alice-id",
          alias: "Alice",
          slot: "player",
          placement: "players",
          connected: true,
          isLeader: true
        }
      ],
      canStart: false,
      createdAt: "2026-07-05T00:00:00.000Z"
    },
    session: {
      guildId: "local-guild",
      roomId: "room-1",
      discordUserId: "alice-id",
      playerId: "alice-id",
      alias: "Alice",
      slot: "player",
      sessionToken: "session-token"
    }
  };
}

describe("createLobbyApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts create lobby requests to the guild-scoped lobbies endpoint", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      Response.json(lobbyJoinResult())
    );
    vi.stubGlobal("fetch", fetch);
    const api = createLobbyApi("http://127.0.0.1:8787/");

    await api.createLobby("local-guild", {
      name: "Practice Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8787/guilds/local-guild/lobbies", expect.any(Object));
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" }
    });
  });

  it("throws server error messages when joining a lobby fails", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      Response.json({ error: "Alias is already taken." }, { status: 409 })
    );
    vi.stubGlobal("fetch", fetch);
    const api = createLobbyApi("http://127.0.0.1:8787/");

    await expect(
      api.joinLobby("local-guild", "room-1", { discordUserId: "bob-id", alias: "Alice", slot: "player" })
    ).rejects.toThrow("Alias is already taken.");
  });

  it("throws fallback errors with status when non-ok responses are not JSON", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      new Response("not json", { status: 500 })
    );
    vi.stubGlobal("fetch", fetch);
    const api = createLobbyApi("http://127.0.0.1:8787/");

    await expect(api.listLobbies("local-guild")).rejects.toMatchObject({
      message: "Request failed.",
      status: 500
    });
  });

  it("lists guild custom maps from the maps endpoint", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      Response.json([persistedCustomMap])
    );
    vi.stubGlobal("fetch", fetch);
    const api = createLobbyApi("http://127.0.0.1:8787/");

    await expect(api.listCustomMaps("local-guild")).resolves.toEqual([customMapSummary]);

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8787/guilds/local-guild/maps");
  });

  it("posts custom map saves with the owner id", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      Response.json(persistedCustomMap, { status: 201 })
    );
    vi.stubGlobal("fetch", fetch);
    const api = createLobbyApi("http://127.0.0.1:8787/");

    await api.saveCustomMap("local-guild", { ownerDiscordUserId: "alice-id", map: customMap });

    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8787/guilds/local-guild/maps", expect.any(Object));
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      ownerDiscordUserId: "alice-id",
      map: customMap
    });
  });

  it("deletes custom maps with the actor id query parameter", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      new Response(null, { status: 204 })
    );
    vi.stubGlobal("fetch", fetch);
    const api = createLobbyApi("http://127.0.0.1:8787/");

    await api.deleteCustomMap("local-guild", "map-1", "alice-id");

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/guilds/local-guild/maps/map-1?actorDiscordUserId=alice-id",
      { method: "DELETE" }
    );
  });
});
