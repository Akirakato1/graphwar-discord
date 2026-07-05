import { resolve } from "node:path";
import type { Duplex } from "node:stream";
import { pathToFileURL } from "node:url";
import {
  createLobbyRequestSchema,
  guildSettingsSchema,
  joinLobbyRequestSchema,
  saveCustomMapRequestSchema
} from "@graphwar/shared";
import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { LobbyDirectory } from "./lobbies/LobbyDirectory";
import { LocalStateStore } from "./persistence/LocalStateStore";
import { RoomManager } from "./rooms/RoomManager";

function terminateWebSocketClients(wss: WebSocketServer): void {
  for (const client of wss.clients) {
    client.terminate();
  }
}

function headerValue(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value ?? fallback;
}

const defaultCorsAllowedOrigins = ["http://127.0.0.1:5173", "http://localhost:5173"];

function readConfiguredCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configuredOrigins = env.GRAPHWAR_CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return Array.from(new Set(configuredOrigins));
  }

  return defaultCorsAllowedOrigins;
}

function rejectWebSocketUpgrade(socket: Duplex, statusCode: number, message: string): void {
  const body = JSON.stringify({ error: message });
  socket.write(
    [
      `HTTP/1.1 ${statusCode} Forbidden`,
      "Connection: close",
      "Content-Type: application/json",
      `Content-Length: ${Buffer.byteLength(body)}`,
      "",
      body
    ].join("\r\n")
  );
  socket.destroy();
}

function parseRoomPath(requestUrl: string | undefined): { guildId: string; roomId: string; guildScoped: boolean } | undefined {
  try {
    const url = new URL(requestUrl ?? "/", "http://localhost");
    const guildMatch = /^\/guilds\/([^/]+)\/rooms\/([^/]+)$/.exec(url.pathname);
    if (guildMatch) {
      return {
        guildId: decodeURIComponent(guildMatch[1]),
        roomId: decodeURIComponent(guildMatch[2]),
        guildScoped: true
      };
    }
    const legacyMatch = /^\/rooms\/([^/]+)$/.exec(url.pathname);
    return legacyMatch
      ? { guildId: "local-guild", roomId: decodeURIComponent(legacyMatch[1]), guildScoped: false }
      : undefined;
  } catch {
    return undefined;
  }
}

