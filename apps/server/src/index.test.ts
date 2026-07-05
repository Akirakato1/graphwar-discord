import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer, isMainModule } from "./index";
import { LocalStateStore } from "./persistence/LocalStateStore";

type TestServer = Awaited<ReturnType<typeof buildServer>>;

const servers: TestServer[] = [];
const tempDirs: string[] = [];

async function createTestServer(): Promise<{ app: TestServer; stateStore: LocalStateStore }> {
  const dir = await mkdtemp(join(tmpdir(), "graphwar-index-"));
  tempDirs.push(dir);
  const stateStore = new LocalStateStore(join(dir, "local-state.json"));
  const app = await buildServer({ stateStore });
  servers.push(app);
  return { app, stateStore };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((app) => app.close()));
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("isMainModule", () => {
  it("matches file URLs for Windows-style paths with spaces", () => {
    const entryPath = resolve("C:/Users/zhuyl/OneDrive/Desktop/Graphwar Discord Activity/apps/server/src/index.ts");

    expect(isMainModule(pathToFileURL(entryPath).href, entryPath)).toBe(true);
  });

  it("does not match imported modules", () => {
    expect(isMainModule(pathToFileURL(resolve("apps/server/src/index.ts")).href, resolve("apps/server/src/test.ts"))).toBe(
      false
    );
  });
});

describe("guild HTTP routes", () => {
  it("answers browser CORS preflight requests for lobby APIs", async () => {
    const { app } = await createTestServer();

    const response = await app.inject({
      method: "OPTIONS",
      url: "/guilds/local-guild/lobbies",
      headers: {
        origin: "http://127.0.0.1:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(response.headers["access-control-allow-headers"]).toContain("content-type");
  });

  it("lists created lobby summaries scoped to the requested guild", async () => {
    const { app } = await createTestServer();

    const guildOneCreate = await app.inject({
      method: "POST",
      url: "/guilds/guild-one/lobbies",
      payload: {
        name: "Guild One Room",
        leaderDiscordUserId: "alice-id",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
      }
    });
    expect(guildOneCreate.statusCode).toBe(201);

    const guildTwoCreate = await app.inject({
      method: "POST",
      url: "/guilds/guild-two/lobbies",
      payload: {
        name: "Guild Two Room",
        leaderDiscordUserId: "bob-id",
        alias: "Bob",
        mode: "free-for-all",
        initialSlot: "spectator"
      }
    });
    expect(guildTwoCreate.statusCode).toBe(201);

    const response = await app.inject({ method: "GET", url: "/guilds/guild-one/lobbies" });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      expect.objectContaining({
        guildId: "guild-one",
        name: "Guild One Room",
        leaderAlias: "Alice",
        playerCount: 1,
        spectatorCount: 0
      })
    ]);
  });

  it("returns default guild settings when no settings have been saved", async () => {
    const { app } = await createTestServer();

    const response = await app.inject({ method: "GET", url: "/guilds/new-guild/settings" });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      guildId: "new-guild",
      defaultMode: "team-versus",
      allowSpectators: true
    });
  });

  it("persists settings for the route guild id", async () => {
    const { app } = await createTestServer();

    const saveResponse = await app.inject({
      method: "PUT",
      url: "/guilds/settings-guild/settings",
      payload: {
        guildId: "payload-guild",
        defaultMode: "free-for-all",
        allowSpectators: false
      }
    });
    expect(saveResponse.statusCode).toBe(200);
    expect(JSON.parse(saveResponse.body)).toEqual({
      guildId: "settings-guild",
      defaultMode: "free-for-all",
      allowSpectators: false
    });

    const routeGuildResponse = await app.inject({ method: "GET", url: "/guilds/settings-guild/settings" });
    expect(JSON.parse(routeGuildResponse.body)).toEqual({
      guildId: "settings-guild",
      defaultMode: "free-for-all",
      allowSpectators: false
    });

    const payloadGuildResponse = await app.inject({ method: "GET", url: "/guilds/payload-guild/settings" });
    expect(JSON.parse(payloadGuildResponse.body)).toEqual({
      guildId: "payload-guild",
      defaultMode: "team-versus",
      allowSpectators: true
    });
  });

  it("returns persisted leaderboard entries for the requested guild", async () => {
    const { app, stateStore } = await createTestServer();
    await stateStore.upsertStatsEntry("score-guild", "alice-id", "Alice");
    await stateStore.upsertStatsEntry("other-guild", "bob-id", "Bob");

    const response = await app.inject({ method: "GET", url: "/guilds/score-guild/leaderboard" });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      expect.objectContaining({
        guildId: "score-guild",
        discordUserId: "alice-id",
        lastAlias: "Alice",
        gamesPlayed: 0,
        wins: 0
      })
    ]);
  });

  it("returns not found when joining a missing lobby", async () => {
    const { app } = await createTestServer();

    const response = await app.inject({
      method: "POST",
      url: "/guilds/missing-guild/lobbies/missing-room/join",
      payload: { discordUserId: "alice-id", alias: "Alice", slot: "player" }
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toMatchObject({ code: "not-found" });
  });
});
