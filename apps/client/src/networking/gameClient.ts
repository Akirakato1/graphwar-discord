import { serverEventSchema, type ClientCommand, type ServerEvent } from "@graphwar/shared";

export type WebSocketLike = {
  readonly readyState: number;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "close", listener: () => void): void;
  addEventListener(type: "error", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  close(): void;
  send(data: string): void;
};

export type WebSocketConstructor = {
  readonly OPEN?: number;
  new (url: string): WebSocketLike;
};

export type GameClient = {
  close(): void;
  send(command: ClientCommand): void;
};

export type ConnectGameClientOptions = {
  roomId: string;
  serverUrl?: string;
  locationHref?: string;
  webSocketCtor?: WebSocketConstructor;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  onClose?: () => void;
  onError?: (message: string) => void;
  onEvent: (event: ServerEvent) => void;
  onOpen?: () => void;
  onReconnect?: () => void;
};

function readLocationHref(): string {
  if (typeof window !== "undefined") {
    return window.location.href;
  }

  return "http://localhost:5173/";
}

function readWebSocketConstructor(): WebSocketConstructor {
  if (typeof WebSocket === "undefined") {
    throw new Error("WebSocket is not available in this runtime");
  }

  return WebSocket;
}

function normalizeServerUrl(serverUrl: string): string {
  try {
    const url = new URL(serverUrl);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
    }
    if (url.protocol === "https:") {
      url.protocol = "wss:";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return serverUrl.replace(/\/+$/, "");
  }
}

export function buildRoomWebSocketUrl(roomId: string, serverUrl?: string, locationHref = readLocationHref()): string {
  const baseUrl = serverUrl
    ? normalizeServerUrl(serverUrl)
    : `ws://${new URL(locationHref, "http://localhost:5173/").hostname}:8787`;

  return `${baseUrl}/rooms/${encodeURIComponent(roomId)}`;
}

export function connectGameClient(options: ConnectGameClientOptions): GameClient {
  const WebSocketCtor = options.webSocketCtor ?? readWebSocketConstructor();
  const openState = WebSocketCtor.OPEN ?? 1;
  const reconnectDelayMs = options.reconnectDelayMs ?? 750;
  const url = buildRoomWebSocketUrl(options.roomId, options.serverUrl, options.locationHref);
  const pendingPayloads: string[] = [];
  let manualClose = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let socket: WebSocketLike | undefined;

  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  }

  function flushPendingPayloads(): void {
    while (socket?.readyState === openState && pendingPayloads.length > 0) {
      socket.send(pendingPayloads.shift() ?? "");
    }
  }

  function reportError(message: string): void {
    options.onError?.(message);
  }

  function handleMessage(message: { data: unknown }): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(message.data));
    } catch (error) {
      reportError(`Invalid server JSON: ${error instanceof Error ? error.message : "parse failed"}`);
      return;
    }

    const result = serverEventSchema.safeParse(parsed);
    if (!result.success) {
      reportError(`Invalid server event: ${result.error.message}`);
      return;
    }

    options.onEvent(result.data);
  }

  function openSocket(isReconnect = false): void {
    if (isReconnect) {
      options.onReconnect?.();
    }

    socket = new WebSocketCtor(url);
    socket.addEventListener("open", () => {
      flushPendingPayloads();
      options.onOpen?.();
    });
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", () => {
      reportError("WebSocket error");
    });
    socket.addEventListener("close", () => {
      options.onClose?.();
      if (!manualClose && options.reconnect) {
        clearReconnectTimer();
        reconnectTimer = setTimeout(() => openSocket(true), reconnectDelayMs);
      }
    });
  }

  openSocket();

  return {
    close() {
      manualClose = true;
      clearReconnectTimer();
      socket?.close();
    },
    send(command) {
      const payload = JSON.stringify(command);
      if (socket?.readyState === openState) {
        socket.send(payload);
        return;
      }

      pendingPayloads.push(payload);
    }
  };
}
