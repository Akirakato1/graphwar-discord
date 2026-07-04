import { describe, expect, it } from "vitest";
import { matchSnapshotSchema } from "@graphwar/shared";
import { MatchController } from "./MatchController";

describe("MatchController", () => {
  it("starts a team match with terrain, players, and an active turn", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    const snapshot = controller.startMatch("team-versus");

    expect(snapshot.phase).toBe("playing");
    expect(snapshot.players).toHaveLength(2);
    expect(snapshot.terrain.blobs.length).toBeGreaterThan(0);
    expect(snapshot.turn.activePlayerId).toBe("alice");
  });

  it("rejects a shot from a non-active player", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");

    expect(controller.submitShot("bob", "normal", "x").type).toBe("shot-rejected");
  });

  it("resolves a valid active-player shot and advances the turn", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");
    const event = controller.submitShot("alice", "normal", "0");

    expect(event.type).toBe("shot-resolved");
    if (event.type === "shot-resolved") {
      expect(event.snapshot.turn.activePlayerId).toBe("bob");
    }
  });

  it("ends a free-for-all match when one player remains alive after resolution", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("free-for-all");
    controller.forcePlayerHpForTest("bob", 0);
    const event = controller.submitShot("alice", "normal", "0");

    expect(event.type).toBe("match-ended");
    if (event.type === "match-ended") {
      expect(event.winnerIds).toEqual(["alice"]);
      expect(event.snapshot.phase).toBe("ended");
    }
  });

  it("throws when starting a match with zero players", () => {
    const controller = new MatchController("room-1");

    expect(() => controller.startMatch("team-versus")).toThrow("Cannot start match without players");
  });

  it("returns a schema-valid lobby snapshot after construction", () => {
    const controller = new MatchController("room-1");
    const snapshot = controller.getSnapshot();

    expect(matchSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.phase).toBe("lobby");
    expect(snapshot.turn.turnNumber).toBe(1);
  });

  it("rejects an invalid function expression from the active player", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");

    expect(controller.submitShot("alice", "normal", "notAFunction(x)").type).toBe("shot-rejected");
  });
});
