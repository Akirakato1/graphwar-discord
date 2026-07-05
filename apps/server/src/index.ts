import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createLobbyRequestSchema, guildSettingsSchema, joinLobbyRequestSchema } from "@graphwar/shared";
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

function parseRoomPath(requestUrl: string | undefined): { guildId: string; roomId: string } | undefined {
  try {
    const url = new URL(requestUrl ?? "/", "http://localhost");
    const guildMatch = /^\/guilds\/([^/]+)\/rooms\/([^/]+)$/.exec(url.pathname);
    if (guildMatch) {
      return { guildId: decodeURIComponent(guildMatch[1]), roomId: decodeURIComponent(guildMatch[2]) };
    }
    const legacyMatch = /^\/rooms\/([^/]+)$/.exec(url.pathname);
    return legacyMatch ? { guildId: "local-guild", roomId: decodeURIComponent(legacyMatch[1]) } : undefined;
  } catch {
    return undefined;
  }
}

export type BuildServerOptions = {
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

  app.addHook("onRequest", async (request, reply) => {
    const isGuildApiRequest = request.url.startsWith("/guilds/");
    if (!isGuildApiRequest) {
      return;
    }

    const origin = request.headers.origin;
    if (origin) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-methods", "GET, POST, PUT, OPTIONS");
      reply.header(
        "access-control-allow-headers",
        headerValue(request.headers["access-control-request-headers"], "content-type")
      );
      reply.header("vary", "Origin");
    }

    if (request.method === "OPTIONS") {
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

  app.server.on("upgrade", (request, socket, head) => {
    const parsed = parseRoomPath(request.url);
    if (!parsed) {
      socket.destroy();
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
