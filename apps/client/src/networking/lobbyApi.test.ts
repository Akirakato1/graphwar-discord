import { afterEach, describe, expect, it, vi } from "vitest";
import { createLobbyApi } from "./lobbyApi";

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
      slot: "player"
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
});
