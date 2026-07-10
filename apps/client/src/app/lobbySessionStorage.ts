import type { PlayerColor } from "@graphwar/shared";

export type LobbySessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LobbySessionScope = {
  guildId: string;
  discordUserId: string;
};

export type PersistedSelectedLobbySession = {
  guildId: string;
  roomId: string;
  discordUserId: string;
  playerId: string;
  alias: string;
  avatarUrl?: string;
  color: PlayerColor;
  slot: "player" | "spectator";
  sessionToken: string;
};

const selectedLobbySessionKeyPrefix = "graphwar.selectedLobbySession";

function selectedLobbySessionKey(scope: LobbySessionScope): string {
  return `${selectedLobbySessionKeyPrefix}:${scope.guildId}:${scope.discordUserId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPersistedSelectedLobbySession(value: unknown, scope: LobbySessionScope): value is PersistedSelectedLobbySession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.guildId === scope.guildId &&
    value.discordUserId === scope.discordUserId &&
    typeof value.roomId === "string" &&
    typeof value.playerId === "string" &&
    typeof value.alias === "string" &&
    (value.avatarUrl === undefined || typeof value.avatarUrl === "string") &&
    typeof value.color === "string" &&
    (value.slot === "player" || value.slot === "spectator") &&
    typeof value.sessionToken === "string"
  );
}

export function readBrowserLobbySessionStorage(): LobbySessionStorage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function saveSelectedLobbySession(
  storage: LobbySessionStorage | undefined,
  scope: LobbySessionScope,
  selected: PersistedSelectedLobbySession
): void {
  try {
    storage?.setItem(selectedLobbySessionKey(scope), JSON.stringify(selected));
  } catch {
    // Browser storage can be unavailable; reconnect still works for the current page session.
  }
}

export function readSelectedLobbySession(
  storage: LobbySessionStorage | undefined,
  scope: LobbySessionScope
): PersistedSelectedLobbySession | undefined {
  try {
    const raw = storage?.getItem(selectedLobbySessionKey(scope));
    if (!raw) {
      return undefined;
    }

    const parsed: unknown = JSON.parse(raw);
    return isPersistedSelectedLobbySession(parsed, scope) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function clearSelectedLobbySession(
  storage: LobbySessionStorage | undefined,
  scope: LobbySessionScope
): void {
  try {
    storage?.removeItem(selectedLobbySessionKey(scope));
  } catch {
    // Clearing is best-effort because private browser contexts can deny storage access.
  }
}
