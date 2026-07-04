import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { RoomManager } from "./rooms/RoomManager";

function parseRoomId(requestUrl: string | undefined): string | undefined {
  try {
    const url = new URL(requestUrl ?? "/", "http://localhost");
    const match = /^\/rooms\/([^/]+)$/.exec(url.pathname);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  const rooms = new RoomManager();
  const wss = new WebSocketServer({ noServer: true });

  app.get("/health", async () => ({ ok: true }));

  app.server.on("upgrade", (request, socket, head) => {
    const roomId = parseRoomId(request.url);
    if (!roomId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      rooms.connect(roomId, ws);
    });
  });

  app.addHook("onClose", async () => {
    for (const client of wss.clients) {
      client.terminate();
    }

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

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: 8787, host: "0.0.0.0" });
}
