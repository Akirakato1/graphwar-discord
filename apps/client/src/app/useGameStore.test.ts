import {
  defaultLobbyGameplaySettings,
  defaultPlayerColor,
  playerColorPalette,
  type ClientCommand,
  type MatchSnapshot,
  type ServerEvent
} from "@graphwar/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectGameClient, type ConnectGameClientOptions, type WebSocketConstructor } from "../networking/gameClient";
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

const standardWorldBounds = { minX: -25, maxX: 25, minY: -15, maxY: 15 };

const snapshot: MatchSnapshot = {
  phase: "lobby",
  mode: "team-versus",
  worldBounds: standardWorldBounds,
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
        maxFunctionLength: request.maxFunctionLength ?? 50,
        damagePerHit: request.damagePerHit ?? defaultLobbyGameplaySettings.damagePerHit,
        craterRadius: request.craterRadius ?? defaultLobbyGameplaySettings.craterRadius,
        uniqueFunctionHits: request.uniqueFunctionHits ?? defaultLobbyGameplaySettings.uniqueFunctionHits,
        friendlyFire: request.friendlyFire ?? defaultLobbyGameplaySettings.friendlyFire,
        advancedFunctions: request.advancedFunctions ?? defaultLobbyGameplaySettings.advancedFunctions,
        functionPreview: request.functionPreview ?? defaultLobbyGameplaySettings.functionPreview,
        createdAt: "2026-07-05T00:00:00.000Z"
      },
      session: {
        guildId,
        roomId,
        discordUserId: request.leaderDiscordUserId,
        playerId: request.leaderDiscordUserId,
        alias: request.alias,
        color: request.color ?? defaultPlayerColor,
        slot: request.initialSlot,
        sessionToken: "session-token"
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
        maxFunctionLength: 50,
        ...defaultLobbyGameplaySettings,
        createdAt: "2026-07-05T00:00:00.000Z"
      },
      session: {
        guildId,
        roomId: requestedRoomId,
        discordUserId: request.discordUserId,
        playerId: request.discordUserId,
        alias: request.alias,
        color: request.color ?? defaultPlayerColor,
        slot: request.slot,
        sessionToken: "join-session-token"
      }
    }),
    getSettings: async (guildId) => ({ guildId, defaultMode: "team-versus", allowSpectators: true }),
    saveSettings: async (settings) => settings,
    getLeaderboard: async () => [],
    listCustomMaps: async () => [],
    saveCustomMap: async (guildId, request) => ({
      id: "map-1",
      guildId,
      ownerDiscordUserId: request.ownerDiscordUserId,
      name: request.map.name,
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z"
    }),
    deleteCustomMap: async () => {}
  };
}

