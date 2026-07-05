import type { AimDirectionId, ClientCommand, MatchModeId, MatchSnapshot, ServerEvent } from "@graphwar/shared";
import { create } from "zustand";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import { connectGameClient, type ConnectGameClientOptions, type GameClient } from "../networking/gameClient";
import { readLocalSession, type ClientSession } from "../sessions/localSession";

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "reconnecting" | "error";

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
  clearLog(): void;
  connect(): void;
  connectionStatus: ConnectionStatus;
  disconnect(): void;
  joinRoom(): void;
  lastError?: string;
  lastRejection?: CommandRejection;
  log: GameLogEntry[];
  recentEvents: ServerEvent[];
  selectMode(mode: MatchModeId): void;
  session: ClientSession;
  snapshot?: MatchSnapshot;
  startMatch(): void;
  submitShot(expression: string, aimDirection: AimDirectionId): void;
};

export type CreateGameStoreOptions = {
  clientFactory?: GameClientFactory;
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

    function handleEvent(event: ServerEvent): void {
      set((state) => ({
        lastRejection:
          event.type === "shot-rejected" ? { playerId: event.playerId, reason: event.reason } : undefined,
        lastError: event.type === "shot-rejected" ? state.lastError : undefined,
        recentEvents: [...state.recentEvents, event].slice(-logLimit),
        snapshot: applyEventToSnapshot(state.snapshot, event)
      }));
      appendLog(describeEvent(event), event.type);
    }

    return {
      clearLog() {
        set({ log: [], recentEvents: [] });
      },
      connect() {
        const status = get().connectionStatus;
        if (client && (status === "connecting" || status === "open" || status === "reconnecting")) {
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
            roomId: session.roomId,
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
      disconnect() {
        connectionId += 1;
        const currentClient = client;
        client = undefined;
        currentClient?.close();
        set({ connectionStatus: "closed", lastRejection: undefined });
        appendLog("Disconnected.");
      },
      joinRoom() {
        sendCommand({
          type: "join-room",
          roomId: session.roomId,
          playerId: session.playerId,
          displayName: session.displayName
        });
      },
      log: [],
      recentEvents: [],
      selectMode(mode) {
        sendCommand({ type: "select-mode", roomId: session.roomId, playerId: session.playerId, mode });
      },
      session,
      startMatch() {
        sendCommand({ type: "start-match", roomId: session.roomId, playerId: session.playerId });
      },
      submitShot(expression, aimDirection) {
        const trimmedExpression = expression.trim();
        if (!trimmedExpression) {
          const message = "Enter a function before submitting a shot.";
          set({ lastError: message, lastRejection: undefined });
          appendLog(message);
          return;
        }

        sendCommand({
          type: "submit-shot",
          roomId: session.roomId,
          playerId: session.playerId,
          functionFamilyId: "normal",
          aimDirection,
          expression: trimmedExpression
        });
      }
    };
  };
}

export function createGameStore(options: CreateGameStoreOptions = {}): StoreApi<GameStoreState> {
  return createStore<GameStoreState>()(createGameState(options));
}

export const useGameStore = create<GameStoreState>()(createGameState());
