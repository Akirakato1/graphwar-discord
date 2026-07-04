import type { ClientCommand, MatchSnapshot, ServerEvent } from "@graphwar/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectGameClient, type WebSocketConstructor } from "../networking/gameClient";
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

type Listener = (event: { data?: string }) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readyState = FakeWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Listener[]>();

  constructor() {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close", {});
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch("open", {});
  }

  private dispatch(type: string, event: { data?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function activeFakeSockets(): FakeWebSocket[] {
  return FakeWebSocket.instances.filter((socket) => socket.readyState !== FakeWebSocket.CLOSED);
}

describe("createGameStore", () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.useRealTimers();
  });

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

  it("does not leave an old reconnect timer alive when manually connecting during the reconnect delay", () => {
    vi.useFakeTimers();
    const store = createGameStore({
      session,
      clientFactory: (options) =>
        connectGameClient({
          ...options,
          locationHref: "http://localhost:5173/",
          reconnectDelayMs: 100,
          webSocketCtor: FakeWebSocket as unknown as WebSocketConstructor
        })
    });

    store.getState().connect();
    FakeWebSocket.instances[0].open();
    FakeWebSocket.instances[0].close();

    store.getState().connect();
    activeFakeSockets()[0].open();
    vi.advanceTimersByTime(100);
    for (const socket of activeFakeSockets()) {
      if (socket.readyState !== FakeWebSocket.OPEN) {
        socket.open();
      }
    }

    expect(activeFakeSockets()).toHaveLength(1);
    expect(commandsFromSockets("join-room")).toHaveLength(2);

    function commandsFromSockets(type: ClientCommand["type"]): ClientCommand[] {
      return FakeWebSocket.instances
        .flatMap((socket) => socket.sent)
        .map((payload) => JSON.parse(payload) as ClientCommand)
        .filter((command) => command.type === type);
    }
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

  it("clears a stale rejection after a later authoritative event", () => {
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
    onEvent?.({ type: "shot-rejected", roomId: "local-test", playerId: "alice", reason: "Player is not active" });
    onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });

    expect(store.getState().lastRejection).toBeUndefined();
  });

  it("lets a local empty-shot error replace a stale rejection notice", () => {
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
    onEvent?.({ type: "shot-rejected", roomId: "local-test", playerId: "alice", reason: "Player is not active" });
    store.getState().submitShot(" ");

    expect(store.getState().lastRejection).toBeUndefined();
    expect(store.getState().lastError).toBe("Enter a function before submitting a shot.");
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
