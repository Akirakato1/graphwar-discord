import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { serverEventSchema, type CustomMapImport, type LobbySlot, type ServerEvent } from "@graphwar/shared";
import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer, type BuildServerOptions } from "../index";
import { LobbyDirectory } from "../lobbies/LobbyDirectory";
import { LocalStateStore } from "../persistence/LocalStateStore";

type TestServer = Awaited<ReturnType<typeof buildServer>>;

const servers: TestServer[] = [];
const sockets: WebSocket[] = [];
const tempDirs: string[] = [];

type TestLobbySession = {
  guildId: string;
  roomId: string;
  discordUserId: string;
  playerId: string;
  alias: string;
  slot: LobbySlot;
  sessionToken: string;
};

class FailingMatchResultStore extends LocalStateStore {
  override async recordMatchResult(): Promise<void> {
    throw new Error("Match result persistence failed.");
  }
}

function socketUrl(app: TestServer, roomId: string, mockPlayer: string): string {
  const address = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}/rooms/${roomId}?mockPlayer=${mockPlayer}`;
}

function guildSocketUrl(app: TestServer, guildId: string, roomId: string): string {
  const address = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}/guilds/${guildId}/rooms/${roomId}`;
}

function lobbyJoinCommand(session: TestLobbySession) {
  return {
    type: "join-room",
    guildId: session.guildId,
    roomId: session.roomId,
    playerId: session.playerId,
    discordUserId: session.discordUserId,
    alias: session.alias,
    displayName: session.alias,
    slot: session.slot,
    sessionToken: session.sessionToken
  };
}

