import {
  createLobbyRequestSchema,
  customMapSummarySchema,
  guildSettingsSchema,
  joinLobbyRequestSchema,
  lobbyJoinResultSchema,
  lobbySummarySchema,
  playerStatsEntrySchema,
  saveCustomMapRequestSchema,
  type CreateLobbyRequest,
  type CustomMapSummary,
  type GuildSettings,
  type JoinLobbyRequest,
  type LobbyJoinResult,
  type LobbySummary,
  type PlayerStatsEntry,
  type SaveCustomMapRequest
} from "@graphwar/shared";

export type LobbyApi = ReturnType<typeof createLobbyApi>;

function httpBase(serverUrl: string | undefined, locationHref?: string): string {
  if (serverUrl) {
    return serverUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/+$/, "");
  }

  const href = locationHref ?? (typeof window !== "undefined" ? window.location.href : "http://localhost:5173/");
  const url = new URL(href, "http://localhost:5173/");
  return `http://${url.hostname}:8787`;
}

function errorMessageFromPayload(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return "Request failed.";
}

async function readJson<T>(response: Response, parse: (value: unknown) => T): Promise<T> {
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const error = new Error(errorMessageFromPayload(payload));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const payload = await response.json();
  return parse(payload);
}

async function readEmpty(response: Response): Promise<void> {
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const error = new Error(errorMessageFromPayload(payload));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
}

export function createLobbyApi(serverUrl?: string, locationHref?: string) {
  const base = httpBase(serverUrl, locationHref);
  return {
    async listLobbies(guildId: string): Promise<LobbySummary[]> {
      const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/lobbies`);
      return readJson(response, (value) => lobbySummarySchema.array().parse(value));
    },
    async createLobby(guildId: string, request: CreateLobbyRequest): Promise<LobbyJoinResult> {
      const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/lobbies`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createLobbyRequestSchema.parse(request))
      });
      return readJson(response, (value) => lobbyJoinResultSchema.parse(value));
    },
    async joinLobby(guildId: string, roomId: string, request: JoinLobbyRequest): Promise<LobbyJoinResult> {
      const response = await fetch(
        `${base}/guilds/${encodeURIComponent(guildId)}/lobbies/${encodeURIComponent(roomId)}/join`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(joinLobbyRequestSchema.parse(request))
        }
      );
      return readJson(response, (value) => lobbyJoinResultSchema.parse(value));
    },
    async getSettings(guildId: string): Promise<GuildSettings> {
      const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/settings`);
      return readJson(response, (value) => guildSettingsSchema.parse(value));
    },
    async saveSettings(settings: GuildSettings): Promise<GuildSettings> {
      const response = await fetch(`${base}/guilds/${encodeURIComponent(settings.guildId)}/settings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings)
      });
      return readJson(response, (value) => guildSettingsSchema.parse(value));
    },
    async getLeaderboard(guildId: string): Promise<PlayerStatsEntry[]> {
      const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/leaderboard`);
      return readJson(response, (value) => playerStatsEntrySchema.array().parse(value));
    },
    async listCustomMaps(guildId: string): Promise<CustomMapSummary[]> {
      const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/maps`);
      return readJson(response, (value) => customMapSummarySchema.array().parse(value));
    },
    async saveCustomMap(guildId: string, request: SaveCustomMapRequest): Promise<CustomMapSummary> {
      const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/maps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saveCustomMapRequestSchema.parse(request))
      });
      return readJson(response, (value) => customMapSummarySchema.parse(value));
    },
    async deleteCustomMap(guildId: string, mapId: string, actorDiscordUserId: string): Promise<void> {
      const response = await fetch(
        `${base}/guilds/${encodeURIComponent(guildId)}/maps/${encodeURIComponent(mapId)}?actorDiscordUserId=${encodeURIComponent(actorDiscordUserId)}`,
        { method: "DELETE" }
      );
      await readEmpty(response);
    }
  };
}
