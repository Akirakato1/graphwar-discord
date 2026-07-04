import type { AddressInfo } from "node:net";
import type { ServerEvent } from "@graphwar/shared";
import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../index";

type TestServer = Awaited<ReturnType<typeof buildServer>>;

const servers: TestServer[] = [];
const sockets: WebSocket[] = [];

function socketUrl(app: TestServer, roomId: string, mockPlayer: string): string {
  const address = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}/rooms/${roomId}?mockPlayer=${mockPlayer}`;
}

function connect(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);

  return new Promise((resolve, reject) => {
    socket.once("open", () => {
      sockets.push(socket);
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

function collectEvents(socket: WebSocket): ServerEvent[] {
  const events: ServerEvent[] = [];
  socket.on("message", (data) => {
    events.push(JSON.parse(String(data)) as ServerEvent);
  });
  return events;
}

async function startTestServer(): Promise<TestServer> {
  const app = await buildServer();
  await app.listen({ port: 0, host: "127.0.0.1" });
  servers.push(app);
  return app;
}

function send(socket: WebSocket, command: unknown): void {
  socket.send(typeof command === "string" ? command : JSON.stringify(command));
}

async function waitForEvent(
  readEvents: () => ServerEvent[],
  predicate: (event: ServerEvent) => boolean
): Promise<ServerEvent> {
  const deadline = Date.now() + 1_000;

  while (Date.now() < deadline) {
    const events = readEvents();
    const event = events.find(predicate);
    if (event) {
      return event;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Timed out waiting for event. Received: ${JSON.stringify(readEvents())}`);
}

function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
}

describe("RoomManager WebSocket integration", () => {
  afterEach(async () => {
    for (const socket of sockets.splice(0)) {
      if (socket.readyState !== WebSocket.CLOSED) {
        socket.terminate();
      }
    }
    await Promise.all(servers.splice(0).map((app) => app.close()));
  });

  it("resolves a submitted shot for two joined websocket clients", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "local-test", "alice"));
    const bob = await connect(socketUrl(app, "local-test", "bob"));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, { type: "join-room", roomId: "local-test", playerId: "alice", displayName: "Alice" });
    send(bob, { type: "join-room", roomId: "local-test", playerId: "bob", displayName: "Bob" });

    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.snapshot.players.length === 2
    );

    send(alice, { type: "start-match", roomId: "local-test", playerId: "alice" });
    send(alice, {
      type: "submit-shot",
      roomId: "local-test",
      playerId: "alice",
      functionFamilyId: "normal",
      expression: "0"
    });

    const event = await waitForEvent(() => [...aliceEvents, ...bobEvents], (candidate) => candidate.type === "shot-resolved");

    expect(event.type).toBe("shot-resolved");

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("broadcasts selected lobby mode in room snapshots before the match starts", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "mode-test", "alice"));
    const events = collectEvents(alice);

    send(alice, { type: "join-room", roomId: "mode-test", playerId: "alice", displayName: "Alice" });
    send(alice, { type: "select-mode", roomId: "mode-test", playerId: "alice", mode: "free-for-all" });

    const event = await waitForEvent(
      () => events,
      (candidate) => candidate.type === "room-snapshot" && candidate.snapshot.mode === "free-for-all"
    );

    expect(event.type).toBe("room-snapshot");
    if (event.type === "room-snapshot") {
      expect(event.snapshot.mode).toBe("free-for-all");
    }

    await closeSocket(alice);
  });

  it("safely rejects invalid command payloads without crashing", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "invalid-test", "alice"));
    const events = collectEvents(alice);

    send(alice, "{");

    const event = await waitForEvent(() => events, (candidate) => candidate.type === "shot-rejected");

    expect(event).toMatchObject({ type: "shot-rejected", roomId: "invalid-test", playerId: "unknown" });

    await closeSocket(alice);
  });

  it("converts duplicate start-match lifecycle errors into safe rejections", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "lifecycle-test", "alice"));
    const events = collectEvents(alice);

    send(alice, { type: "join-room", roomId: "lifecycle-test", playerId: "alice", displayName: "Alice" });
    send(alice, { type: "start-match", roomId: "lifecycle-test", playerId: "alice" });
    send(alice, { type: "start-match", roomId: "lifecycle-test", playerId: "alice" });

    const event = await waitForEvent(
      () => events,
      (candidate) => candidate.type === "shot-rejected" && candidate.playerId === "alice"
    );

    expect(event).toMatchObject({ type: "shot-rejected", roomId: "lifecycle-test", playerId: "alice" });

    await closeSocket(alice);
  });
});