async function selectLobby(store: ReturnType<typeof createGameStore>): Promise<void> {
  await store.getState().createLobby({
    name: "Local Test",
    alias: session.defaultAlias,
    mode: "team-versus",
    initialSlot: "player",
    color: defaultPlayerColor,
    maxFunctionLength: 50,
    ...defaultLobbyGameplaySettings
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
    const createLobbyCalls: Array<{
      guildId: string;
      request: Parameters<LobbyApi["createLobby"]>[1];
    }> = [];
    const createdLobby = {
      guildId: "local-guild",
      roomId: "room-1",
      name: "Friday Graphwar",
      mode: "team-versus" as const,
      status: "open" as const,
      leaderDiscordUserId: "alice-id",
      occupants: [],
      canStart: false,
      maxFunctionLength: 50,
      ...defaultLobbyGameplaySettings,
      createdAt: "2026-07-05T00:00:00.000Z"
    };
    const selectedLobbySession = {
      guildId: "local-guild",
      roomId: "room-1",
      discordUserId: "alice-id",
      playerId: "alice-id",
      alias: "Alice",
      avatarUrl: "https://cdn.example/alice.png",
      color: defaultPlayerColor,
      slot: "player" as const,
      sessionToken: "alice-session"
    };
    let connectOptions: ConnectGameClientOptions | undefined;
    let onOpen: (() => void) | undefined;
    const store = createGameStore({
      session: {
        ...session,
        guildId: "local-guild",
        discordUserId: "alice-id",
        playerId: "alice-id",
        defaultAlias: "Alice",
        avatarUrl: "https://cdn.example/alice.png",
        serverUrl: "ws://graphwar.test:8787"
      },
      lobbyApi: {
        createLobby: async (guildId, request) => {
          createLobbyCalls.push({ guildId, request });
          return {
            lobby: createdLobby,
            session: selectedLobbySession
          };
        },
        listLobbies: async () => [],
        joinLobby: async () => {
          throw new Error("not used");
        },
        getSettings: async () => ({ guildId: "local-guild", defaultMode: "team-versus", allowSpectators: true }),
        saveSettings: async (settings) => settings,
        getLeaderboard: async () => [],
        listCustomMaps: async () => [],
        saveCustomMap: async () => {
          throw new Error("not used");
        },
        deleteCustomMap: async () => {
          throw new Error("not used");
        }
      },
      clientFactory: (options) => {
        connectOptions = options;
        onOpen = options.onOpen;
        return { send: (command) => commands.push(command), close: () => {} };
      }
    });

    await store.getState().createLobby({
      name: "Friday Graphwar",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 64,
      ...defaultLobbyGameplaySettings,
      mapSizePreset: "huge"
    });
    onOpen?.();

    expect(store.getState().view).toBe("lobby-setup");
    expect(createLobbyCalls).toEqual([
      {
        guildId: "local-guild",
        request: {
          name: "Friday Graphwar",
          leaderDiscordUserId: "alice-id",
          alias: "Alice",
          avatarUrl: "https://cdn.example/alice.png",
          mode: "team-versus",
          initialSlot: "player",
          color: defaultPlayerColor,
          maxFunctionLength: 64,
          ...defaultLobbyGameplaySettings,
          mapSizePreset: "huge"
        }
      }
    ]);
    expect(store.getState().currentLobby).toEqual(createdLobby);
    expect(store.getState().selectedLobbySession).toEqual(selectedLobbySession);
    expect(connectOptions).toEqual(
      expect.objectContaining({
        guildId: "local-guild",
        roomId: "room-1",
        serverUrl: "ws://graphwar.test:8787"
      })
    );
    expect(commands).toEqual([
      {
        type: "join-room",
        guildId: "local-guild",
        roomId: "room-1",
        playerId: "alice-id",
        discordUserId: "alice-id",
        alias: "Alice",
        avatarUrl: "https://cdn.example/alice.png",
        displayName: "Alice",
        slot: "player",
        sessionToken: "alice-session"
      }
    ]);
  });

  it("passes the selected color and avatar when joining a lobby", async () => {
    const joinLobbyCalls: Array<Parameters<LobbyApi["joinLobby"]>> = [];
    const store = createGameStore({
      session: {
        ...session,
        avatarUrl: "https://cdn.example/alice.png"
      },
      lobbyApi: {
        ...lobbyApiFor("room-join"),
        joinLobby: async (guildId, roomId, request) => {
          joinLobbyCalls.push([guildId, roomId, request]);
          return lobbyApiFor("room-join").joinLobby(guildId, roomId, request);
        }
      },
      clientFactory: () => ({ send: () => {}, close: () => {} })
    });

    await store.getState().joinLobby("room-join", {
      alias: "Bob",
      slot: "player",
      color: playerColorPalette[2]
    });

    expect(joinLobbyCalls[0]?.[2]).toMatchObject({
      color: playerColorPalette[2],
      avatarUrl: "https://cdn.example/alice.png"
    });
    expect(store.getState().selectedLobbySession?.avatarUrl).toBe("https://cdn.example/alice.png");
  });

  it("passes the selected custom map id when creating a lobby", async () => {
    const createLobbyCalls: Array<Parameters<LobbyApi["createLobby"]>> = [];
    const store = createGameStore({
      session,
      lobbyApi: {
        ...lobbyApiFor("room-map"),
        createLobby: async (guildId, request) => {
          createLobbyCalls.push([guildId, request]);
          return lobbyApiFor("room-map").createLobby(guildId, request);
        }
      },
      clientFactory: () => ({ send: () => {}, close: () => {} })
    });

    await store.getState().createLobby({
      name: "Custom Map Lobby",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      ...defaultLobbyGameplaySettings,
      mapId: "map-1"
    });

    expect(createLobbyCalls[0]?.[1]).toMatchObject({ mapId: "map-1" });
  });

  it("passes the selected default-map size preset when creating a lobby without a custom map", async () => {
    const createLobbyCalls: Array<Parameters<LobbyApi["createLobby"]>> = [];
    const store = createGameStore({
      session,
      lobbyApi: {
        ...lobbyApiFor("room-map-size"),
        createLobby: async (guildId, request) => {
          createLobbyCalls.push([guildId, request]);
          return lobbyApiFor("room-map-size").createLobby(guildId, request);
        }
      },
      clientFactory: () => ({ send: () => {}, close: () => {} })
    });

    await store.getState().createLobby({
      name: "Huge Default Map Lobby",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      ...defaultLobbyGameplaySettings,
      mapSizePreset: "huge"
    });

    expect(createLobbyCalls[0]?.[1]).toMatchObject({ mapSizePreset: "huge" });
  });

  it("passes phase 2 gameplay settings when creating lobbies", async () => {
    const createLobbyCalls: Array<Parameters<LobbyApi["createLobby"]>> = [];
    const store = createGameStore({
      session,
      lobbyApi: {
        ...lobbyApiFor("room-rules"),
        createLobby: async (guildId, request) => {
          createLobbyCalls.push([guildId, request]);
          return lobbyApiFor("room-rules").createLobby(guildId, request);
        }
      },
      clientFactory: () => ({ send: () => {}, close: () => {} })
    });

    await store.getState().createLobby({
      name: "Rules Room",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      damagePerHit: 80,
      craterRadius: 2.5,
      uniqueFunctionHits: false,
      friendlyFire: true,
      advancedFunctions: true,
      functionPreview: false
    });

    expect(createLobbyCalls[0]).toEqual([
      session.guildId,
      expect.objectContaining({
        damagePerHit: 80,
        craterRadius: 2.5,
        uniqueFunctionHits: false,
        friendlyFire: true,
        advancedFunctions: true,
        functionPreview: false
      })
    ]);
  });

  it("drops map size presets when creating a lobby with a custom map", async () => {
    const createLobbyCalls: Array<Parameters<LobbyApi["createLobby"]>> = [];
    const store = createGameStore({
      session,
      lobbyApi: {
        ...lobbyApiFor("room-custom-map"),
        createLobby: async (guildId, request) => {
          createLobbyCalls.push([guildId, request]);
          return lobbyApiFor("room-custom-map").createLobby(guildId, request);
        }
      },
      clientFactory: () => ({ send: () => {}, close: () => {} })
    });

    await store.getState().createLobby({
      name: "Custom Map Lobby",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      ...defaultLobbyGameplaySettings,
      mapId: "map-1",
      mapSizePreset: "huge"
    });

    expect(createLobbyCalls[0]?.[1]).toEqual(expect.not.objectContaining({ mapSizePreset: expect.anything() }));
  });

  it("loads, saves, and deletes custom maps for the current session user", async () => {
    const calls: string[] = [];
    const store = createGameStore({
      session,
      lobbyApi: {
        ...lobbyApiFor(),
        listCustomMaps: async (guildId) => {
          calls.push(`list:${guildId}`);
          return [
            {
              id: "map-1",
              guildId,
              ownerDiscordUserId: "alice",
              name: "Imported Arena",
              createdAt: "2026-07-05T00:00:00.000Z",
              updatedAt: "2026-07-05T00:00:00.000Z"
            }
          ];
        },
        saveCustomMap: async (guildId, request) => {
          calls.push(`save:${guildId}:${request.ownerDiscordUserId}:${request.map.name}`);
          return {
            id: "map-2",
            guildId,
            ownerDiscordUserId: request.ownerDiscordUserId,
            name: request.map.name,
            createdAt: "2026-07-05T00:00:00.000Z",
            updatedAt: "2026-07-05T00:00:00.000Z"
          };
        },
        deleteCustomMap: async (guildId, mapId, actorDiscordUserId) => {
          calls.push(`delete:${guildId}:${mapId}:${actorDiscordUserId}`);
        }
      },
      clientFactory: () => ({ send: () => {}, close: () => {} })
    });

    await store.getState().loadCustomMaps();
    await store.getState().saveCustomMap({
      format: "graphwar-map",
      version: 1,
      name: "Saved Arena",
      terrain: { blobs: [] },
      spawnPoints: Array.from({ length: 10 }, (_, index) => ({ id: `spawn-${index}`, position: { x: index, y: 0 } })),
      teamSpawnPointIds: {
        "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
        "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
      }
    });
    await store.getState().deleteCustomMap("map-1");

    expect(calls).toEqual([
      "list:local-guild",
      "save:local-guild:alice:Saved Arena",
      "delete:local-guild:map-1:alice"
    ]);
    expect(store.getState().customMaps.map((map) => map.name)).toEqual(["Saved Arena"]);
  });

  it("reconnects to a newly selected lobby when already connected", async () => {
    const commands: ClientCommand[] = [];
    const closedRooms: string[] = [];
    const connectOptions: ConnectGameClientOptions[] = [];
    let createCount = 0;
    let onOpen: (() => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: {
        ...lobbyApiFor(),
        createLobby: async (guildId, request) => {
          createCount += 1;
          const roomId = `room-${createCount}`;
          return {
            lobby: {
              guildId,
              roomId,
              name: request.name,
              mode: request.mode,
              status: "open",
              leaderDiscordUserId: request.leaderDiscordUserId,
              occupants: [],
              canStart: false,
              maxFunctionLength: request.maxFunctionLength ?? 50,
              damagePerHit: request.damagePerHit ?? defaultLobbyGameplaySettings.damagePerHit,
              craterRadius: request.craterRadius ?? defaultLobbyGameplaySettings.craterRadius,
              uniqueFunctionHits: request.uniqueFunctionHits ?? defaultLobbyGameplaySettings.uniqueFunctionHits,
              friendlyFire: request.friendlyFire ?? defaultLobbyGameplaySettings.friendlyFire,
              advancedFunctions: request.advancedFunctions ?? defaultLobbyGameplaySettings.advancedFunctions,
              functionPreview: request.functionPreview ?? defaultLobbyGameplaySettings.functionPreview,
              createdAt: "2026-07-05T00:00:00.000Z"
            },
            session: {
              guildId,
              roomId,
              discordUserId: request.leaderDiscordUserId,
              playerId: request.leaderDiscordUserId,
              alias: request.alias,
              color: request.color ?? defaultPlayerColor,
              slot: request.initialSlot,
              sessionToken: `session-${createCount}`
            }
          };
        }
      },
      clientFactory: (options) => {
        connectOptions.push(options);
        onOpen = options.onOpen;
        return {
          send: (command) => commands.push(command),
          close: () => closedRooms.push(options.roomId)
        };
      }
    });

    await store.getState().createLobby({
      name: "First Lobby",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      ...defaultLobbyGameplaySettings
    });
    onOpen?.();
    await store.getState().createLobby({
      name: "Second Lobby",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      ...defaultLobbyGameplaySettings
    });
    onOpen?.();

    expect(connectOptions.map((options) => options.roomId)).toEqual(["room-1", "room-2"]);
    expect(closedRooms).toEqual(["room-1"]);
    expect(commands.filter((command) => command.type === "join-room").map((command) => command.roomId)).toEqual([
      "room-1",
      "room-2"
    ]);
    expect(store.getState().selectedLobbySession?.roomId).toBe("room-2");
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
        slot: "player",
        sessionToken: "session-token"
      }
    ]);
  });

  it("sends team placement and auto-assign commands for the selected lobby", async () => {
    const commands: ClientCommand[] = [];
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: () => ({
        send: (command) => commands.push(command),
        close: () => {}
      })
    });

    await selectLobby(store);
    store.getState().setTeam("bob", "spectator");
    store.getState().autoAssignTeams();

    expect(commands).toEqual([
      {
        type: "set-team",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        targetPlayerId: "bob",
        placement: "spectator",
        sessionToken: "session-token"
      },
      {
        type: "auto-assign-teams",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        sessionToken: "session-token"
      }
    ]);
  });

  it("sends a cancel-lobby command for the selected lobby", async () => {
    const commands: ClientCommand[] = [];
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: () => ({
        send: (command) => commands.push(command),
        close: () => {}
      })
    });

    await selectLobby(store);
    store.getState().cancelLobby();

    expect(commands).toEqual([
      {
        type: "cancel-lobby",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        sessionToken: "session-token"
      }
    ]);
  });

  it("returns to the main menu when the selected lobby is cancelled", async () => {
    let closed = false;
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: lobbyApiFor(),
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: () => {},
          close: () => {
            closed = true;
          }
        };
      }
    });

    await selectLobby(store);
    const cancelledLobby = {
      ...store.getState().currentLobby!,
      status: "ended" as const,
      canStart: false,
      startBlockedReason: "Lobby has ended."
    };

    onEvent?.({ type: "lobby-cancelled", guildId: "local-guild", roomId: "local-test", lobby: cancelledLobby });

    expect(closed).toBe(true);
    expect(store.getState().view).toBe("main-menu");
    expect(store.getState().currentLobby).toBeUndefined();
    expect(store.getState().selectedLobbySession).toBeUndefined();
    expect(store.getState().snapshot).toBeUndefined();
    expect(store.getState().recentEvents.map((event) => event.type)).toEqual(["lobby-cancelled"]);
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
      {
        type: "select-mode",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        mode: "free-for-all",
        sessionToken: "session-token"
      },
      {
        type: "start-match",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        sessionToken: "session-token"
      },
      {
        type: "submit-shot",
        guildId: "local-guild",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal",
        aimDirection: "west",
        expression: "sin(x)",
        sessionToken: "session-token"
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

  it("returns to the main menu and clears active lobby state", async () => {
    let closed = false;
    let onEvent: ((event: ServerEvent) => void) | undefined;
    const store = createGameStore({
      session,
      lobbyApi: {
        ...lobbyApiFor(),
        listLobbies: async () => [
          {
            guildId: "local-guild",
            roomId: "listed-room",
            name: "Listed Lobby",
            mode: "team-versus",
            status: "open",
            leaderAlias: "Alice",
            leaderDiscordUserId: "alice",
            playerCount: 1,
            spectatorCount: 0,
            ...defaultLobbyGameplaySettings,
            createdAt: "2026-07-05T00:00:00.000Z"
          }
        ],
        getLeaderboard: async () => [
          {
            guildId: "local-guild",
            discordUserId: "alice",
            lastAlias: "Alice",
            gamesPlayed: 4,
            wins: 3,
            eliminations: 2,
            damageDealt: 120,
            updatedAt: "2026-07-05T00:00:00.000Z"
          }
        ]
      },
      clientFactory: (options) => {
        onEvent = options.onEvent;
        return {
          send: () => {},
          close: () => {
            closed = true;
            options.onClose?.();
          }
        };
      }
    });

    await store.getState().loadSettings();
    await store.getState().loadLobbies();
    await store.getState().loadLeaderboard();
    const preserved = {
      settings: store.getState().settings,
      lobbies: store.getState().lobbies,
      leaderboard: store.getState().leaderboard,
      session: store.getState().session
    };

    await selectLobby(store);
    onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });
    onEvent?.({ type: "shot-rejected", roomId: "local-test", playerId: "alice", reason: "Player is not active" });
    store.getState().submitShot(" ", "east");

    store.getState().returnToMenu();

    expect(closed).toBe(true);
    expect(store.getState()).toMatchObject({
      view: "main-menu",
      connectionStatus: "closed",
      currentLobby: undefined,
      selectedLobbySession: undefined,
      snapshot: undefined,
      recentEvents: [],
      lastError: undefined,
      lastRejection: undefined,
      settings: preserved.settings,
      lobbies: preserved.lobbies,
      leaderboard: preserved.leaderboard,
      session: preserved.session
    });
  });
});
