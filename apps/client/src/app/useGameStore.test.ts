import type { ClientCommand, MatchSnapshot, ServerEvent } from "@graphwar/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectGameClient, type WebSocketConstructor } from "../networking/gameClient";
import type { LobbyApi } from "../networking/lobbyApi";
import type { ClientSession } from "../sessions/localSession";
import { createGameStore } from "./useGameStore";

const session: ClientSession = {
  guildId: "local-guild",
  discordUserId: "alice",
  playerId: "alice",
  defaultAlias: "Alice",
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

function lobbyApiFor(roomId = "local-test"): LobbyApi {
  return {
    createLobby: async (guildId, request) => ({
      lobby: {
        guildId,
        roomId,
        name: request.name,
        mode: request.mode,
        status: "open",
        leaderDiscordUserId: request.leaderDiscordUserId,
        occupants: [],
        canStart: false,
        createdAt: "2026-07-05T00:00:00.000Z"
      },
      session: {
        guildId,
        roomId,
        discordUserId: request.leaderDiscordUserId,
        playerId: request.leaderDiscordUserId,
        alias: request.alias,
        slot: request.initialSlot
      }
    }),
    listLobbies: async () => [],
    joinLobby: async (guildId, requestedRoomId, request) => ({
      lobby: {
        guildId,
        roomId: requestedRoomId,
        name: "Joined Lobby",
        mode: "team-versus",
        status: "open",
        leaderDiscordUserId: request.discordUserId,
        occupants: [],
        canStart: false,
        createdAt: "2026-07-05T00:00:00.000Z"
      },
      session: {
        guildId,
        roomId: requestedRoomId,
        discordUserId: request.discordUserId,
        playerId: request.discordUserId,
        alias: request.alias,
        slot: request.slot
      }
    }),
    getSettings: async (guildId) => ({ guildId, defaultMode: "team-versus", allowSpectators: true }),
    saveSettings: async (settings) => settings,
    getLeaderboard: async () => []
  };
}

async function selectLobby(store: ReturnType<typeof createGameStore>): Promise<void> {
  await store.getState().createLobby({
    name: "Local Test",
    alias: session.defaultAlias,
    mode: "team-versus",
    initialSlot: "player"
  });
}

describe("createGameStore", () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.useRealTimers();
  });

  it("starts on the main menu without opening a websocket", () => {
    const commands: ClientCommand[] = [];
    const store = createGameStore({
      session,
      clientFactory: () => {
        throw new Error("websocket should not be created on initial menu");
      }
    });

    expect(store.getState().view).toBe("main-menu");
    expect(store.getState().connectionStatus).toBe("idle");
    expect(commands).toEqual([]);
  });

  it("creates a lobby through HTTP then connects to the selected websocket room", async () => {
    const commands: ClientCommand[] = [];
    let onOpen: (() => void) | undefined;
    const store = createGameStore({
      session: {
        ...session,
        guildId: "local-guild",
        discordUserId: "alice-id",
        playerId: "alice-id",
        defaultAlias: "Alice"
      },
      lobbyApi: {
        createLobby: async () => ({
          lobby: {
            guildId: "local-guild",
            roomId: "room-1",
            name: "Friday Graphwar",
            mode: "team-versus",
            status: "open",
            leaderDiscordUserId: "alice-id",
            occupants: [],
            canStart: false,
            createdAt: "2026-07-05T00:00:00.000Z"
          },
          session: {
            guildId: "local-guild",
            roomId: "room-1",
            discordUserId: "alice-id",
            playerId: "alice-id",
            alias: "Alice",
            slot: "player"
          }
        }),
        listLobbies: async () => [],
        joinLobby: async () => {
          throw new Error("not used");
        },
        getSettings: async () => ({ guildId: "local-guild", defaultMode: "team-versus", allowSpectators: true }),
        saveSettings: async (settings) => settings,
        getLeaderboard: async () => []
      },
      clientFactory: (options) => {
        onOpen = options.onOpen;
        return { send: (command) => commands.push(command), close: () => {} };
      }
    });

    await store.getState().createLobby({
      name: "Friday Graphwar",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player"
    });
    onOpen?.();

    expect(store.getState().view).toBe("lobby-setup");
    expect(commands).toEqual([
      {
        type: "join-room",
        guildId: "local-guild",
        roomId: "room-1",
        playerId: "alice-id",
        discordUserId: "alice-id",
        alias: "Alice",
        displayName: "Alice",
        slot: "player"
      }
    ]);
  });

  it("auto-joins the selected lobby room when the socket opens", async () => {
    const commands: ClientCommand[] = [];
    let onOpen: (() => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: (options) => {
        onOpen = options.onOpen;
        return {
          send: (command) => commands.push(command),
          close: () => {}
        };
      }
    });

    await selectLobby(store);
    onOpen?.();

    expect(store.getState().connectionStatus).toBe("open");
    expect(commands).toEqual([
      {
        type: "join-room",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        discordUserId: "alice",
        alias: "Alice",
        displayName: "Alice",
        slot: "player"
      }
    ]);
  });

  it("does not leave an old reconnect timer alive when manually connecting during the reconnect delay", async () => {
    vi.useFakeTimers();
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: (options) =>
        connectGameClient({
          ...options,
          locationHref: "http://localhost:5173/",
          reconnectDelayMs: 100,
          webSocketCtor: FakeWebSocket as unknown as WebSocketConstructor
        })
    });

    await selectLobby(store);
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

  it("updates snapshots, logs events, and records rejections", async () => {
    const commands: ClientCommand[] = [];
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: (command) => commands.push(command),
          close: () => {}
        };
      }
    });

    await selectLobby(store);
    onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });
    store.getState().selectMode("free-for-all");
    store.getState().startMatch();
    store.getState().submitShot("sin(x)", "west");
    onEvent?.({ type: "shot-rejected", roomId: "local-test", playerId: "alice", reason: "Player is not active" });

    expect(store.getState().snapshot).toEqual(snapshot);
    expect(store.getState().recentEvents.map((event) => event.type)).toEqual(["room-snapshot", "shot-rejected"]);
    expect(store.getState().lastRejection).toEqual({ playerId: "alice", reason: "Player is not active" });
    expect(commands).toEqual([
      { type: "select-mode", guildId: "local-guild", roomId: "local-test", playerId: "alice", mode: "free-for-all" },
      { type: "start-match", guildId: "local-guild", roomId: "local-test", playerId: "alice" },
      {
        type: "submit-shot",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal",
        aimDirection: "west",
        expression: "sin(x)"
      }
    ]);
  });

  it("clears a stale rejection after a later authoritative event", async () => {
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: () => {},
          close: () => {}
        };
      }
    });

    await selectLobby(store);
    onEvent?.({ type: "shot-rejected", roomId: "local-test", playerId: "alice", reason: "Player is not active" });
    onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });

    expect(store.getState().lastRejection).toBeUndefined();
  });

  it("lets a local empty-shot error replace a stale rejection notice", async () => {
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: () => {},
          close: () => {}
        };
      }
    });

    await selectLobby(store);
    onEvent?.({ type: "shot-rejected", roomId: "local-test", playerId: "alice", reason: "Player is not active" });
    store.getState().submitShot(" ", "east");

    expect(store.getState().lastRejection).toBeUndefined();
    expect(store.getState().lastError).toBe("Enter a function before submitting a shot.");
  });

  it("clears recent logs without dropping the current snapshot", async () => {
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: () => {},
          close: () => {}
        };
      }
    });

    await selectLobby(store);
    onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });
    store.getState().clearLog();

    expect(store.getState().snapshot).toEqual(snapshot);
    expect(store.getState().recentEvents).toEqual([]);
    expect(store.getState().log).toEqual([]);
  });
});
