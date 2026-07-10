import { describe, expect, it } from "vitest";
import { defaultPlayerColor } from "@graphwar/shared";
import {
  clearSelectedLobbySession,
  readSelectedLobbySession,
  saveSelectedLobbySession,
  type LobbySessionStorage
} from "./lobbySessionStorage";

function memoryStorage(): LobbySessionStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

const scope = { guildId: "local-guild", discordUserId: "alice" };
const selected = {
  guildId: "local-guild",
  roomId: "room-1",
  discordUserId: "alice",
  playerId: "alice-player",
  alias: "Alice",
  avatarUrl: "https://cdn.example/alice.png",
  color: defaultPlayerColor,
  slot: "player" as const,
  sessionToken: "session-token"
};

describe("lobbySessionStorage", () => {
  it("saves, reads, and clears a selected lobby session scoped by guild and Discord user", () => {
    const storage = memoryStorage();

    saveSelectedLobbySession(storage, scope, selected);

    expect(readSelectedLobbySession(storage, scope)).toEqual(selected);
    expect(readSelectedLobbySession(storage, { guildId: "other-guild", discordUserId: "alice" })).toBeUndefined();

    clearSelectedLobbySession(storage, scope);

    expect(readSelectedLobbySession(storage, scope)).toBeUndefined();
  });

  it("ignores malformed or mismatched session payloads", () => {
    const storage = memoryStorage();
    storage.setItem("graphwar.selectedLobbySession:local-guild:alice", JSON.stringify({ ...selected, guildId: "wrong" }));

    expect(readSelectedLobbySession(storage, scope)).toBeUndefined();

    storage.setItem("graphwar.selectedLobbySession:local-guild:alice", "{");

    expect(readSelectedLobbySession(storage, scope)).toBeUndefined();
  });
});
