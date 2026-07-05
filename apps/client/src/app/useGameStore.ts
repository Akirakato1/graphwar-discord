import type {
  AimDirectionId,
  ClientCommand,
  CustomMapImport,
  CustomMapSummary,
  GuildSettings,
  LobbyPlacementId,
  LobbyRuntimeSnapshot,
  LobbySlot,
  LobbySummary,
  MatchModeId,
  MatchSnapshot,
  PlayerColor,
  PlayerStatsEntry,
  ServerEvent
} from "@graphwar/shared";
import { create } from "zustand";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import { connectGameClient, type ConnectGameClientOptions, type GameClient } from "../networking/gameClient";
import { createLobbyApi, type LobbyApi } from "../networking/lobbyApi";
import { readLocalSession, type ClientSession } from "../sessions/localSession";

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "reconnecting" | "error";

export type AppView =
  | "main-menu"
  | "create-lobby"
  | "custom-maps"
  | "join-lobby"
  | "settings"
  | "leaderboard"
  | "lobby-setup"
  | "game";

export type SelectedLobbySession = {
  guildId: string;
  roomId: string;
  discordUserId: string;
  playerId: string;
  alias: string;
  color: PlayerColor;
  slot: "player" | "spectator";
  sessionToken: string;
};

export type GameLogEntry = {
  id: number;
  message: string;
  eventType?: ServerEvent["type"];
};

export type CommandRejection = {
  playerId: string;
  reason: string;
};

export type GameClientFactory = (options: ConnectGameClientOptions) => GameClient;

export type GameStoreState = {
  autoAssignTeams(): void;
  clearLog(): void;
  connect(): void;
  connectionStatus: ConnectionStatus;
  createLobby(form: {
    name: string;
    alias: string;
    mode: MatchModeId;
    initialSlot: LobbySlot;
    color: PlayerColor;
    maxFunctionLength: number;
    mapId?: string;
  }): Promise<void>;
  customMaps: CustomMapSummary[];
  currentLobby?: LobbyRuntimeSnapshot;
  deleteCustomMap(mapId: string): Promise<void>;
  disconnect(): void;
  joinRoom(): void;
  joinLobby(roomId: string, form: { alias: string; slot: LobbySlot; color: PlayerColor }): Promise<void>;
  lastError?: string;
  lastRejection?: CommandRejection;
  leaderboard: PlayerStatsEntry[];
  loadLeaderboard(): Promise<void>;
  loadLobbies(): Promise<void>;
  loadCustomMaps(): Promise<void>;
  loadSettings(): Promise<void>;
  log: GameLogEntry[];
  lobbies: LobbySummary[];
  recentEvents: ServerEvent[];
  returnToMenu(): void;
  selectMode(mode: MatchModeId): void;
  selectedLobbySession?: SelectedLobbySession;
  session: ClientSession;
  settings?: GuildSettings;
  saveCustomMap(map: CustomMapImport): Promise<void>;
  saveSettings(settings: GuildSettings): Promise<void>;
  setTeam(targetPlayerId: string, placement: LobbyPlacementId): void;
  setView(view: AppView): void;
  snapshot?: MatchSnapshot;
  startMatch(): void;
  submitShot(expression: string, aimDirection: AimDirectionId): void;
  view: AppView;
};

export type CreateGameStoreOptions = {
  clientFactory?: GameClientFactory;
  lobbyApi?: LobbyApi;
  logLimit?: number;
  session?: ClientSession;
};

function snapshotFromEvent(event: ServerEvent): MatchSnapshot | undefined {
  switch (event.type) {
    case "room-snapshot":
    case "match-started":
    case "shot-resolved":
    case "match-ended":
      return event.snapshot;
    default:
      return undefined;
  }
}

