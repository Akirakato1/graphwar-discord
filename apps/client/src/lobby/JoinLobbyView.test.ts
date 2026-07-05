import { describe, expect, it } from "vitest";
import { isAliasConflictError, isJoinActionDisabled, joinActionLabel, validateJoinAlias } from "./JoinLobbyView";

const openLobby = {
  guildId: "local-guild",
  roomId: "room-1",
  name: "Friday Graphwar",
  mode: "team-versus" as const,
  status: "open" as const,
  leaderAlias: "Alice",
  leaderDiscordUserId: "alice-id",
  playerCount: 1,
  spectatorCount: 0,
  createdAt: "2026-07-05T00:00:00.000Z"
};

describe("JoinLobbyView helpers", () => {
  it("rejects blank aliases before submitting a join request", () => {
    expect(validateJoinAlias("   ")).toBe("Enter an alias.");
    expect(validateJoinAlias(" Alice ")).toBeUndefined();
  });

  it("recognizes alias conflicts by message or HTTP 409 status", () => {
    expect(isAliasConflictError(new Error("Alias is already taken."))).toBe(true);
    expect(isAliasConflictError(Object.assign(new Error("Request failed."), { status: 409 }))).toBe(true);
    expect(isAliasConflictError(new Error("Lobby is full."))).toBe(false);
  });

  it("labels separate join actions and only blocks player joins after start", () => {
    expect(joinActionLabel("player")).toBe("Join As Player");
    expect(joinActionLabel("spectator")).toBe("Spectate");
    expect(isJoinActionDisabled(openLobby, "player", undefined)).toBe(false);
    expect(isJoinActionDisabled(openLobby, "spectator", undefined)).toBe(false);
    expect(isJoinActionDisabled({ ...openLobby, status: "playing" }, "player", undefined)).toBe(true);
    expect(isJoinActionDisabled({ ...openLobby, status: "playing" }, "spectator", undefined)).toBe(false);
    expect(isJoinActionDisabled(openLobby, "spectator", openLobby.roomId)).toBe(true);
  });
});
