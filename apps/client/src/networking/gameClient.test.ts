import type { MatchSnapshot, ServerEvent } from "@graphwar/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRoomWebSocketUrl, connectGameClient, type WebSocketConstructor } from "./gameClient";

const standardWorldBounds = { minX: -25, maxX: 25, minY: -15, maxY: 15 };

const snapshot: MatchSnapshot = {
  phase: "lobby",
  mode: "team-versus",
  worldBounds: standardWorldBounds,
  players: [],
  teams: [],
  terrain: { blobs: [] },
  turn: { activePlayerId: "", order: [], turnNumber: 1 }
};

type Listener = (event: { data?: string }) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly sent: string[] = [];
  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
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

  message(data: unknown): void {
    this.dispatch("message", { data: String(data) });
  }

  private dispatch(type: string, event: { data?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("buildRoomWebSocketUrl", () => {
  it("builds guild-scoped websocket urls", () => {
    expect(
      buildRoomWebSocketUrl({
        guildId: "local-guild",
        roomId: "room 1",
        serverUrl: "http://127.0.0.1:8787/",
        locationHref: "http://localhost:5173/"
      })
    ).toBe("ws://127.0.0.1:8787/guilds/local-guild/rooms/room%201");
  });

  it("defaults to the current hostname on port 8787", () => {
    expect(
      buildRoomWebSocketUrl({
        roomId: "local test",
        locationHref: "http://devbox.local:5173/path"
      })
    ).toBe("ws://devbox.local:8787/rooms/local%20test");
  });

  it("uses an explicit server override as the WebSocket base", () => {
    expect(
      buildRoomWebSocketUrl({
        roomId: "local-test",
        serverUrl: "ws://127.0.0.1:9999/",
        locationHref: "http://localhost:5173/"
      })
    ).toBe("ws://127.0.0.1:9999/rooms/local-test");
  });
});

describe("connectGameClient", () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.useRealTimers();
  });

  it("validates inbound server events before dispatching them", () => {
    const events: ServerEvent[] = [];
    const errors: string[] = [];
    connectGameClient({
      roomId: "local-test",
      webSocketCtor: FakeWebSocket as unknown as WebSocketConstructor,
      locationHref: "http://localhost:5173/",
      onEvent: (event) => events.push(event),
      onError: (message) => errors.push(message)
    });

    const socket = FakeWebSocket.instances[0];
    socket.message(JSON.stringify({ type: "room-snapshot", roomId: "local-test", snapshot }));
    socket.message(JSON.stringify({ type: "not-real", roomId: "local-test" }));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("room-snapshot");
    expect(errors[0]).toContain("Invalid server event");
  });

  it("sends client commands as JSON and reports open and close callbacks", () => {
    const callbacks: string[] = [];
    const client = connectGameClient({
      roomId: "local-test",
      webSocketCtor: FakeWebSocket as unknown as WebSocketConstructor,
      locationHref: "http://localhost:5173/",
      onEvent: () => {},
      onOpen: () => callbacks.push("open"),
      onClose: () => callbacks.push("close")
    });
    const socket = FakeWebSocket.instances[0];

    socket.open();
    client.send({ type: "start-match", roomId: "local-test", playerId: "alice" });
    socket.close();

    expect(callbacks).toEqual(["open", "close"]);
    expect(socket.sent).toEqual([JSON.stringify({ type: "start-match", roomId: "local-test", playerId: "alice" })]);
  });

  it("can reconnect after an unexpected close", () => {
    vi.useFakeTimers();
    const callbacks: string[] = [];
    connectGameClient({
      roomId: "local-test",
      webSocketCtor: FakeWebSocket as unknown as WebSocketConstructor,
      locationHref: "http://localhost:5173/",
      reconnect: true,
      reconnectDelayMs: 25,
      onEvent: () => {},
      onReconnect: () => callbacks.push("reconnect")
    });

    FakeWebSocket.instances[0].close();
    vi.advanceTimersByTime(25);

    expect(callbacks).toEqual(["reconnect"]);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