function applyEventToSnapshot(snapshot: MatchSnapshot | undefined, event: ServerEvent): MatchSnapshot | undefined {
  const authoritativeSnapshot = snapshotFromEvent(event);
  if (authoritativeSnapshot) {
    return authoritativeSnapshot;
  }

  if (!snapshot) {
    return undefined;
  }

  switch (event.type) {
    case "terrain-changed":
      return { ...snapshot, terrain: event.terrain };
    case "player-damaged":
      return {
        ...snapshot,
        players: snapshot.players.map((player) =>
          player.id === event.damage.playerId
            ? { ...player, hp: event.damage.hpAfter, alive: event.damage.hpAfter > 0 }
            : player
        )
      };
    case "player-eliminated":
      return {
        ...snapshot,
        players: snapshot.players.map((player) =>
          player.id === event.playerId ? { ...player, hp: 0, alive: false } : player
        )
      };
    case "turn-advanced":
    case "turn-started":
      return {
        ...snapshot,
        turn: { ...snapshot.turn, activePlayerId: event.playerId, turnNumber: event.turnNumber }
      };
    default:
      return snapshot;
  }
}

function describeEvent(event: ServerEvent): string {
  switch (event.type) {
    case "room-snapshot":
      return `Room snapshot received (${event.snapshot.players.length} players).`;
    case "player-joined":
      return `${event.playerId} joined the room.`;
    case "player-left":
      return `${event.playerId} left the room.`;
    case "match-started":
      return `Match started in ${event.snapshot.mode}.`;
    case "turn-started":
      return `Turn ${event.turnNumber}: ${event.playerId} is active.`;
    case "shot-accepted":
      return `${event.playerId}'s shot was accepted.`;
    case "shot-rejected":
      return `${event.playerId}'s command was rejected: ${event.reason}`;
    case "shot-resolved":
      return `${event.shooterId} fired ${event.expression}; impact: ${event.impact.reason}.`;
    case "terrain-changed":
      return "Terrain changed.";
    case "player-damaged":
      return `${event.damage.playerId} took ${event.damage.amount} damage.`;
    case "player-eliminated":
      return `${event.playerId} was eliminated.`;
    case "turn-advanced":
      return `Turn ${event.turnNumber}: ${event.playerId} is active.`;
    case "match-ended":
      return `Match ended. Winners: ${event.winnerIds.join(", ") || "none"}.`;
  }
}

