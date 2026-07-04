import type { ClientCommand, MatchSnapshot, ServerEvent } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import type { ClientSession } from "../sessions/localSession";
import { createGameStore } from "./useGameStore";

const session: ClientSession = {
  playerId: "alice",
  displayName: "Alice",
  roomId: "local-test",
  source: "local"
};

const snapshot: MatchSnapshot = {
  phase: "lobby",
  mode: "team-versus",
  players: [
    { id: "alice", displayName: "Alice", teamId: "team-a", position: { x: 0, y: 0 }, hp: 100, alive: true }
  ],
  teams: [{ id: "team-a", playerIds: ["alice"] }],
  terrain: { blobs: [] },
  turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
};

describe("createGameStore", () => {
  it("auto-joins the room when the socket opens", () => {
    const commands: ClientCommand[] = [];
    let onOpen: (() => void) | undefined;
    const store = createGameStore({
      session,
      clientFactory: (options) => {
        onOpen = options.onOpen;
        return {
          send: (command) => commands.push(command),
          close: () => {}
        };
      }
    });

    store.getState().connect();
    onOpen?.();

    expect(store.getState().connectionStatus).toBe("open");
    expect(commands).toEqual([{ type: "join-room", roomId: "local-test", playerId: "alice", displayName: "Alice" }]);
  });

  it("updates snapshots, logs events, and records rejections", () => {
    const commands: ClientCommand[] = [];
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: (command) => commands.push(command),
          close: () => {}
        };
      }
    });

    store.getState().connect();
    onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });
    store.getState().selectMode("free-for-all");
    store.getState().startMatch();
    store.getState().submitShot("sin(x)");
    onEvent?.({ type: "shot-rejected", roomId: "local-test", playerId: "alice", reason: "Player is not active" });

    expect(store.getState().snapshot).toEqual(snapshot);
    expect(store.getState().recentEvents.map((event) => event.type)).toEqual(["room-snapshot", "shot-rejected"]);
    expect(store.getState().lastRejection).toEqual({ playerId: "alice", reason: "Player is not active" });
    expect(commands).toEqual([
      { type: "select-mode", roomId: "local-test", playerId: "alice", mode: "free-for-all" },
      { type: "start-match", roomId: "local-test", playerId: "alice" },
      { type: "submit-shot", roomId: "local-test", playerId: "alice", functionFamilyId: "normal", expression: "sin(x)" }
    ]);
  });

  it("clears recent logs without dropping the current snapshot", () => {
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: () => {},
          close: () => {}
        };
      }
    });

    store.getState().connect();
    onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });
    store.getState().clearLog();

    expect(store.getState().snapshot).toEqual(snapshot);
    expect(store.getState().recentEvents).toEqual([]);
    expect(store.getState().log).toEqual([]);
  });
});
