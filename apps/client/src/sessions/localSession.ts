import { avatarUrlInputSchema } from "@graphwar/shared";

export type ClientSession = {
  guildId: string;
  discordUserId: string;
  playerId: string;
  defaultAlias: string;
  roomId?: string;
  displayName: string;
  avatarUrl?: string;
  serverUrl?: string;
  source: "local" | "discord";
};

export type LocalSessionStorage = Pick<Storage, "getItem" | "setItem">;

const localPlayerIdKey = "graphwar.localPlayerId";
let fallbackPlayerId: string | undefined;

function readCurrentHref(): string {
  if (typeof window !== "undefined") {
    return window.location.href;
  }

  return "http://localhost:5173/";
}

function readBrowserStorage(): LocalSessionStorage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function readParam(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

function createLocalPlayerId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && "randomUUID" in cryptoApi) {
    return `local-${cryptoApi.randomUUID().slice(0, 8)}`;
  }

  return `local-${Math.random().toString(36).slice(2, 10)}`;
}

function readStableLocalPlayerId(storage: LocalSessionStorage | undefined): string {
  const storedPlayerId = storage?.getItem(localPlayerIdKey)?.trim();
  if (storedPlayerId) {
    fallbackPlayerId = storedPlayerId;
    return storedPlayerId;
  }

  fallbackPlayerId ??= createLocalPlayerId();
  try {
    storage?.setItem(localPlayerIdKey, fallbackPlayerId);
  } catch {
    // Local storage can be unavailable in private windows; the module fallback still stays stable for this page load.
  }
  return fallbackPlayerId;
}

export function readLocalSession(href = readCurrentHref(), storage = readBrowserStorage()): ClientSession {
  const url = new URL(href, "http://localhost:5173/");
  const guildId = readParam(url, "guild") ?? "local-guild";
  const discordUserId = readParam(url, "user") ?? readParam(url, "mockPlayer") ?? readStableLocalPlayerId(storage);
  const defaultAlias = readParam(url, "displayName") ?? discordUserId;
  const roomId = readParam(url, "room");
  const avatarUrl = avatarUrlInputSchema.parse(readParam(url, "avatar"));
  const serverUrl = readParam(url, "server");

  return {
    guildId,
    discordUserId,
    playerId: discordUserId,
    defaultAlias,
    displayName: defaultAlias,
    ...(roomId ? { roomId } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(serverUrl ? { serverUrl } : {}),
    source: "local"
  };
}
