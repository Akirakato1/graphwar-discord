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
  it("reads local session values from query parameters", () => {
    const session = readLocalSession(
      "http://localhost:5173/?room=duel-room&mockPlayer=alice&displayName=Alice&server=ws://127.0.0.1:9999"
    );

    expect(session).toEqual({
      playerId: "alice",
      displayName: "Alice",
      roomId: "duel-room",
      serverUrl: "ws://127.0.0.1:9999",
      source: "local"
    });
  });

  it("uses a stable local player id and derives display name from it", () => {
    const storage = new MemoryStorage();

    const firstSession = readLocalSession("http://localhost:5173/", storage);
    const secondSession = readLocalSession("http://localhost:5173/", storage);

    expect(firstSession.roomId).toBe("local-test");
    expect(firstSession.playerId).toMatch(/^local-/);
    expect(secondSession.playerId).toBe(firstSession.playerId);
    expect(firstSession.displayName).toBe(firstSession.playerId);
    expect(firstSession.serverUrl).toBeUndefined();
    expect(firstSession.source).toBe("local");
  });

  it("defaults display name from the query player id", () => {
    const session = readLocalSession("http://localhost:5173/?mockPlayer=bob");

    expect(session.playerId).toBe("bob");
    expect(session.displayName).toBe("bob");
  });
});