export function createGameState(options: CreateGameStoreOptions = {}): StateCreator<GameStoreState> {
  const session = options.session ?? readLocalSession();
  const clientFactory = options.clientFactory ?? connectGameClient;
  const lobbyApi = options.lobbyApi ?? createLobbyApi(session.serverUrl);
  const logLimit = options.logLimit ?? 30;
  let client: GameClient | undefined;
  let connectionId = 0;
  let logId = 0;

  return (set, get) => {
    function appendLog(message: string, eventType?: ServerEvent["type"]): void {
      set((state) => ({
        log: [...state.log, { id: ++logId, message, ...(eventType ? { eventType } : {}) }].slice(-logLimit)
      }));
    }

    function sendCommand(command: ClientCommand): void {
      set({ lastError: undefined, lastRejection: undefined });

      if (!client) {
        const message = "Connect before sending commands.";
        set({ lastError: message, lastRejection: undefined });
        appendLog(message);
        return;
      }

      client.send(command);
    }

    function selectedRoom(): SelectedLobbySession | undefined {
      const selected = get().selectedLobbySession;
      if (!selected) {
        const message = "Choose or create a lobby before sending commands.";
        set({ lastError: message, lastRejection: undefined });
        appendLog(message);
        return undefined;
      }

      return selected;
    }

    function closeClientForLobbySwitch(): void {
      if (!client) {
        return;
      }

      connectionId += 1;
      const previousClient = client;
      client = undefined;
      previousClient.close();
      set({ connectionStatus: "closed" });
    }

    function handleEvent(event: ServerEvent): void {
      set((state) => ({
        currentLobby: "lobby" in event && event.lobby ? event.lobby : state.currentLobby,
        lastRejection:
          event.type === "shot-rejected" ? { playerId: event.playerId, reason: event.reason } : undefined,
        lastError: event.type === "shot-rejected" ? state.lastError : undefined,
        recentEvents: [...state.recentEvents, event].slice(-logLimit),
        snapshot: applyEventToSnapshot(state.snapshot, event),
        view:
          event.type === "match-started" || ("lobby" in event && event.lobby?.status === "playing")
            ? "game"
            : state.view
      }));
      appendLog(describeEvent(event), event.type);
    }

    return {
      autoAssignTeams() {
        const selected = selectedRoom();
        if (!selected) {
          return;
        }

        sendCommand({
          type: "auto-assign-teams",
          guildId: selected.guildId,
          roomId: selected.roomId,
          playerId: selected.playerId,
          sessionToken: selected.sessionToken
        });
      },
      clearLog() {
        set({ log: [], recentEvents: [] });
      },
      connect() {
        const status = get().connectionStatus;
        if (client && (status === "connecting" || status === "open" || status === "reconnecting")) {
          return;
        }

        const selected = get().selectedLobbySession;
        if (!selected) {
          set({ lastError: "Choose or create a lobby before connecting.", lastRejection: undefined });
          return;
        }

        try {
          const nextConnectionId = connectionId + 1;
          connectionId = nextConnectionId;
          const previousClient = client;
          client = undefined;
          previousClient?.close();

          set({ connectionStatus: "connecting", lastError: undefined, lastRejection: undefined });
          client = clientFactory({
            guildId: selected.guildId,
            roomId: selected.roomId,
            serverUrl: session.serverUrl,
            onClose: () => {
              if (nextConnectionId !== connectionId) {
                return;
              }
              set({ connectionStatus: "closed" });
              appendLog("Connection closed.");
            },
            onError: (message) => {
              if (nextConnectionId !== connectionId) {
                return;
              }
              set({ connectionStatus: "error", lastError: message, lastRejection: undefined });
              appendLog(message);
            },
            onEvent: (event) => {
              if (nextConnectionId !== connectionId) {
                return;
              }
              handleEvent(event);
            },
            onOpen: () => {
              if (nextConnectionId !== connectionId) {
                return;
              }
              set({ connectionStatus: "open", lastError: undefined, lastRejection: undefined });
              get().joinRoom();
            },
            onReconnect: () => {
              if (nextConnectionId !== connectionId) {
                return;
              }
              set({ connectionStatus: "reconnecting" });
              appendLog("Reconnecting to room...");
            },
            reconnect: true
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Connection failed.";
          set({ connectionStatus: "error", lastError: message, lastRejection: undefined });
          appendLog(message);
        }
      },
      connectionStatus: "idle",
      async createLobby(form) {
        try {
          const result = await lobbyApi.createLobby(session.guildId, {
            name: form.name,
            leaderDiscordUserId: session.discordUserId,
            alias: form.alias,
            mode: form.mode,
            initialSlot: form.initialSlot,
            color: form.color,
            maxFunctionLength: form.maxFunctionLength,
            ...(form.mapId ? { mapId: form.mapId } : {})
          });
          closeClientForLobbySwitch();
          set({
            currentLobby: result.lobby,
            selectedLobbySession: result.session,
            view: "lobby-setup",
            lastError: undefined,
            lastRejection: undefined
          });
          get().connect();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not create lobby.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      customMaps: [],
      currentLobby: undefined,
      async deleteCustomMap(mapId) {
        try {
          await lobbyApi.deleteCustomMap(session.guildId, mapId, session.discordUserId);
          set((state) => ({
            customMaps: state.customMaps.filter((map) => map.id !== mapId),
            lastError: undefined,
            lastRejection: undefined
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not delete custom map.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      disconnect() {
        connectionId += 1;
        const currentClient = client;
        client = undefined;
        currentClient?.close();
        set({ connectionStatus: "closed", lastRejection: undefined });
        appendLog("Disconnected.");
      },
      async joinLobby(roomId, form) {
        try {
          const result = await lobbyApi.joinLobby(session.guildId, roomId, {
            discordUserId: session.discordUserId,
            alias: form.alias,
            slot: form.slot,
            color: form.color
          });
          closeClientForLobbySwitch();
          set({
            currentLobby: result.lobby,
            selectedLobbySession: result.session,
            view: "lobby-setup",
            lastError: undefined,
            lastRejection: undefined
          });
          get().connect();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not join lobby.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      joinRoom() {
        const selected = get().selectedLobbySession;
        if (!selected) {
          return;
        }

        sendCommand({
          type: "join-room",
          guildId: selected.guildId,
          roomId: selected.roomId,
          playerId: selected.playerId,
          discordUserId: selected.discordUserId,
          alias: selected.alias,
          displayName: selected.alias,
          slot: selected.slot,
          sessionToken: selected.sessionToken
        });
      },
      leaderboard: [],
      async loadLeaderboard() {
        try {
          const leaderboard = await lobbyApi.getLeaderboard(session.guildId);
          set({ leaderboard, lastError: undefined, lastRejection: undefined });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load leaderboard.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      async loadLobbies() {
        try {
          const lobbies = await lobbyApi.listLobbies(session.guildId);
          set({ lobbies, lastError: undefined, lastRejection: undefined });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load lobbies.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      async loadCustomMaps() {
        try {
          const customMaps = await lobbyApi.listCustomMaps(session.guildId);
          set({ customMaps, lastError: undefined, lastRejection: undefined });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load custom maps.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      async loadSettings() {
        try {
          const settings = await lobbyApi.getSettings(session.guildId);
          set({ settings, lastError: undefined, lastRejection: undefined });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not load settings.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      log: [],
      lobbies: [],
      recentEvents: [],
      returnToMenu() {
        connectionId += 1;
        const currentClient = client;
        client = undefined;
        currentClient?.close();
        set({
          connectionStatus: "closed",
          currentLobby: undefined,
          lastError: undefined,
          lastRejection: undefined,
          recentEvents: [],
          selectedLobbySession: undefined,
          snapshot: undefined,
          view: "main-menu"
        });
      },
      selectMode(mode) {
        const selected = selectedRoom();
        if (!selected) {
          return;
        }

        sendCommand({
          type: "select-mode",
          guildId: selected.guildId,
          roomId: selected.roomId,
          playerId: selected.playerId,
          mode,
          sessionToken: selected.sessionToken
        });
      },
      selectedLobbySession: undefined,
      session,
      settings: undefined,
      async saveCustomMap(map) {
        try {
          const savedMap = await lobbyApi.saveCustomMap(session.guildId, {
            ownerDiscordUserId: session.discordUserId,
            map
          });
          set((state) => ({
            customMaps: [...state.customMaps.filter((existing) => existing.id !== savedMap.id), savedMap],
            lastError: undefined,
            lastRejection: undefined
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not save custom map.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      async saveSettings(settings) {
        try {
          const savedSettings = await lobbyApi.saveSettings(settings);
          set({ settings: savedSettings, lastError: undefined, lastRejection: undefined });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not save settings.";
          set({ lastError: message, lastRejection: undefined });
          throw error;
        }
      },
      setTeam(targetPlayerId, placement) {
        const selected = selectedRoom();
        if (!selected) {
          return;
        }

        sendCommand({
          type: "set-team",
          guildId: selected.guildId,
          roomId: selected.roomId,
          playerId: selected.playerId,
          targetPlayerId,
          placement,
          sessionToken: selected.sessionToken
        });
      },
      setView(view) {
        set({ view, lastError: undefined, lastRejection: undefined });
      },
      startMatch() {
        const selected = selectedRoom();
        if (!selected) {
          return;
        }

        sendCommand({
          type: "start-match",
          guildId: selected.guildId,
          roomId: selected.roomId,
          playerId: selected.playerId,
          sessionToken: selected.sessionToken
        });
      },
      submitShot(expression, aimDirection) {
        const trimmedExpression = expression.trim();
        if (!trimmedExpression) {
          const message = "Enter a function before submitting a shot.";
          set({ lastError: message, lastRejection: undefined });
          appendLog(message);
          return;
        }

        const selected = selectedRoom();
        if (!selected) {
          return;
        }

        sendCommand({
          type: "submit-shot",
          guildId: selected.guildId,
          roomId: selected.roomId,
          playerId: selected.playerId,
          functionFamilyId: "normal",
          aimDirection,
          expression: trimmedExpression,
          sessionToken: selected.sessionToken
        });
      },
      view: "main-menu"
    };
  };
}

export function createGameStore(options: CreateGameStoreOptions = {}): StoreApi<GameStoreState> {
  return createStore<GameStoreState>()(createGameState(options));
}

export const useGameStore = create<GameStoreState>()(createGameState());
