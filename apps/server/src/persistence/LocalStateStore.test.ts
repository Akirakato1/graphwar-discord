import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultLocalStateFilePath, LocalStateStore } from "./LocalStateStore";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "graphwar-state-"));
  tempDirs.push(dir);
  return dir;
}

async function createStore(): Promise<{ store: LocalStateStore; filePath: string }> {
  const dir = await createTempDir();
  const filePath = join(dir, "local-state.json");
  return { store: new LocalStateStore(filePath), filePath };
}

describe("LocalStateStore", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("anchors the default state file path to the server data directory", () => {
    expect(isAbsolute(defaultLocalStateFilePath)).toBe(true);
    expect(defaultLocalStateFilePath.replaceAll("\\", "/")).toMatch(/apps\/server\/data\/local-state\.json$/);
  });

  it("returns default guild settings when the state file is missing", async () => {
    const { store } = await createStore();

    await expect(store.getGuildSettings("new-guild")).resolves.toEqual({
      guildId: "new-guild",
      defaultMode: "team-versus",
      allowSpectators: true
    });
  });

  it("persists guild settings and reloads them", async () => {
    const { store, filePath } = await createStore();

    await store.saveGuildSettings({ guildId: "guild-1", defaultMode: "free-for-all", allowSpectators: false });
    const reloaded = new LocalStateStore(filePath);

    await expect(reloaded.getGuildSettings("guild-1")).resolves.toEqual({
      guildId: "guild-1",
      defaultMode: "free-for-all",
      allowSpectators: false
    });
  });

  it("creates parent directories when writing the state file", async () => {
    const dir = await createTempDir();
    const filePath = join(dir, "nested", "state", "local-state.json");
    const store = new LocalStateStore(filePath);

    await store.saveGuildSettings({ guildId: "guild-1", defaultMode: "free-for-all", allowSpectators: false });
    const raw = JSON.parse(await readFile(filePath, "utf8"));

    expect(raw.guilds["guild-1"].settings).toEqual({
      guildId: "guild-1",
      defaultMode: "free-for-all",
      allowSpectators: false
    });
  });

  it("creates and updates leaderboard entries by guild and discord user id", async () => {
    const { store, filePath } = await createStore();

    await store.upsertStatsEntry("guild-1", "alice-id", "Alice");
    await store.upsertStatsEntry("guild-1", "alice-id", "Captain Alice");
    await store.upsertStatsEntry("guild-2", "alice-id", "Other Alice");
    const raw = JSON.parse(await readFile(filePath, "utf8"));

    expect(raw.guilds["guild-1"].leaderboard["alice-id"].lastAlias).toBe("Captain Alice");
    expect(raw.guilds["guild-1"].leaderboard["alice-id"].gamesPlayed).toBe(0);
    expect(raw.guilds["guild-2"].leaderboard["alice-id"].lastAlias).toBe("Other Alice");
  });

  it("keeps concurrent stats upserts from overwriting each other", async () => {
    const { store } = await createStore();
    const userIds = Array.from({ length: 20 }, (_, index) => `user-${index}`);

    await Promise.all(userIds.map((userId, index) => store.upsertStatsEntry("guild-1", userId, `Player ${index}`)));
    const leaderboard = await store.getLeaderboard("guild-1");

    expect(leaderboard.map((entry) => entry.discordUserId).sort()).toEqual([...userIds].sort());
  });

  it("increments games played and wins for match results", async () => {
    const { store } = await createStore();
    await store.upsertStatsEntry("guild-1", "alice-id", "Alice");
    await store.upsertStatsEntry("guild-1", "bob-id", "Bob");

    await store.recordMatchResult("guild-1", ["alice-id"], ["alice-id", "bob-id"]);
    const leaderboard = await store.getLeaderboard("guild-1");

    expect(leaderboard.find((entry) => entry.discordUserId === "alice-id")).toMatchObject({
      gamesPlayed: 1,
      wins: 1
    });
    expect(leaderboard.find((entry) => entry.discordUserId === "bob-id")).toMatchObject({
      gamesPlayed: 1,
      wins: 0
    });
  });

  it("sorts leaderboards by wins descending and then games played descending", async () => {
    const { store } = await createStore();
    await store.upsertStatsEntry("guild-1", "alice-id", "Alice");
    await store.upsertStatsEntry("guild-1", "bob-id", "Bob");
    await store.upsertStatsEntry("guild-1", "carol-id", "Carol");

    await store.recordMatchResult("guild-1", ["alice-id"], ["alice-id", "bob-id", "carol-id"]);
    await store.recordMatchResult("guild-1", ["bob-id"], ["bob-id", "carol-id"]);
    const leaderboard = await store.getLeaderboard("guild-1");

    expect(leaderboard.map((entry) => entry.discordUserId)).toEqual(["bob-id", "alice-id", "carol-id"]);
  });
});
