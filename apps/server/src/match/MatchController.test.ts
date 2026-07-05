import { describe, expect, expectTypeOf, it } from "vitest";
import { matchSnapshotSchema, serverEventSchema, type ServerEvent } from "@graphwar/shared";
import { MatchController, type ShotSubmissionEvents } from "./MatchController";

describe("MatchController", () => {
  it("exposes shot submissions as ordered non-empty event tuples", () => {
    const controller = new MatchController("room-1");

    expectTypeOf(controller.submitShot).returns.toEqualTypeOf<ShotSubmissionEvents>();
    expectTypeOf<ShotSubmissionEvents>().toEqualTypeOf<
      | [Extract<ServerEvent, { type: "shot-rejected" }>]
      | [Extract<ServerEvent, { type: "shot-resolved" }>]
      | [Extract<ServerEvent, { type: "shot-resolved" }>, Extract<ServerEvent, { type: "match-ended" }>]
    >();
  });

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

  it("starts a match with an injected generated map when provided", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");

    const snapshot = controller.startMatch("free-for-all", {
      terrain: {
        blobs: [
          {
            id: "custom-platform",
            outer: [
              { x: -1, y: -1 },
              { x: 1, y: -1 },
              { x: 0, y: 1 }
            ],
            holes: []
          }
        ]
      },
      spawns: [
        { playerId: "alice", position: { x: -7, y: 3 } },
        { playerId: "bob", position: { x: 9, y: -4 } }
      ]
    });

    expect(snapshot.terrain.blobs).toEqual([expect.objectContaining({ id: "custom-platform" })]);
    expect(snapshot.players.find((player) => player.id === "alice")?.position).toEqual({ x: -7, y: 3 });
    expect(snapshot.players.find((player) => player.id === "bob")?.position).toEqual({ x: 9, y: -4 });
  });

  it("rejects a shot from a non-active player", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");

    const [event] = controller.submitShot("bob", "normal", "x");

    expect(event.type).toBe("shot-rejected");
  });

  it("resolves a valid active-player shot and advances the turn", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");
    const [event] = controller.submitShot("alice", "normal", "0", "west");

    expect(event.type).toBe("shot-resolved");
    if (event.type === "shot-resolved") {
      expect(event.aimDirection).toBe("west");
      expect(event.snapshot.turn.activePlayerId).toBe("bob");
    }
  });

  it("ends a free-for-all match when one player remains alive after resolution", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("free-for-all");
    controller.forcePlayerHpForTest("bob", 0);
    const events = controller.submitShot("alice", "normal", "0");

    expect(events.map((event) => event.type)).toEqual(["shot-resolved", "match-ended"]);
    if (events.length !== 2) {
      throw new Error(`Expected shot-resolved then match-ended, received ${events.map((event) => event.type).join(", ")}`);
    }
    const [resolved, ended] = events;
    expect(resolved.type).toBe("shot-resolved");
    if (resolved.type === "shot-resolved") {
      expect(resolved.snapshot.phase).toBe("playing");
      expect(resolved.path.length).toBeGreaterThan(0);
      expect(resolved.terrain).toEqual(resolved.snapshot.terrain);
      expect(resolved.damage).toEqual(expect.any(Array));
    }
    expect(ended.type).toBe("match-ended");
    if (ended.type === "match-ended") {
      expect(ended.winnerIds).toEqual(["alice"]);
      expect(ended.snapshot.phase).toBe("ended");
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

    const [event] = controller.submitShot("alice", "normal", "notAFunction(x)");

    expect(event.type).toBe("shot-rejected");
  });

  it("throws instead of restarting a playing match", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    const original = controller.startMatch("team-versus");

    expect(() => controller.startMatch("free-for-all")).toThrow("Match has already started");
    expect(controller.getSnapshot()).toEqual(original);
  });

  it("throws instead of restarting an ended match", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("free-for-all");
    controller.forcePlayerHpForTest("bob", 0);
    controller.submitShot("alice", "normal", "0");

    expect(() => controller.startMatch("team-versus")).toThrow("Match has already started");
  });

  it("throws without mutating state when a player joins after match start", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    const started = controller.startMatch("team-versus");

    expect(() => controller.join("charlie", "Charlie")).toThrow("Cannot join after match has started");
    expect(controller.getSnapshot()).toEqual(started);
  });

  it("selects a lobby mode and rebuilds lobby teams", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    const snapshot = controller.selectMode("free-for-all");

    expect(snapshot.mode).toBe("free-for-all");
    expect(snapshot.teams).toEqual([
      { id: "player-alice", playerIds: ["alice"] },
      { id: "player-bob", playerIds: ["bob"] }
    ]);
    expect(controller.getSnapshot().mode).toBe("free-for-all");
  });

  it("starts a team match using explicit lobby team placements", () => {
    const controller = new MatchController("room-1");
    controller.setLobbyPlayers("team-versus", [
      { id: "alice-id", displayName: "Alice", teamId: "team-b" },
      { id: "bob-id", displayName: "Bob", teamId: "team-a" }
    ]);

    const snapshot = controller.startMatch("team-versus");

    expect(snapshot.teams).toEqual([
      { id: "team-a", playerIds: ["bob-id"] },
      { id: "team-b", playerIds: ["alice-id"] }
    ]);
    expect(snapshot.players.find((player) => player.id === "alice-id")?.teamId).toBe("team-b");
    expect(snapshot.players.find((player) => player.id === "alice-id")?.position.x).toBeGreaterThan(0);
    expect(snapshot.players.find((player) => player.id === "bob-id")?.position.x).toBeLessThan(0);
    expect(snapshot.turn.order).toEqual(["alice-id", "bob-id"]);
  });

  it("carries lobby player colors into lobby and playing snapshots", () => {
    const controller = new MatchController("room-1");
    const lobby = controller.setLobbyPlayers("team-versus", [
      { id: "alice-id", displayName: "Alice", teamId: "team-a", color: "#4cc9f0" },
      { id: "bob-id", displayName: "Bob", teamId: "team-b", color: "#f72585" }
    ]);

    expect(lobby.players.find((player) => player.id === "alice-id")?.color).toBe("#4cc9f0");
    expect(controller.startMatch("team-versus").players.find((player) => player.id === "bob-id")?.color).toBe(
      "#f72585"
    );
  });

  it("uses the configured max function length for submitted shots", () => {
    const controller = new MatchController("room-1");
    controller.setLobbyPlayers("free-for-all", [
      { id: "alice-id", displayName: "Alice" },
      { id: "bob-id", displayName: "Bob" }
    ]);
    controller.startMatch(
      "free-for-all",
      {
        terrain: { blobs: [] },
        spawns: [
          { playerId: "alice-id", position: { x: -19, y: 0 } },
          { playerId: "bob-id", position: { x: 3, y: 0 } }
        ]
      },
      { maxFunctionLength: 20 }
    );

    const [event] = controller.submitShot("alice-id", "normal", "0");

    expect(event.type).toBe("shot-resolved");
    if (event.type === "shot-resolved") {
      expect(event.impact.reason).toBe("miss");
      expect(event.path.at(-1)?.x).toBeGreaterThan(0.9);
      expect(event.path.at(-1)?.x).toBeLessThanOrEqual(1);
    }
  });

  it("keeps unbalanced explicit team placements on their spawn sides", () => {
    const controller = new MatchController("room-1");
    controller.setLobbyPlayers("team-versus", [
      { id: "alice-id", displayName: "Alice", teamId: "team-b" },
      { id: "bob-id", displayName: "Bob", teamId: "team-a" },
      { id: "charlie-id", displayName: "Charlie", teamId: "team-b" }
    ]);

    const snapshot = controller.startMatch("team-versus");

    expect(snapshot.players.find((player) => player.id === "bob-id")?.position.x).toBeLessThan(0);
    expect(snapshot.players.find((player) => player.id === "alice-id")?.position.x).toBeGreaterThan(0);
    expect(snapshot.players.find((player) => player.id === "charlie-id")?.position.x).toBeGreaterThan(0);
    expect(snapshot.turn.order).toEqual(["alice-id", "bob-id", "charlie-id"]);
  });

  it("rebuilds lobby snapshots from non-spectator lobby players only", () => {
    const controller = new MatchController("room-1");
    const snapshot = controller.setLobbyPlayers("free-for-all", [
      { id: "alice-id", displayName: "Alice" },
      { id: "bob-id", displayName: "Bob" }
    ]);

    expect(snapshot.players.map((player) => player.id)).toEqual(["alice-id", "bob-id"]);
    expect(snapshot.teams).toEqual([
      { id: "player-alice-id", playerIds: ["alice-id"] },
      { id: "player-bob-id", playerIds: ["bob-id"] }
    ]);
  });

  it("copies lobby players passed to setLobbyPlayers", () => {
    const controller = new MatchController("room-1");
    const players: Parameters<MatchController["setLobbyPlayers"]>[1] = [
      { id: "alice-id", displayName: "Alice", teamId: "team-a" }
    ];
    controller.setLobbyPlayers("team-versus", players);
    players[0].displayName = "Mallory";
    players[0].teamId = "team-b";

    expect(controller.getSnapshot().players[0]).toMatchObject({ displayName: "Alice", teamId: "team-a" });
    expect(controller.startMatch("team-versus").players[0]).toMatchObject({ displayName: "Alice", teamId: "team-a" });
  });

  it("throws when replacing lobby players after match start", () => {
    const controller = new MatchController("room-1");
    controller.setLobbyPlayers("team-versus", [
      { id: "alice-id", displayName: "Alice", teamId: "team-a" },
      { id: "bob-id", displayName: "Bob", teamId: "team-b" }
    ]);
    controller.startMatch("team-versus");

    expect(() => controller.setLobbyPlayers("team-versus", [])).toThrow("Match has already started");
  });

  it("throws when selecting a mode after match start", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");

    expect(() => controller.selectMode("free-for-all")).toThrow("Match has already started");
  });

  it("skips eliminated players while preserving the original turn order", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.join("charlie", "Charlie");
    controller.startMatch("free-for-all");
    controller.forcePlayerHpForTest("bob", 0);
    const [event] = controller.submitShot("alice", "normal", "100");

    expect(event.type).toBe("shot-resolved");
    if (event.type === "shot-resolved") {
      expect(event.snapshot.turn.activePlayerId).toBe("charlie");
      expect(event.snapshot.turn.order).toEqual(["alice", "bob", "charlie"]);
    }
  });

  it("returns defensive snapshots that callers cannot mutate", () => {
    const controller = new MatchController("room-1");
    const joined = controller.join("alice", "Alice");

    joined.players[0].displayName = "Mallory";
    joined.teams.push({ id: "intruder", playerIds: [] });

    expect(controller.getSnapshot().players[0].displayName).toBe("Alice");
    expect(controller.getSnapshot().teams.map((team) => team.id)).not.toContain("intruder");
  });

  it("throws when forcing hp for an unknown player", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");

    expect(() => controller.forcePlayerHpForTest("bob", 0)).toThrow("Unknown player: bob");
  });

  it("emits schema-valid joined lobby, playing, and ended snapshots", () => {
    const controller = new MatchController("room-1");
    const joined = controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    const playing = controller.startMatch("free-for-all");
    controller.forcePlayerHpForTest("bob", 0);
    const events = controller.submitShot("alice", "normal", "0");

    expect(matchSnapshotSchema.parse(joined)).toEqual(joined);
    expect(matchSnapshotSchema.parse(playing)).toEqual(playing);
    if (events.length !== 2) {
      throw new Error(`Expected shot-resolved then match-ended, received ${events.map((event) => event.type).join(", ")}`);
    }
    const ended = events[1];
    expect(ended.type).toBe("match-ended");
    if (ended.type === "match-ended") {
      expect(matchSnapshotSchema.parse(ended.snapshot)).toEqual(ended.snapshot);
    }
  });

  it("emits schema-valid rejected, resolved, and ended shot events", () => {
    const rejectedController = new MatchController("room-rejected");
    rejectedController.join("alice", "Alice");
    rejectedController.join("bob", "Bob");
    rejectedController.startMatch("team-versus");
    const [rejected] = rejectedController.submitShot("bob", "normal", "0");

    const resolvedController = new MatchController("room-resolved");
    resolvedController.join("alice", "Alice");
    resolvedController.join("bob", "Bob");
    resolvedController.join("charlie", "Charlie");
    resolvedController.startMatch("free-for-all");
    const [resolved] = resolvedController.submitShot("alice", "normal", "100");

    const endedController = new MatchController("room-ended");
    endedController.join("alice", "Alice");
    endedController.join("bob", "Bob");
    endedController.startMatch("free-for-all");
    endedController.forcePlayerHpForTest("bob", 0);
    const endedEvents = endedController.submitShot("alice", "normal", "0");

    expect(serverEventSchema.parse(rejected)).toEqual(rejected);
    expect(serverEventSchema.parse(resolved)).toEqual(resolved);
    expect(endedEvents.map((event) => serverEventSchema.parse(event))).toEqual(endedEvents);
  });
});
