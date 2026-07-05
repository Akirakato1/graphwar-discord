import { describe, expect, it } from "vitest";
import { isAliasConflictError, validateJoinAlias } from "./JoinLobbyView";

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
});