function customMap(name = "Integration Arena"): CustomMapImport {
  return {
    format: "graphwar-map",
    version: 1,
    name,
    terrain: {
      blobs: [
        {
          id: "integration-platform",
          outer: [
            { x: -2, y: -1 },
            { x: 2, y: -1 },
            { x: 0, y: 2 }
          ],
          holes: []
        }
      ]
    },
    spawnPoints: Array.from({ length: 10 }, (_, index) => ({
      id: `spawn-${index}`,
      position: { x: index < 5 ? -10 - index : 10 + index, y: index }
    })),
    teamSpawnPointIds: {
      "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
      "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
    }
  };
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

async function createTempStateStore(): Promise<LocalStateStore> {
  const dir = await mkdtemp(join(tmpdir(), "graphwar-server-"));
  tempDirs.push(dir);
  return new LocalStateStore(join(dir, "local-state.json"));
}

async function startTestServer(options: BuildServerOptions = {}): Promise<TestServer> {
  const stateStore = options.stateStore ?? (await createTempStateStore());
  const app = await buildServer({ ...options, stateStore });
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

function waitForRejectedUpgrade(url: string, origin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: { Origin: origin } });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out waiting for rejected websocket upgrade."));
    }, 1_000);

    socket.once("open", () => {
      clearTimeout(timeout);
      socket.terminate();
      reject(new Error("Expected websocket upgrade to be rejected."));
    });
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timeout);
      expect(response.statusCode).toBe(403);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
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
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
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
      aimDirection: "west",
      expression: "0"
    });

    const event = await waitForEvent(() => [...aliceEvents, ...bobEvents], (candidate) => candidate.type === "shot-resolved");

    expect(event.type).toBe("shot-resolved");
    if (event.type === "shot-resolved") {
      expect(event.aimDirection).toBe("west");
    }

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

  it("explicitly rejects auto-assign-teams until lobby team assignment is implemented", async () => {
    const app = await startTestServer();
    const alice = await connect(socketUrl(app, "auto-assign-test", "alice"));
    const events = collectEvents(alice);

    send(alice, {
      type: "auto-assign-teams",
      guildId: "local-guild",
      roomId: "auto-assign-test",
      playerId: "alice-id"
    });

    const event = await waitForEvent(
      () => events,
      (candidate) =>
        candidate.type === "shot-rejected" &&
        candidate.playerId === "alice-id" &&
        candidate.reason === "Unsupported command: auto-assign-teams"
    );

    expect(event).toMatchObject({
      type: "shot-rejected",
      roomId: "auto-assign-test",
      playerId: "alice-id",
      reason: "Unsupported command: auto-assign-teams"
    });

    await closeSocket(alice);
  });

  it("creates and joins a guild-scoped lobby through HTTP before opening websocket clients", async () => {
    const app = await startTestServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/guilds/local-guild/lobbies",
      payload: {
        name: "Friday Graphwar",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);

    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/guilds/local-guild/lobbies/${created.session.roomId}/join`,
      payload: { discordUserId: "bob-id", alias: "alice", slot: "player" }
    });
    expect(duplicateResponse.statusCode).toBe(409);

    const joinResponse = await app.inject({
      method: "POST",
      url: `/guilds/local-guild/lobbies/${created.session.roomId}/join`,
      payload: { discordUserId: "bob-id", alias: "Bob", slot: "player" }
    });
    expect(joinResponse.statusCode).toBe(200);
    const joined = JSON.parse(joinResponse.body);

    const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const bob = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, lobbyJoinCommand(created.session));
    send(bob, lobbyJoinCommand(joined.session));

    const hasBothLobbyOccupants = (candidate: ServerEvent) =>
      candidate.type === "room-snapshot" &&
      candidate.guildId === "local-guild" &&
      candidate.lobby?.occupants.length === 2;

    await waitForEvent(() => aliceEvents, hasBothLobbyOccupants);
    await waitForEvent(() => bobEvents, hasBothLobbyOccupants);

    send(bob, { type: "start-match", guildId: "local-guild", roomId: created.session.roomId, playerId: "bob-id" });
    await waitForEvent(
      () => bobEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.reason === "Only the lobby leader can start."
    );

    send(alice, {
      type: "auto-assign-teams",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id"
    });
    send(alice, { type: "start-match", guildId: "local-guild", roomId: created.session.roomId, playerId: "alice-id" });
    await waitForEvent(() => aliceEvents, (candidate) => candidate.type === "match-started");
    await waitForEvent(() => bobEvents, (candidate) => candidate.type === "match-started");

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("starts a selected custom-map lobby with custom terrain and spawns", async () => {
    const stateStore = await createTempStateStore();
    const savedMap = await stateStore.saveCustomMap("local-guild", "alice-id", customMap());
    const app = await startTestServer({ stateStore });

    const createResponse = await app.inject({
      method: "POST",
      url: "/guilds/local-guild/lobbies",
      payload: {
        name: "Mapped Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        mapId: savedMap.id
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);
    expect(created.lobby).toMatchObject({ mapId: savedMap.id, mapName: "Integration Arena" });

    const joinResponse = await app.inject({
      method: "POST",
      url: `/guilds/local-guild/lobbies/${created.session.roomId}/join`,
      payload: { discordUserId: "bob-id", alias: "Bob", slot: "player" }
    });
    const joined = JSON.parse(joinResponse.body);

    const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const bob = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, lobbyJoinCommand(created.session));
    send(bob, lobbyJoinCommand(joined.session));
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.lobby?.occupants.length === 2
    );

    send(alice, {
      type: "auto-assign-teams",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id"
    });
    send(alice, { type: "start-match", guildId: "local-guild", roomId: created.session.roomId, playerId: "alice-id" });
    const event = await waitForEvent(() => aliceEvents, (candidate) => candidate.type === "match-started");

    expect(event.type).toBe("match-started");
    if (event.type === "match-started") {
      expect(event.lobby?.status).toBe("playing");
      expect(event.snapshot.terrain.blobs).toEqual([expect.objectContaining({ id: "integration-platform" })]);
      expect(event.snapshot.players.find((player) => player.id === "alice-id")?.position).toEqual({ x: -10, y: 0 });
      expect(event.snapshot.players.find((player) => player.id === "bob-id")?.position).toEqual({ x: 15, y: 5 });
    }

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("keeps the lobby open when selected custom-map spawn generation fails", async () => {
    const stateStore = await createTempStateStore();
    const savedMap = await stateStore.saveCustomMap("local-guild", "alice-id", {
      ...customMap("Broken Team Arena"),
      teamSpawnPointIds: {
        "team-a": ["spawn-0"],
        "team-b": []
      }
    });
    const lobbies = new LobbyDirectory({
      upsertStatsEntry: (guildId, discordUserId, alias) => stateStore.upsertStatsEntry(guildId, discordUserId, alias),
      resolveCustomMapName: async (guildId, mapId) => (await stateStore.getCustomMap(guildId, mapId))?.name
    });
    const app = await startTestServer({ stateStore, lobbies });

    const created = await lobbies.createLobby("local-guild", {
      name: "Broken Map Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      mapId: savedMap.id
    });
    const joined = await lobbies.joinLobby("local-guild", created.session.roomId, {
      discordUserId: "bob-id",
      alias: "Bob",
      slot: "player"
    });

    const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const bob = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, lobbyJoinCommand(created.session));
    send(bob, lobbyJoinCommand(joined.session));
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.lobby?.occupants.length === 2
    );

    send(alice, {
      type: "auto-assign-teams",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id"
    });
    send(alice, { type: "start-match", guildId: "local-guild", roomId: created.session.roomId, playerId: "alice-id" });

    await waitForEvent(
      () => aliceEvents,
      (candidate) =>
        candidate.type === "shot-rejected" &&
        candidate.reason === "Team B needs at least 1 custom map spawn point."
    );
    expect(lobbies.getLobby("local-guild", created.session.roomId)).toMatchObject({
      status: "open",
      startedAt: undefined
    });

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("rejects guild websocket upgrades from unlisted browser origins", async () => {
    const app = await startTestServer({ corsAllowedOrigins: ["https://activity.example"] });

    await waitForRejectedUpgrade(guildSocketUrl(app, "local-guild", "origin-test"), "https://evil.example");
  });

  it("rejects lobby commands when a socket acts as a different joined player", async () => {
    const app = await startTestServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/guilds/local-guild/lobbies",
      payload: {
        name: "Impersonation Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
      }
    });
    const created = JSON.parse(createResponse.body);
    const joinResponse = await app.inject({
      method: "POST",
      url: `/guilds/local-guild/lobbies/${created.session.roomId}/join`,
      payload: { discordUserId: "bob-id", alias: "Bob", slot: "player" }
    });
    const joined = JSON.parse(joinResponse.body);

    const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const bob = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, lobbyJoinCommand(created.session));
    send(bob, lobbyJoinCommand(joined.session));
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.lobby?.occupants.length === 2
    );

    send(bob, {
      type: "start-match",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id"
    });

    await waitForEvent(
      () => bobEvents,
      (candidate) =>
        candidate.type === "shot-rejected" && candidate.reason === "Command actor does not match socket session."
    );
    await waitForNoEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "match-started"
    );

    await closeSocket(alice);
    await closeSocket(bob);
  });

  it("keeps a started guild match recoverable after all websocket clients disconnect", async () => {
    const app = await startTestServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/guilds/local-guild/lobbies",
      payload: {
        name: "Reconnect Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
      }
    });
    const created = JSON.parse(createResponse.body);
    const joinResponse = await app.inject({
      method: "POST",
      url: `/guilds/local-guild/lobbies/${created.session.roomId}/join`,
      payload: { discordUserId: "bob-id", alias: "Bob", slot: "player" }
    });
    const joined = JSON.parse(joinResponse.body);

    const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const bob = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, lobbyJoinCommand(created.session));
    send(bob, lobbyJoinCommand(joined.session));
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.lobby?.occupants.length === 2
    );

    send(alice, {
      type: "auto-assign-teams",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id"
    });
    send(alice, { type: "start-match", guildId: "local-guild", roomId: created.session.roomId, playerId: "alice-id" });
    await waitForEvent(() => aliceEvents, (candidate) => candidate.type === "match-started");
    await waitForEvent(() => bobEvents, (candidate) => candidate.type === "match-started");

    await closeSocket(alice);
    await closeSocket(bob);

    const { socket: reconnected, events: reconnectEvents } = await connectWithEvents(
      guildSocketUrl(app, "local-guild", created.session.roomId)
    );
    const event = await waitForEvent(
      () => reconnectEvents,
      (candidate) => candidate.type === "room-snapshot" && candidate.guildId === "local-guild"
    );

    expect(event.type).toBe("room-snapshot");
    if (event.type === "room-snapshot") {
      expect(event.lobby?.status).toBe("playing");
      expect(event.snapshot.phase).toBe("playing");
    }

    await closeSocket(reconnected);
  });

  it("rejects lobby commands before a websocket joins with its selected session", async () => {
    const app = await startTestServer();

    const createResponse = await app.inject({
      method: "POST",
      url: "/guilds/local-guild/lobbies",
      payload: {
        name: "Unbound Socket Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
      }
    });
    const created = JSON.parse(createResponse.body);
    const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const aliceEvents = collectEvents(alice);

    send(alice, {
      type: "start-match",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id",
      sessionToken: created.session.sessionToken
    });

    await waitForEvent(
      () => aliceEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.reason === "Join lobby before sending commands."
    );

    await closeSocket(alice);
  });

  it("broadcasts match-ended even when leaderboard persistence fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "graphwar-server-"));
    tempDirs.push(dir);
    const stateStore = new FailingMatchResultStore(join(dir, "local-state.json"));
    const app = await startTestServer({ stateStore });

    const createResponse = await app.inject({
      method: "POST",
      url: "/guilds/local-guild/lobbies",
      payload: {
        name: "Persistence Failure Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "free-for-all",
        initialSlot: "player"
      }
    });
    const created = JSON.parse(createResponse.body);
    const joinResponse = await app.inject({
      method: "POST",
      url: `/guilds/local-guild/lobbies/${created.session.roomId}/join`,
      payload: { discordUserId: "bob-id", alias: "Bob", slot: "player" }
    });
    const joined = JSON.parse(joinResponse.body);

    const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const bob = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
    const aliceEvents = collectEvents(alice);
    const bobEvents = collectEvents(bob);

    send(alice, lobbyJoinCommand(created.session));
    send(bob, lobbyJoinCommand(joined.session));
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "room-snapshot" && candidate.lobby?.occupants.length === 2
    );

    send(alice, { type: "start-match", guildId: "local-guild", roomId: created.session.roomId, playerId: "alice-id" });
    await waitForEvent(() => aliceEvents, (candidate) => candidate.type === "match-started");

    const hitBobExpression = "-0.03*x*(x-32)";
    send(alice, {
      type: "submit-shot",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id",
      functionFamilyId: "normal",
      aimDirection: "west",
      expression: hitBobExpression
    });
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "turn-advanced" && candidate.playerId === "bob-id" && candidate.turnNumber === 2
    );
    send(bob, {
      type: "submit-shot",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "bob-id",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "-x"
    });
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "turn-advanced" && candidate.playerId === "alice-id" && candidate.turnNumber === 3
    );
    send(alice, {
      type: "submit-shot",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id",
      functionFamilyId: "normal",
      aimDirection: "west",
      expression: hitBobExpression
    });
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "turn-advanced" && candidate.playerId === "bob-id" && candidate.turnNumber === 4
    );
    send(bob, {
      type: "submit-shot",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "bob-id",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "-x"
    });
    await waitForEvent(
      () => [...aliceEvents, ...bobEvents],
      (candidate) => candidate.type === "turn-advanced" && candidate.playerId === "alice-id" && candidate.turnNumber === 5
    );
    const aliceEventCountBeforeFinalShot = aliceEvents.length;
    send(alice, {
      type: "submit-shot",
      guildId: "local-guild",
      roomId: created.session.roomId,
      playerId: "alice-id",
      functionFamilyId: "normal",
      aimDirection: "west",
      expression: hitBobExpression
    });

    const ended = await waitForEvent(
      () => aliceEvents.slice(aliceEventCountBeforeFinalShot),
      (candidate) => candidate.type === "match-ended" && candidate.winnerIds.includes("alice-id")
    );
    const finalEvents = aliceEvents.slice(aliceEventCountBeforeFinalShot);
    const shotResolvedIndex = finalEvents.findIndex((event) => event.type === "shot-resolved");
    const matchEndedIndex = finalEvents.findIndex((event) => event.type === "match-ended");

    expect(finalEvents.map((event) => event.type)).toContain("shot-resolved");
    expect(shotResolvedIndex).toBeGreaterThanOrEqual(0);
    expect(matchEndedIndex).toBeGreaterThanOrEqual(0);
    expect(shotResolvedIndex).toBeLessThan(matchEndedIndex);
    expect(finalEvents.slice(matchEndedIndex).some((event) => event.type === "turn-advanced")).toBe(false);
    expect(ended.type).toBe("match-ended");
    if (ended.type === "match-ended") {
      expect(ended.lobby?.status).toBe("ended");
    }
    await waitForNoEvent(
      () => aliceEvents,
      (candidate) => candidate.type === "shot-rejected" && candidate.reason.includes("persistence")
    );

    await closeSocket(alice);
    await closeSocket(bob);
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
      aimDirection: "west",
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
