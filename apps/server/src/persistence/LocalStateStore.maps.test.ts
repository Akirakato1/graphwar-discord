import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CustomMapImport } from "@graphwar/shared";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStateStore } from "./LocalStateStore";

const tempDirs: string[] = [];

function customMap(name = "Test Arena"): CustomMapImport {
  return {
    format: "graphwar-map",
    version: 1,
    name,
    terrain: { blobs: [] },
    spawnPoints: Array.from({ length: 10 }, (_, index) => ({
      id: `spawn-${index}`,
      position: { x: index, y: 0 }
    })),
    teamSpawnPointIds: {
      "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
      "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
    }
  };
}

async function createStore(): Promise<{ store: LocalStateStore; filePath: string }> {
  const dir = await mkdtemp(join(tmpdir(), "graphwar-map-store-"));
  tempDirs.push(dir);
  const filePath = join(dir, "state.json");
  return { store: new LocalStateStore(filePath), filePath };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("LocalStateStore custom maps", () => {
  it("persists custom maps per guild", async () => {
    const { store } = await createStore();
    const saved = await store.saveCustomMap("guild-a", "alice", customMap());

    expect(saved.guildId).toBe("guild-a");
    expect(saved.ownerDiscordUserId).toBe("alice");
    expect(saved.name).toBe("Test Arena");

    await store.saveCustomMap("guild-b", "alice", customMap("Other Guild Arena"));
    expect(await store.listCustomMaps("guild-a")).toHaveLength(1);
    expect(await store.listCustomMaps("guild-b")).toHaveLength(1);
  });

  it("lazily defaults custom maps for existing guild state", async () => {
    const { store, filePath } = await createStore();
    await writeFile(
      filePath,
      JSON.stringify({
        guilds: {
          "guild-a": {
            settings: { guildId: "guild-a", defaultMode: "team-versus", allowSpectators: true },
            leaderboard: {}
          }
        }
      }),
      "utf8"
    );

    const saved = await store.saveCustomMap("guild-a", "alice", customMap());

    expect(await store.getCustomMap("guild-a", saved.id)).toMatchObject({ id: saved.id, guildId: "guild-a" });
  });

  it("validates custom maps before saving", async () => {
    const { store } = await createStore();

    await expect(
      store.saveCustomMap("guild-a", "alice", {
        ...customMap(),
        spawnPoints: customMap().spawnPoints.slice(0, 9)
      })
    ).rejects.toThrow("at least 10 spawn points");
  });

  it("rejects delete from a non-owner and keeps the map", async () => {
    const { store } = await createStore();
    const saved = await store.saveCustomMap("guild-a", "alice", customMap());

    await expect(store.deleteCustomMap("guild-a", saved.id, "bob")).rejects.toThrow("owner");
    expect(await store.getCustomMap("guild-a", saved.id)).toBeDefined();
  });

  it("deletes maps for the owner", async () => {
    const { store } = await createStore();
    const saved = await store.saveCustomMap("guild-a", "alice", customMap());

    await store.deleteCustomMap("guild-a", saved.id, "alice");
    expect(await store.getCustomMap("guild-a", saved.id)).toBeUndefined();
  });
});
