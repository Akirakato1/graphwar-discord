import { describe, expect, it } from "vitest";
import { readLocalSession } from "./localSession";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("readLocalSession", () => {
  it("reads guild and discord user identity from local testing query parameters", () => {
    const session = readLocalSession(
      "http://localhost:5173/?guild=local-guild&user=alice-id&server=http://127.0.0.1:8787"
    );

    expect(session).toMatchObject({
      guildId: "local-guild",
      discordUserId: "alice-id",
      playerId: "alice-id",
      source: "local",
      serverUrl: "http://127.0.0.1:8787"
    });
  });

  it("keeps mockPlayer as a compatibility identity shortcut", () => {
    const session = readLocalSession("http://localhost:5173/?mockPlayer=bob&displayName=Bob");

    expect(session.guildId).toBe("local-guild");
    expect(session.discordUserId).toBe("bob");
    expect(session.defaultAlias).toBe("Bob");
  });

  it("reads local session values from query parameters", () => {
    const session = readLocalSession(
      "http://localhost:5173/?room=duel-room&mockPlayer=alice&displayName=Alice&server=ws://127.0.0.1:9999"
    );

    expect(session).toEqual({
      guildId: "local-guild",
      discordUserId: "alice",
      playerId: "alice",
      defaultAlias: "Alice",
      displayName: "Alice",
      roomId: "duel-room",
      serverUrl: "ws://127.0.0.1:9999",
      source: "local"
    });
  });

  it("reads a decoded http avatar query parameter", () => {
    const session = readLocalSession(
      "http://localhost:5173/?user=alice&avatar=https%3A%2F%2Fcdn.example%2Falice.png"
    );

    expect(session.avatarUrl).toBe("https://cdn.example/alice.png");
  });

  it("drops invalid avatar query parameters", () => {
    expect(readLocalSession("http://localhost:5173/?user=alice&avatar=bogus").avatarUrl).toBeUndefined();
    expect(readLocalSession("http://localhost:5173/?user=alice&avatar=").avatarUrl).toBeUndefined();
    expect(
      readLocalSession(`http://localhost:5173/?user=alice&avatar=${encodeURIComponent(`https://cdn.example/${"a".repeat(2050)}`)}`)
        .avatarUrl
    ).toBeUndefined();
  });

  it("uses a stable local player id and derives display name from it", () => {
    const storage = new MemoryStorage();

    const firstSession = readLocalSession("http://localhost:5173/", storage);
    const secondSession = readLocalSession("http://localhost:5173/", storage);

    expect(firstSession.guildId).toBe("local-guild");
    expect(firstSession.roomId).toBeUndefined();
    expect(firstSession.discordUserId).toMatch(/^local-/);
    expect(firstSession.playerId).toMatch(/^local-/);
    expect(secondSession.playerId).toBe(firstSession.playerId);
    expect(firstSession.defaultAlias).toBe(firstSession.playerId);
    expect(firstSession.displayName).toBe(firstSession.playerId);
    expect(firstSession.serverUrl).toBeUndefined();
    expect(firstSession.source).toBe("local");
  });

  it("defaults display name from the query player id", () => {
    const session = readLocalSession("http://localhost:5173/?mockPlayer=bob");

    expect(session.playerId).toBe("bob");
    expect(session.discordUserId).toBe("bob");
    expect(session.defaultAlias).toBe("bob");
    expect(session.displayName).toBe("bob");
  });
});