export type BuildServerOptions = {
  corsAllowedOrigins?: string[];
  stateStore?: LocalStateStore;
  lobbies?: LobbyDirectory;
  rooms?: RoomManager;
};

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: true });
  const stateStore = options.stateStore ?? new LocalStateStore();
  const lobbies =
    options.lobbies ??
    new LobbyDirectory({
      upsertStatsEntry: (guildId, discordUserId, alias) => stateStore.upsertStatsEntry(guildId, discordUserId, alias)
    });
  const rooms = options.rooms ?? new RoomManager(lobbies, stateStore);
  const wss = new WebSocketServer({ noServer: true });
  const corsAllowedOrigins = new Set(options.corsAllowedOrigins ?? readConfiguredCorsOrigins());

  app.addHook("onRequest", async (request, reply) => {
    const isGuildApiRequest = request.url.startsWith("/guilds/");
    if (!isGuildApiRequest) {
      return;
    }

    const origin = request.headers.origin;
    if (origin && corsAllowedOrigins.has(origin)) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
      reply.header(
        "access-control-allow-headers",
        headerValue(request.headers["access-control-request-headers"], "content-type")
      );
      reply.header("vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      if (origin && !corsAllowedOrigins.has(origin)) {
        return reply.code(403).send({ error: "CORS origin is not allowed." });
      }

      return reply.code(204).send();
    }
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/guilds/:guildId/lobbies", async (request) => {
    const { guildId } = request.params as { guildId: string };
    return lobbies.listLobbies(guildId);
  });

  app.post("/guilds/:guildId/lobbies", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const parsed = createLobbyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: "invalid-lobby", error: parsed.error.message });
    }
    const settings = await stateStore.getGuildSettings(guildId);
    if (!settings.allowSpectators && parsed.data.initialSlot === "spectator") {
      return reply.code(403).send({ code: "forbidden", error: "Spectators are disabled for this server." });
    }
    try {
      return reply.code(201).send(await lobbies.createLobby(guildId, parsed.data));
    } catch (error) {
      return reply
        .code(error instanceof Error && error.message.includes("Alias") ? 409 : 400)
        .send({
          code: error instanceof Error && error.message.includes("Alias") ? "alias-taken" : "invalid-lobby",
          error: error instanceof Error ? error.message : "Lobby could not be created."
        });
    }
  });

  app.post("/guilds/:guildId/lobbies/:roomId/join", async (request, reply) => {
    const { guildId, roomId } = request.params as { guildId: string; roomId: string };
    const parsed = joinLobbyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: "invalid-lobby", error: parsed.error.message });
    }
    const settings = await stateStore.getGuildSettings(guildId);
    if (!settings.allowSpectators && parsed.data.slot === "spectator") {
      return reply.code(403).send({ code: "forbidden", error: "Spectators are disabled for this server." });
    }
    try {
      return await lobbies.joinLobby(guildId, roomId, parsed.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lobby join failed.";
      const normalizedMessage = message.toLowerCase();
      const status = normalizedMessage.includes("taken") ? 409 : normalizedMessage.includes("not found") ? 404 : 400;
      const code = status === 409 ? "alias-taken" : status === 404 ? "not-found" : "invalid-lobby";
      return reply.code(status).send({ code, error: message });
    }
  });

  app.get("/guilds/:guildId/settings", async (request) => {
    const { guildId } = request.params as { guildId: string };
    return stateStore.getGuildSettings(guildId);
  });

  app.put("/guilds/:guildId/settings", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const parsed = guildSettingsSchema.safeParse({ ...(request.body as object), guildId });
    if (!parsed.success) {
      return reply.code(400).send({ code: "invalid-settings", error: parsed.error.message });
    }
    return stateStore.saveGuildSettings(parsed.data);
  });

  app.get("/guilds/:guildId/leaderboard", async (request) => {
    const { guildId } = request.params as { guildId: string };
    return stateStore.getLeaderboard(guildId);
  });

  app.get("/guilds/:guildId/maps", async (request) => {
    const { guildId } = request.params as { guildId: string };
    return stateStore.listCustomMaps(guildId);
  });

  app.post("/guilds/:guildId/maps", async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const parsed = saveCustomMapRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: "invalid-map", error: parsed.error.message });
    }

    try {
      return reply
        .code(201)
        .send(await stateStore.saveCustomMap(guildId, parsed.data.ownerDiscordUserId, parsed.data.map));
    } catch (error) {
      return reply.code(400).send({
        code: "invalid-map",
        error: error instanceof Error ? error.message : "Custom map could not be saved."
      });
    }
  });

  app.delete("/guilds/:guildId/maps/:mapId", async (request, reply) => {
    const { guildId, mapId } = request.params as { guildId: string; mapId: string };
    const { actorDiscordUserId } = request.query as { actorDiscordUserId?: string };
    const actor = actorDiscordUserId?.trim();
    if (!mapId.trim() || !actor) {
      return reply.code(400).send({ code: "invalid-map", error: "A map id and actorDiscordUserId are required." });
    }

    try {
      await stateStore.deleteCustomMap(guildId, mapId, actor);
      return reply.code(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Custom map could not be deleted.";
      const normalizedMessage = message.toLowerCase();
      const status = normalizedMessage.includes("not found")
        ? 404
        : normalizedMessage.includes("owner")
          ? 403
          : 400;
      const code = status === 404 ? "not-found" : status === 403 ? "forbidden" : "invalid-map";
      return reply.code(status).send({ code, error: message });
    }
  });

  app.server.on("upgrade", (request, socket, head) => {
    const parsed = parseRoomPath(request.url);
    if (!parsed) {
      socket.destroy();
      return;
    }

    const origin = request.headers.origin;
    if (parsed.guildScoped && origin && !corsAllowedOrigins.has(origin)) {
      rejectWebSocketUpgrade(socket, 403, "WebSocket origin is not allowed.");
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      rooms.connect(parsed.guildId, parsed.roomId, ws);
    });
  });

  app.addHook("preClose", async () => {
    terminateWebSocketClients(wss);
  });

  app.addHook("onClose", async () => {
    terminateWebSocketClients(wss);

    await new Promise<void>((resolve, reject) => {
      wss.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  return app;
}

export function isMainModule(metaUrl: string, argvPath: string | undefined = process.argv[1]): boolean {
  return argvPath ? metaUrl === pathToFileURL(resolve(argvPath)).href : false;
}

if (isMainModule(import.meta.url)) {
  const app = await buildServer();
  await app.listen({ port: 8787, host: "0.0.0.0" });
}
