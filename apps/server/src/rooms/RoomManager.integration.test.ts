import type { AddressInfo } from "node:net";
import { serverEventSchema, type ServerEvent } from "@graphwar/shared";
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
  return waitForOpen(socket);
}

async function connectWithEvents(url: string): Promise<{ socket: WebSocket; events: ServerEvent[] }> {
  const socket = new WebSocket(url);
  const events = collectEvents(socket);
  await waitForOpen(socket);
  return { socket, events };
}

function waitForOpen(socket: WebSocket): Promise<WebSocket> {
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
    events.push(serverEventSchema.parse(JSON.parse(String(data))));
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

async function waitForNoEvent(
  readEvents: () => ServerEvent[],
  predicate: (event: ServerEvent) => boolean
): Promise<void> {
  const deadline = Date.now() + 100;

  while (Date.now() < deadline) {
    const event = readEvents().find(predicate);
    if (event) {
      throw new Error(`Unexpected event: ${JSON.stringify(event)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function waitForSocketClose(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    socket.once("close", () => resolve());
  });
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

async function closeServer(app: TestServer): Promise<void> {
  const index = servers.indexOf(app);
  if (index >= 0) {
    servers.splice(index, 1);
  }
  await app.close();
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

  it("sends room mismatch rejections only to the originating socket", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "mismatch-test", "alice"));
    const bob = await connect(socketUrl(app, "mismatch-test", "bob"));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, { type: "join-room", roomId: "mismatch-test", playerId: "alice", displayName: "Alice" });
    send(bob, { type: "join-room", roomId: "mismatch-test", playerId: "bob", displayName: "Bob" });

    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.snapshot.players.length === 2
    );

    send(alice, { type: "join-room", roomId: "other-room", playerId: "alice", displayName: "Alice" });

    await waitForEvent(
      () => aliceEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.reason.includes("Room mismatch")
    );
    await waitForNoEvent(
      () => bobEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.reason.includes("Room mismatch")
    );

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("sends duplicate start lifecycle rejections only to the originating socket", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "sender-lifecycle-test", "alice"));
    const bob = await connect(socketUrl(app, "sender-lifecycle-test", "bob"));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, {
      type: "join-room",
      roomId: "sender-lifecycle-test",
      playerId: "alice",
      displayName: "Alice"
    });
    send(bob, { type: "join-room", roomId: "sender-lifecycle-test", playerId: "bob", displayName: "Bob" });

    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.snapshot.players.length === 2
    );

    send(alice, { type: "start-match", roomId: "sender-lifecycle-test", playerId: "alice" });
    send(alice, { type: "start-match", roomId: "sender-lifecycle-test", playerId: "alice" });

    await waitForEvent(
      () => aliceEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.reason === "Match has already started"
    );
    await waitForNoEvent(
      () => bobEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.reason === "Match has already started"
    );

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("sends submit-shot rejections only to the originating socket", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "shot-rejection-test", "alice"));
    const bob = await connect(socketUrl(app, "shot-rejection-test", "bob"));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, { type: "join-room", roomId: "shot-rejection-test", playerId: "alice", displayName: "Alice" });
    send(bob, { type: "join-room", roomId: "shot-rejection-test", playerId: "bob", displayName: "Bob" });

    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.snapshot.players.length === 2
    );

    send(alice, { type: "start-match", roomId: "shot-rejection-test", playerId: "alice" });
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "turn-started" && candidate.playerId === "alice"
    );

    send(bob, {
      type: "submit-shot",
      roomId: "shot-rejection-test",
      playerId: "bob",
      functionFamilyId: "normal",
      expression: "0"
    });

    await waitForEvent(
      () => bobEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.playerId === "bob"
    );
    await waitForNoEvent(
      () => aliceEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.playerId === "bob"
    );

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("removes an empty room so reconnecting starts from a fresh lobby", async () => {
    const app = await startTestServer();
    const { socket: alice, events: aliceEvents } = await connectWithEvents(socketUrl(app, "cleanup-test", "alice"));

    send(alice, { type: "join-room", roomId: "cleanup-test", playerId: "alice", displayName: "Alice" });
    await waitForEvent(
      () => aliceEvents,
      (candidate) => candidate.type === "room-snapshot" && candidate.snapshot.players.some((player) => player.id === "alice")
    );
    await closeSocket(alice);

    const { socket: bob, events: bobEvents } = await connectWithEvents(socketUrl(app, "cleanup-test", "bob"));
    const event = await waitForEvent(
      () => bobEvents,
      (candidate) => candidate.type === "room-snapshot" && candidate.snapshot.phase === "lobby"
    );

    expect(event.type).toBe("room-snapshot");
    if (event.type === "room-snapshot") {
      expect(event.snapshot.players).toEqual([]);
    }

    await closeSocket(bob);
  });

  it("closes active websocket clients when the server closes", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "close-hook-test", "alice"));
    const closed = waitForSocketClose(alice);

    await closeServer(app);
    await closed;

    expect(alice.readyState).toBe(WebSocket.CLOSED);
  });
});
