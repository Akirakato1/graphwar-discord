# Custom Maps And Map Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guild-scoped custom map loading to the game and create a separate local Electron map maker that exports maps the game can import.

**Architecture:** Shared Zod schemas define the map file format once. The server persists custom maps per guild and converts selected maps into existing `GeneratedMap` data before match start. The Discord Activity client manages/imports maps and selects them during lobby creation, while the separate Electron map maker edits/export `.graphwar-map.json` files without becoming part of the Activity UI.

**Tech Stack:** TypeScript npm workspaces, Zod, Fastify, React, Vite, Canvas 2D, Electron, Vitest, Playwright.

---

## Source Design

Read first:

- `docs/superpowers/specs/2026-07-06-custom-maps-and-map-maker-design.md`
- `README.md`
- `packages/shared/src/lobby/types.ts`
- `packages/shared/src/lobby/schemas.ts`
- `packages/shared/src/protocol/schemas.ts`
- `apps/server/src/persistence/LocalStateStore.ts`
- `apps/server/src/lobbies/LobbyDirectory.ts`
- `apps/server/src/rooms/GameRoom.ts`
- `apps/server/src/match/MatchController.ts`
- `apps/server/src/maps/MapGenerator.ts`
- `apps/client/src/app/useGameStore.ts`
- `apps/client/src/app/App.tsx`
- `apps/client/src/menu/MainMenu.tsx`
- `apps/client/src/lobby/CreateLobbyView.tsx`
- `apps/client/src/networking/lobbyApi.ts`

## File Structure

Create:

- `packages/shared/src/maps/types.ts`: shared custom map and persisted map types.
- `packages/shared/src/maps/schemas.ts`: shared custom map import and persisted map schemas.
- `packages/shared/src/maps/validation.ts`: reusable custom map validation helpers.
- `packages/shared/src/maps/index.ts`: map type/schema exports.
- `apps/server/src/maps/CustomMapSpawner.ts`: converts persisted custom maps into `GeneratedMap`.
- `apps/server/src/maps/CustomMapSpawner.test.ts`: server spawn assignment coverage.
- `apps/server/src/persistence/LocalStateStore.maps.test.ts`: map persistence coverage.
- `apps/server/src/lobbies/LobbyDirectory.maps.test.ts`: selected map lobby coverage.
- `apps/client/src/maps/MapLibraryView.tsx`: Activity map library/import/delete screen.
- `apps/client/src/maps/MapLibraryView.test.tsx`: map library unit coverage.
- `apps/client/src/maps/mapFile.ts`: browser file parsing helper.
- `apps/client/src/maps/mapFile.test.ts`: map file parsing coverage.
- `apps/client/e2e/custom-maps.spec.ts`: local two-client custom-map smoke.
- `apps/map-maker/package.json`: Electron workspace package.
- `apps/map-maker/tsconfig.json`: TypeScript project config.
- `apps/map-maker/vite.config.ts`: Vite renderer build config.
- `apps/map-maker/index.html`: renderer HTML entry.
- `apps/map-maker/src/main.ts`: Electron main process.
- `apps/map-maker/src/preload.ts`: secure preload bridge.
- `apps/map-maker/src/editor/editorTypes.ts`: editor-only model types.
- `apps/map-maker/src/editor/editorModel.ts`: shape/spawn editing model.
- `apps/map-maker/src/editor/editorModel.test.ts`: model behavior tests.
- `apps/map-maker/src/editor/mapExport.ts`: converts editor state to `CustomMapImport`.
- `apps/map-maker/src/editor/mapExport.test.ts`: export validation tests.
- `apps/map-maker/src/renderer/electron.d.ts`: renderer preload API typing.
- `apps/map-maker/src/renderer/App.tsx`: map maker UI.
- `apps/map-maker/src/renderer/main.tsx`: React renderer entry.
- `apps/map-maker/src/renderer/styles.css`: local desktop editor styling.

Modify:

- `packages/shared/src/index.ts`: export maps module.
- `packages/shared/src/lobby/types.ts`: add map fields to lobby contracts and persistence state.
- `packages/shared/src/lobby/schemas.ts`: add map fields and map request schemas.
- `apps/server/src/persistence/LocalStateStore.ts`: persist/list/save/delete/get custom maps.
- `apps/server/src/index.ts`: add map HTTP routes and CORS `DELETE`.
- `apps/server/src/lobbies/LobbyDirectory.ts`: store selected map id/name in runtime lobby snapshots/summaries.
- `apps/server/src/rooms/GameRoom.ts`: load selected custom map before start-match and pass generated map to the match controller.
- `apps/server/src/match/MatchController.ts`: accept optional `GeneratedMap`.
- `apps/client/src/networking/lobbyApi.ts`: add maps API and map id on create lobby.
- `apps/client/src/app/useGameStore.ts`: add map state/actions and selected map create-lobby payload.
- `apps/client/src/app/App.tsx`: route `custom-maps` view and load maps for create lobby.
- `apps/client/src/menu/MainMenu.tsx`: add Custom Maps button.
- `apps/client/src/lobby/CreateLobbyView.tsx`: add compact map selector.
- `apps/client/src/styles.css`: compact map library/create-lobby map selector styling.
- `package.json`: add `dev:map-maker`, `build:map-maker`, and workspace-aware test/check compatibility if needed.
- `tsconfig.json`: add `apps/map-maker` project reference if root uses references.
- `README.md`: update every pushed checkpoint.

## Commit Boundaries

Use these commits and pushes:

1. `docs: plan custom maps implementation`
2. `feat: add custom map server support`
3. `feat: add custom map client flow`
4. `feat: add local map maker`
5. `test: cover custom map gameplay flow`

Push after every commit:

```bash
git push origin feature/graphwar-prototype
```

Do not add `Co-Authored-By` trailers.

---

## Task 1: Shared Custom Map Contract

**Files:**

- Create: `packages/shared/src/maps/types.ts`
- Create: `packages/shared/src/maps/schemas.ts`
- Create: `packages/shared/src/maps/validation.ts`
- Create: `packages/shared/src/maps/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/lobby/types.ts`
- Modify: `packages/shared/src/lobby/schemas.ts`
- Test: `packages/shared/src/maps/schemas.test.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `packages/shared/src/maps/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { customMapImportSchema, validateCustomMapImportForSave } from "./schemas";

function spawnPoints(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `spawn-${index}`,
    position: { x: index, y: index % 2 === 0 ? 1 : -1 }
  }));
}

const validMap = {
  format: "graphwar-map",
  version: 1,
  name: "Arena One",
  terrain: {
    blobs: [
      {
        id: "center-rock",
        outer: [
          { x: -2, y: -1 },
          { x: 2, y: -1 },
          { x: 0, y: 2 }
        ],
        holes: []
      }
    ]
  },
  spawnPoints: spawnPoints(10),
  teamSpawnPointIds: {
    "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
    "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
  }
} as const;

describe("custom map schemas", () => {
  it("accepts a valid graphwar map import", () => {
    expect(customMapImportSchema.parse(validMap).name).toBe("Arena One");
  });

  it("rejects maps with fewer than ten spawn points for server save", () => {
    expect(() =>
      validateCustomMapImportForSave({
        ...validMap,
        spawnPoints: spawnPoints(9),
        teamSpawnPointIds: { "team-a": ["spawn-0"], "team-b": ["spawn-1"] }
      })
    ).toThrow("at least 10 spawn points");
  });

  it("rejects duplicate spawn point ids", () => {
    const duplicateSpawns = spawnPoints(10);
    duplicateSpawns[9] = { ...duplicateSpawns[9], id: "spawn-0" };

    expect(() => validateCustomMapImportForSave({ ...validMap, spawnPoints: duplicateSpawns })).toThrow(
      "Spawn point ids must be unique"
    );
  });

  it("rejects team spawn ids that do not exist", () => {
    expect(() =>
      validateCustomMapImportForSave({
        ...validMap,
        teamSpawnPointIds: { "team-a": ["missing-spawn"], "team-b": ["spawn-1"] }
      })
    ).toThrow("Unknown team spawn point id");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- packages/shared/src/maps/schemas.test.ts
```

Expected: FAIL because `packages/shared/src/maps/schemas` does not exist.

- [ ] **Step 3: Add shared map types**

Create `packages/shared/src/maps/types.ts`:

```ts
import type { DiscordUserId, GuildId } from "../lobby/types";
import type { TerrainState, WorldPoint } from "../geometry/types";

export type CustomMapFormat = "graphwar-map";
export type CustomMapVersion = 1;

export type CustomMapWorldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type CustomMapSpawnPoint = {
  id: string;
  position: WorldPoint;
};

export type CustomMapTeamSpawnPointIds = {
  "team-a": string[];
  "team-b": string[];
};

export type CustomMapImport = {
  format: CustomMapFormat;
  version: CustomMapVersion;
  name: string;
  worldBounds?: CustomMapWorldBounds;
  terrain: TerrainState;
  spawnPoints: CustomMapSpawnPoint[];
  teamSpawnPointIds: CustomMapTeamSpawnPointIds;
};

export type PersistedCustomMap = CustomMapImport & {
  id: string;
  guildId: GuildId;
  ownerDiscordUserId: DiscordUserId;
  createdAt: string;
  updatedAt: string;
};

export type SaveCustomMapRequest = {
  ownerDiscordUserId: DiscordUserId;
  map: CustomMapImport;
};

export type CustomMapSummary = {
  id: string;
  guildId: GuildId;
  ownerDiscordUserId: DiscordUserId;
  name: string;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 4: Add shared schemas and validation**

Create `packages/shared/src/maps/schemas.ts`:

```ts
import { z } from "zod";
import { terrainStateSchema, pointSchema } from "../protocol/schemas";

const mapNameSchema = z.string().trim().min(1).max(80);
const spawnPointIdSchema = z.string().trim().min(1).max(80);

export const customMapWorldBoundsSchema = z
  .object({
    minX: z.number().finite(),
    maxX: z.number().finite(),
    minY: z.number().finite(),
    maxY: z.number().finite()
  })
  .refine((bounds) => bounds.minX < bounds.maxX, "minX must be less than maxX")
  .refine((bounds) => bounds.minY < bounds.maxY, "minY must be less than maxY");

export const customMapSpawnPointSchema = z.object({
  id: spawnPointIdSchema,
  position: pointSchema
});

export const customMapTeamSpawnPointIdsSchema = z.object({
  "team-a": z.array(spawnPointIdSchema),
  "team-b": z.array(spawnPointIdSchema)
});

export const customMapImportSchema = z.object({
  format: z.literal("graphwar-map"),
  version: z.literal(1),
  name: mapNameSchema,
  worldBounds: customMapWorldBoundsSchema.optional(),
  terrain: terrainStateSchema,
  spawnPoints: z.array(customMapSpawnPointSchema),
  teamSpawnPointIds: customMapTeamSpawnPointIdsSchema
});

export const persistedCustomMapSchema = customMapImportSchema.extend({
  id: z.string().min(1),
  guildId: z.string().min(1),
  ownerDiscordUserId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const customMapSummarySchema = z.object({
  id: z.string().min(1),
  guildId: z.string().min(1),
  ownerDiscordUserId: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const saveCustomMapRequestSchema = z.object({
  ownerDiscordUserId: z.string().trim().min(1),
  map: customMapImportSchema
});

export function validateCustomMapImportForSave(input: unknown) {
  const map = customMapImportSchema.parse(input);
  if (map.spawnPoints.length < 10) {
    throw new Error("Custom maps must contain at least 10 spawn points.");
  }

  const spawnIds = new Set<string>();
  for (const spawnPoint of map.spawnPoints) {
    if (spawnIds.has(spawnPoint.id)) {
      throw new Error("Spawn point ids must be unique.");
    }
    spawnIds.add(spawnPoint.id);
  }

  for (const teamId of ["team-a", "team-b"] as const) {
    for (const spawnPointId of map.teamSpawnPointIds[teamId]) {
      if (!spawnIds.has(spawnPointId)) {
        throw new Error(`Unknown team spawn point id: ${spawnPointId}`);
      }
    }
  }

  return map;
}
```

Create `packages/shared/src/maps/validation.ts`:

```ts
import type { CustomMapImport } from "./types";
import { validateCustomMapImportForSave } from "./schemas";

export function parseCustomMapForSave(input: unknown): CustomMapImport {
  return validateCustomMapImportForSave(input);
}
```

Create `packages/shared/src/maps/index.ts`:

```ts
export * from "./schemas";
export * from "./types";
export * from "./validation";
```

- [ ] **Step 5: Export maps and extend lobby contracts**

Modify `packages/shared/src/index.ts` to add:

```ts
export * from "./maps";
```

Modify `PersistedServerState` in `packages/shared/src/lobby/types.ts` so each guild value includes:

```ts
customMaps: Record<string, PersistedCustomMap>;
```

Add imports at the top of `packages/shared/src/lobby/types.ts`:

```ts
import type { PersistedCustomMap } from "../maps/types";
```

Add map fields:

```ts
export type LobbyRuntimeSnapshot = {
  // existing fields
  mapId?: string;
  mapName?: string;
};

export type LobbySummary = {
  // existing fields
  mapId?: string;
  mapName?: string;
};

export type CreateLobbyRequest = {
  // existing fields
  mapId?: string;
};
```

Extend `LobbyHttpError["code"]` with:

```ts
| "invalid-map"
```

Modify `packages/shared/src/lobby/schemas.ts`:

```ts
export const createLobbyRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  leaderDiscordUserId: z.string().trim().min(1),
  alias: z.string().trim().min(1).max(24),
  mode: matchModeSchema,
  initialSlot: lobbySlotSchema,
  mapId: z.string().trim().min(1).optional()
});
```

Add optional `mapId` and `mapName` to `lobbyRuntimeSnapshotSchema` and `lobbySummarySchema`:

```ts
mapId: z.string().min(1).optional(),
mapName: z.string().min(1).optional(),
```

- [ ] **Step 6: Run shared tests and typecheck**

Run:

```bash
npm test -- packages/shared/src/maps/schemas.test.ts
npm run check
```

Expected: PASS.

---

## Task 2: Server Persistence And HTTP Map API

**Files:**

- Modify: `apps/server/src/persistence/LocalStateStore.ts`
- Create: `apps/server/src/persistence/LocalStateStore.maps.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write failing persistence tests**

Create `apps/server/src/persistence/LocalStateStore.maps.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { CustomMapImport } from "@graphwar/shared";
import { LocalStateStore } from "./LocalStateStore";

let tempDirs: string[] = [];

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

async function createStore() {
  const dir = await mkdtemp(join(tmpdir(), "graphwar-map-store-"));
  tempDirs.push(dir);
  return new LocalStateStore(join(dir, "state.json"));
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe("LocalStateStore custom maps", () => {
  it("persists custom maps per guild", async () => {
    const store = await createStore();
    const saved = await store.saveCustomMap("guild-a", "alice", customMap());

    expect(saved.guildId).toBe("guild-a");
    expect(saved.ownerDiscordUserId).toBe("alice");
    expect(saved.name).toBe("Test Arena");

    await store.saveCustomMap("guild-b", "alice", customMap("Other Guild Arena"));
    expect(await store.listCustomMaps("guild-a")).toHaveLength(1);
    expect(await store.listCustomMaps("guild-b")).toHaveLength(1);
  });

  it("rejects delete from a non-owner", async () => {
    const store = await createStore();
    const saved = await store.saveCustomMap("guild-a", "alice", customMap());

    await expect(store.deleteCustomMap("guild-a", saved.id, "bob")).rejects.toThrow("Only the map owner");
    expect(await store.getCustomMap("guild-a", saved.id)).toBeDefined();
  });

  it("deletes maps for the owner", async () => {
    const store = await createStore();
    const saved = await store.saveCustomMap("guild-a", "alice", customMap());

    await store.deleteCustomMap("guild-a", saved.id, "alice");
    expect(await store.getCustomMap("guild-a", saved.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- apps/server/src/persistence/LocalStateStore.maps.test.ts
```

Expected: FAIL because `saveCustomMap`, `listCustomMaps`, `getCustomMap`, and `deleteCustomMap` do not exist.

- [ ] **Step 3: Implement LocalStateStore map methods**

Modify `apps/server/src/persistence/LocalStateStore.ts`:

```ts
import { randomUUID } from "node:crypto";
import type {
  CustomMapImport,
  GuildSettings,
  PersistedCustomMap,
  PersistedServerState,
  PlayerStatsEntry
} from "@graphwar/shared";
import { validateCustomMapImportForSave } from "@graphwar/shared";
```

Add helper:

```ts
function ensureGuild(state: PersistedServerState, guildId: string) {
  const guild = (state.guilds[guildId] ??= {
    settings: defaultSettings(guildId),
    leaderboard: {},
    customMaps: {}
  });
  guild.customMaps ??= {};
  return guild;
}
```

Replace direct guild initialization sites with `ensureGuild(state, guildId)` or `ensureGuild(state, settings.guildId)`.

Add methods:

```ts
async listCustomMaps(guildId: string): Promise<PersistedCustomMap[]> {
  const state = await this.readState();
  return Object.values(state.guilds[guildId]?.customMaps ?? {}).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

async getCustomMap(guildId: string, mapId: string): Promise<PersistedCustomMap | undefined> {
  const state = await this.readState();
  return state.guilds[guildId]?.customMaps?.[mapId];
}

async saveCustomMap(
  guildId: string,
  ownerDiscordUserId: string,
  inputMap: CustomMapImport
): Promise<PersistedCustomMap> {
  return this.enqueueMutation(async () => {
    const map = validateCustomMapImportForSave(inputMap);
    const state = await this.readState();
    const guild = ensureGuild(state, guildId);
    const now = nowIso();
    const persisted: PersistedCustomMap = {
      ...map,
      id: randomUUID(),
      guildId,
      ownerDiscordUserId,
      createdAt: now,
      updatedAt: now
    };
    guild.customMaps[persisted.id] = persisted;
    await this.writeState(state);
    return persisted;
  });
}

async deleteCustomMap(guildId: string, mapId: string, actorDiscordUserId: string): Promise<void> {
  return this.enqueueMutation(async () => {
    const state = await this.readState();
    const guild = ensureGuild(state, guildId);
    const existing = guild.customMaps[mapId];
    if (!existing) {
      throw new Error("Custom map not found.");
    }
    if (existing.ownerDiscordUserId !== actorDiscordUserId) {
      throw new Error("Only the map owner can delete this custom map.");
    }
    delete guild.customMaps[mapId];
    await this.writeState(state);
  });
}
```

- [ ] **Step 4: Run persistence tests**

Run:

```bash
npm test -- apps/server/src/persistence/LocalStateStore.maps.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing HTTP API tests**

If there is no current `apps/server/src/index.test.ts`, create `apps/server/src/index.maps.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "./index";
import { LocalStateStore } from "./persistence/LocalStateStore";

let tempDirs: string[] = [];

function customMapBody(ownerDiscordUserId = "alice") {
  return {
    ownerDiscordUserId,
    map: {
      format: "graphwar-map",
      version: 1,
      name: "HTTP Arena",
      terrain: { blobs: [] },
      spawnPoints: Array.from({ length: 10 }, (_, index) => ({
        id: `spawn-${index}`,
        position: { x: index, y: 0 }
      })),
      teamSpawnPointIds: {
        "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
        "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
      }
    }
  };
}

async function createApp() {
  const dir = await mkdtemp(join(tmpdir(), "graphwar-map-api-"));
  tempDirs.push(dir);
  const stateStore = new LocalStateStore(join(dir, "state.json"));
  return buildServer({ stateStore, corsAllowedOrigins: ["http://localhost:5173"] });
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe("custom map HTTP API", () => {
  it("saves and lists maps by guild", async () => {
    const app = await createApp();
    const create = await app.inject({
      method: "POST",
      url: "/guilds/guild-a/maps",
      payload: customMapBody()
    });
    expect(create.statusCode).toBe(201);

    const listA = await app.inject({ method: "GET", url: "/guilds/guild-a/maps" });
    const listB = await app.inject({ method: "GET", url: "/guilds/guild-b/maps" });
    expect(listA.json()).toHaveLength(1);
    expect(listB.json()).toHaveLength(0);

    await app.close();
  });

  it("deletes maps only for the owner", async () => {
    const app = await createApp();
    const create = await app.inject({
      method: "POST",
      url: "/guilds/guild-a/maps",
      payload: customMapBody("alice")
    });
    const saved = create.json();

    const forbidden = await app.inject({
      method: "DELETE",
      url: `/guilds/guild-a/maps/${saved.id}?actorDiscordUserId=bob`
    });
    expect(forbidden.statusCode).toBe(403);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/guilds/guild-a/maps/${saved.id}?actorDiscordUserId=alice`
    });
    expect(deleted.statusCode).toBe(204);

    await app.close();
  });
});
```

- [ ] **Step 6: Run the HTTP tests to verify they fail**

Run:

```bash
npm test -- apps/server/src/index.maps.test.ts
```

Expected: FAIL with 404 for `/guilds/:guildId/maps`.

- [ ] **Step 7: Implement HTTP routes**

Modify imports in `apps/server/src/index.ts`:

```ts
import {
  createLobbyRequestSchema,
  guildSettingsSchema,
  joinLobbyRequestSchema,
  saveCustomMapRequestSchema
} from "@graphwar/shared";
```

Modify CORS methods:

```ts
reply.header("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
```

Add routes before leaderboard:

```ts
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
    return reply
      .code(400)
      .send({ code: "invalid-map", error: error instanceof Error ? error.message : "Custom map could not be saved." });
  }
});

app.delete("/guilds/:guildId/maps/:mapId", async (request, reply) => {
  const { guildId, mapId } = request.params as { guildId: string; mapId: string };
  const url = new URL(request.url, "http://localhost");
  const actorDiscordUserId = url.searchParams.get("actorDiscordUserId")?.trim();
  if (!actorDiscordUserId) {
    return reply.code(400).send({ code: "invalid-map", error: "actorDiscordUserId is required." });
  }

  try {
    await stateStore.deleteCustomMap(guildId, mapId, actorDiscordUserId);
    return reply.code(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Custom map could not be deleted.";
    const status = message.includes("owner") ? 403 : message.includes("not found") ? 404 : 400;
    return reply
      .code(status)
      .send({ code: status === 403 ? "forbidden" : status === 404 ? "not-found" : "invalid-map", error: message });
  }
});
```

- [ ] **Step 8: Verify server map API**

Run:

```bash
npm test -- apps/server/src/persistence/LocalStateStore.maps.test.ts apps/server/src/index.maps.test.ts
npm run check
```

Expected: PASS.

---

## Task 3: Lobby Selection And Custom Map Match Start

**Files:**

- Modify: `apps/server/src/lobbies/LobbyDirectory.ts`
- Create: `apps/server/src/lobbies/LobbyDirectory.maps.test.ts`
- Create: `apps/server/src/maps/CustomMapSpawner.ts`
- Create: `apps/server/src/maps/CustomMapSpawner.test.ts`
- Modify: `apps/server/src/match/MatchController.ts`
- Modify: `apps/server/src/rooms/GameRoom.ts`
- Test: `apps/server/src/match/MatchController.test.ts`

- [ ] **Step 1: Write failing lobby map selection tests**

Create `apps/server/src/lobbies/LobbyDirectory.maps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LobbyDirectory } from "./LobbyDirectory";

describe("LobbyDirectory custom map selection", () => {
  it("stores selected map id and name in lobby snapshots and summaries", async () => {
    const directory = new LobbyDirectory({
      createRoomId: () => "room-1",
      createSessionToken: () => "token-1",
      resolveCustomMapName: async (_guildId, mapId) => (mapId === "map-1" ? "Imported Arena" : undefined)
    });

    const result = await directory.createLobby("guild-a", {
      name: "Map Lobby",
      leaderDiscordUserId: "alice",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      mapId: "map-1"
    });

    expect(result.lobby.mapId).toBe("map-1");
    expect(result.lobby.mapName).toBe("Imported Arena");
    expect(directory.listLobbies("guild-a")[0]).toMatchObject({ mapId: "map-1", mapName: "Imported Arena" });
  });

  it("rejects an unknown selected map", async () => {
    const directory = new LobbyDirectory({
      resolveCustomMapName: async () => undefined
    });

    await expect(
      directory.createLobby("guild-a", {
        name: "Map Lobby",
        leaderDiscordUserId: "alice",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        mapId: "missing-map"
      })
    ).rejects.toThrow("Custom map not found");
  });
});
```

- [ ] **Step 2: Run lobby tests to verify they fail**

Run:

```bash
npm test -- apps/server/src/lobbies/LobbyDirectory.maps.test.ts
```

Expected: FAIL because `resolveCustomMapName` and lobby map fields do not exist.

- [ ] **Step 3: Implement lobby map fields**

Modify `LobbyDirectoryOptions`:

```ts
resolveCustomMapName?: (guildId: string, mapId: string) => Promise<string | undefined>;
```

Add private field:

```ts
private readonly resolveCustomMapName: (guildId: string, mapId: string) => Promise<string | undefined>;
```

Initialize:

```ts
this.resolveCustomMapName = options.resolveCustomMapName ?? (async () => undefined);
```

Add to `RuntimeLobby`:

```ts
mapId?: string;
mapName?: string;
```

In `createLobby`, before constructing the lobby:

```ts
const mapId = request.mapId?.trim();
const mapName = mapId ? await this.resolveCustomMapName(guildId, mapId) : undefined;
if (mapId && !mapName) {
  throw new Error("Custom map not found.");
}
```

Add to the lobby object:

```ts
mapId,
mapName,
```

Add `mapId` and `mapName` to `listLobbies()` return and `snapshot()`.

- [ ] **Step 4: Run lobby tests**

Run:

```bash
npm test -- apps/server/src/lobbies/LobbyDirectory.maps.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing custom map spawner tests**

Create `apps/server/src/maps/CustomMapSpawner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PersistedCustomMap, TeamState } from "@graphwar/shared";
import { createGeneratedMapFromCustomMap } from "./CustomMapSpawner";

function map(): PersistedCustomMap {
  return {
    format: "graphwar-map",
    version: 1,
    id: "map-1",
    guildId: "guild-a",
    ownerDiscordUserId: "alice",
    name: "Spawn Arena",
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    terrain: {
      blobs: [
        {
          id: "platform",
          outer: [
            { x: -1, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 }
          ],
          holes: []
        }
      ]
    },
    spawnPoints: [
      { id: "a0", position: { x: -20, y: -5 } },
      { id: "a1", position: { x: -20, y: 5 } },
      { id: "b0", position: { x: 20, y: -5 } },
      { id: "b1", position: { x: 20, y: 5 } },
      { id: "c0", position: { x: 0, y: 10 } },
      { id: "c1", position: { x: 0, y: -10 } },
      { id: "c2", position: { x: -10, y: 0 } },
      { id: "c3", position: { x: 10, y: 0 } },
      { id: "c4", position: { x: -12, y: 8 } },
      { id: "c5", position: { x: 12, y: -8 } }
    ],
    teamSpawnPointIds: { "team-a": ["a0", "a1"], "team-b": ["b0", "b1"] }
  };
}

describe("CustomMapSpawner", () => {
  it("assigns team-versus players to their team's spawn subsets", () => {
    const teams: TeamState[] = [
      { id: "team-a", playerIds: ["alice", "amy"], alivePlayerIds: ["alice", "amy"] },
      { id: "team-b", playerIds: ["bob", "bea"], alivePlayerIds: ["bob", "bea"] }
    ];

    const generated = createGeneratedMapFromCustomMap({
      map: map(),
      modeId: "team-versus",
      teams,
      playerIds: ["alice", "amy", "bob", "bea"],
      seed: "room-1"
    });

    expect(generated.terrain.blobs[0].id).toBe("platform");
    expect(generated.spawns.find((spawn) => spawn.playerId === "alice")?.position.x).toBeLessThan(0);
    expect(generated.spawns.find((spawn) => spawn.playerId === "bob")?.position.x).toBeGreaterThan(0);
  });

  it("blocks team-versus starts when team spawns are insufficient", () => {
    const teams: TeamState[] = [
      { id: "team-a", playerIds: ["alice", "amy", "ava"], alivePlayerIds: ["alice", "amy", "ava"] },
      { id: "team-b", playerIds: ["bob"], alivePlayerIds: ["bob"] }
    ];

    expect(() =>
      createGeneratedMapFromCustomMap({
        map: map(),
        modeId: "team-versus",
        teams,
        playerIds: ["alice", "amy", "ava", "bob"],
        seed: "room-1"
      })
    ).toThrow("Team A needs at least 3 custom map spawns");
  });

  it("assigns free-for-all spawns by maximizing separation", () => {
    const generated = createGeneratedMapFromCustomMap({
      map: map(),
      modeId: "free-for-all",
      teams: [],
      playerIds: ["alice", "bob", "charlie"],
      seed: "room-1"
    });

    expect(generated.spawns).toHaveLength(3);
    const uniquePositions = new Set(generated.spawns.map((spawn) => `${spawn.position.x},${spawn.position.y}`));
    expect(uniquePositions.size).toBe(3);
  });
});
```

- [ ] **Step 6: Run spawner tests to verify they fail**

Run:

```bash
npm test -- apps/server/src/maps/CustomMapSpawner.test.ts
```

Expected: FAIL because `CustomMapSpawner` does not exist.

- [ ] **Step 7: Implement `CustomMapSpawner`**

Create `apps/server/src/maps/CustomMapSpawner.ts`:

```ts
import type { MatchModeId, PersistedCustomMap, PlayerId, TeamState, WorldPoint } from "@graphwar/shared";
import { teamVersusTeamIds } from "../modes/TeamAssignment";
import type { GeneratedMap, SpawnPoint } from "./MapGenerator";

type CreateGeneratedMapInput = {
  map: PersistedCustomMap;
  modeId: MatchModeId;
  teams: TeamState[];
  playerIds: PlayerId[];
  seed: string;
};

function clonePoint(point: WorldPoint): WorldPoint {
  return { x: point.x, y: point.y };
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicOrder<T>(items: T[], seed: string, key: (item: T) => string): T[] {
  return [...items].sort((left, right) => {
    const leftHash = hashString(`${seed}:${key(left)}`);
    const rightHash = hashString(`${seed}:${key(right)}`);
    return leftHash - rightHash || key(left).localeCompare(key(right));
  });
}

function distanceSquared(left: WorldPoint, right: WorldPoint): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function spawnById(map: PersistedCustomMap): Map<string, WorldPoint> {
  return new Map(map.spawnPoints.map((spawnPoint) => [spawnPoint.id, spawnPoint.position]));
}

function spawnsForTeam(map: PersistedCustomMap, teamId: "team-a" | "team-b", playerIds: PlayerId[], seed: string): SpawnPoint[] {
  const positionsById = spawnById(map);
  const spawnIds = map.teamSpawnPointIds[teamId].filter((spawnId) => positionsById.has(spawnId));
  if (spawnIds.length < playerIds.length) {
    throw new Error(`${teamId === "team-a" ? "Team A" : "Team B"} needs at least ${playerIds.length} custom map spawns.`);
  }

  const orderedSpawnIds = deterministicOrder(spawnIds, `${seed}:${teamId}`, (spawnId) => spawnId);
  return playerIds.map((playerId, index) => ({
    playerId,
    position: clonePoint(positionsById.get(orderedSpawnIds[index])!)
  }));
}

function createTeamSpawns(map: PersistedCustomMap, teams: TeamState[], seed: string): SpawnPoint[] {
  return teamVersusTeamIds.flatMap((teamId) => {
    const team = teams.find((candidate) => candidate.id === teamId);
    return spawnsForTeam(map, teamId, team?.playerIds ?? [], seed);
  });
}

function createFreeForAllSpawns(map: PersistedCustomMap, playerIds: PlayerId[], seed: string): SpawnPoint[] {
  if (map.spawnPoints.length < playerIds.length) {
    throw new Error(`Free for all needs at least ${playerIds.length} custom map spawns.`);
  }

  const candidates = deterministicOrder(map.spawnPoints, seed, (spawnPoint) => spawnPoint.id);
  const selected = [candidates[0]];
  while (selected.length < playerIds.length) {
    const remaining = candidates.filter((candidate) => !selected.some((spawnPoint) => spawnPoint.id === candidate.id));
    remaining.sort((left, right) => {
      const leftDistance = Math.min(...selected.map((spawnPoint) => distanceSquared(left.position, spawnPoint.position)));
      const rightDistance = Math.min(...selected.map((spawnPoint) => distanceSquared(right.position, spawnPoint.position)));
      return rightDistance - leftDistance || left.id.localeCompare(right.id);
    });
    selected.push(remaining[0]);
  }

  return playerIds.map((playerId, index) => ({
    playerId,
    position: clonePoint(selected[index].position)
  }));
}

export function createGeneratedMapFromCustomMap({
  map,
  modeId,
  teams,
  playerIds,
  seed
}: CreateGeneratedMapInput): GeneratedMap {
  return {
    terrain: structuredClone(map.terrain),
    spawns: modeId === "team-versus" ? createTeamSpawns(map, teams, seed) : createFreeForAllSpawns(map, playerIds, seed)
  };
}
```

- [ ] **Step 8: Run spawner tests**

Run:

```bash
npm test -- apps/server/src/maps/CustomMapSpawner.test.ts
```

Expected: PASS.

- [ ] **Step 9: Integrate selected map into match start**

Modify `apps/server/src/match/MatchController.ts`:

```ts
startMatch(modeId: MatchModeId, customMap?: GeneratedMap): MatchState {
  // existing checks
  const map = customMap ?? this.createMap(modeId, teams, playerIds);
  // existing player creation
}
```

Modify `apps/server/src/index.ts` when constructing `LobbyDirectory`:

```ts
resolveCustomMapName: async (guildId, mapId) => (await stateStore.getCustomMap(guildId, mapId))?.name
```

Modify `apps/server/src/rooms/GameRoom.ts` imports:

```ts
import { createGeneratedMapFromCustomMap } from "../maps/CustomMapSpawner";
```

In `start-match` lobby command, after `const lobby = context.lobbies.markPlaying(...)` and before `this.match.startMatch`:

```ts
const selectedCustomMap = lobby.mapId ? await context.stateStore.getCustomMap(context.guildId, lobby.mapId) : undefined;
if (lobby.mapId && !selectedCustomMap) {
  throw new Error("Custom map not found.");
}
const playerOccupants = context.lobbies.playerOccupants(context.guildId, this.roomId);
const customGeneratedMap = selectedCustomMap
  ? createGeneratedMapFromCustomMap({
      map: selectedCustomMap,
      modeId: lobby.mode,
      teams: this.match.getSnapshot().teams,
      playerIds: playerOccupants.map((occupant) => occupant.playerId),
      seed: `${this.roomId}:${selectedCustomMap.id}`
    })
  : undefined;
const snapshot = this.match.startMatch(lobby.mode, customGeneratedMap);
```

If `markPlaying` happens before custom map validation and validation fails, adjust order so custom map generation is attempted before `markPlaying`.

- [ ] **Step 10: Verify server integration**

Run:

```bash
npm test -- apps/server/src/lobbies/LobbyDirectory.maps.test.ts apps/server/src/maps/CustomMapSpawner.test.ts apps/server/src/match/MatchController.test.ts apps/server/src/rooms/RoomManager.integration.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 11: Update README, commit, and push server checkpoint**

Update README:

- Add custom map server persistence/API to Current Status and Current Workspace.
- Add custom map server tests to Install And Checks.
- Add checkpoint log entry for server custom maps.

Run:

```bash
git add README.md packages/shared/src apps/server/src
git commit -m "feat: add custom map server support"
git push origin feature/graphwar-prototype
```

Expected: commit and push succeed.

---

## Task 4: Client Custom Maps Menu And Lobby Selection

**Files:**

- Modify: `apps/client/src/networking/lobbyApi.ts`
- Modify: `apps/client/src/app/useGameStore.ts`
- Modify: `apps/client/src/app/App.tsx`
- Modify: `apps/client/src/menu/MainMenu.tsx`
- Modify: `apps/client/src/lobby/CreateLobbyView.tsx`
- Create: `apps/client/src/maps/mapFile.ts`
- Create: `apps/client/src/maps/mapFile.test.ts`
- Create: `apps/client/src/maps/MapLibraryView.tsx`
- Create: `apps/client/src/maps/MapLibraryView.test.tsx`
- Modify: `apps/client/src/styles.css`

- [ ] **Step 1: Write failing map file parser test**

Create `apps/client/src/maps/mapFile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCustomMapFileText } from "./mapFile";

describe("parseCustomMapFileText", () => {
  it("parses valid graphwar map JSON", () => {
    const map = parseCustomMapFileText(
      JSON.stringify({
        format: "graphwar-map",
        version: 1,
        name: "Client Import Arena",
        terrain: { blobs: [] },
        spawnPoints: Array.from({ length: 10 }, (_, index) => ({
          id: `spawn-${index}`,
          position: { x: index, y: 0 }
        })),
        teamSpawnPointIds: {
          "team-a": ["spawn-0"],
          "team-b": ["spawn-1"]
        }
      })
    );

    expect(map.name).toBe("Client Import Arena");
  });

  it("returns a readable error for invalid JSON", () => {
    expect(() => parseCustomMapFileText("{bad json")).toThrow("Map file must be valid JSON");
  });
});
```

- [ ] **Step 2: Run parser test to verify it fails**

Run:

```bash
npm test -- apps/client/src/maps/mapFile.test.ts
```

Expected: FAIL because `mapFile` does not exist.

- [ ] **Step 3: Implement map file parser**

Create `apps/client/src/maps/mapFile.ts`:

```ts
import { validateCustomMapImportForSave, type CustomMapImport } from "@graphwar/shared";

export function parseCustomMapFileText(text: string): CustomMapImport {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Map file must be valid JSON.");
  }

  try {
    return validateCustomMapImportForSave(payload);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Map file is not a valid Graphwar map.");
  }
}
```

- [ ] **Step 4: Run parser test**

Run:

```bash
npm test -- apps/client/src/maps/mapFile.test.ts
```

Expected: PASS.

- [ ] **Step 5: Extend lobby API**

Modify `apps/client/src/networking/lobbyApi.ts` imports:

```ts
import {
  customMapImportSchema,
  persistedCustomMapSchema,
  saveCustomMapRequestSchema,
  type CustomMapImport,
  type PersistedCustomMap,
  type SaveCustomMapRequest
} from "@graphwar/shared";
```

Add methods to returned object:

```ts
async listCustomMaps(guildId: string): Promise<PersistedCustomMap[]> {
  const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/maps`);
  return readJson(response, (value) => persistedCustomMapSchema.array().parse(value));
},
async saveCustomMap(guildId: string, request: SaveCustomMapRequest): Promise<PersistedCustomMap> {
  const response = await fetch(`${base}/guilds/${encodeURIComponent(guildId)}/maps`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(saveCustomMapRequestSchema.parse(request))
  });
  return readJson(response, (value) => persistedCustomMapSchema.parse(value));
},
async deleteCustomMap(guildId: string, mapId: string, actorDiscordUserId: string): Promise<void> {
  const response = await fetch(
    `${base}/guilds/${encodeURIComponent(guildId)}/maps/${encodeURIComponent(mapId)}?actorDiscordUserId=${encodeURIComponent(
      actorDiscordUserId
    )}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    await readJson(response, (value) => value);
  }
}
```

- [ ] **Step 6: Extend store state and actions**

Modify `apps/client/src/app/useGameStore.ts` imports to include:

```ts
type CustomMapImport,
type PersistedCustomMap
```

Add `custom-maps` to `AppView`.

Add fields/actions:

```ts
customMaps: PersistedCustomMap[];
loadCustomMaps(): Promise<void>;
saveCustomMap(map: CustomMapImport): Promise<void>;
deleteCustomMap(mapId: string): Promise<void>;
```

Update `createLobby` form type:

```ts
createLobby(form: { name: string; alias: string; mode: MatchModeId; initialSlot: LobbySlot; mapId?: string }): Promise<void>;
```

Pass `mapId: form.mapId` into `lobbyApi.createLobby`.

Implement actions:

```ts
customMaps: [],
async loadCustomMaps() {
  try {
    const customMaps = await lobbyApi.listCustomMaps(session.guildId);
    set({ customMaps, lastError: undefined, lastRejection: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load custom maps.";
    set({ lastError: message, lastRejection: undefined });
    throw error;
  }
},
async saveCustomMap(map) {
  try {
    const saved = await lobbyApi.saveCustomMap(session.guildId, {
      ownerDiscordUserId: session.discordUserId,
      map
    });
    set((state) => ({ customMaps: [...state.customMaps.filter((candidate) => candidate.id !== saved.id), saved] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save custom map.";
    set({ lastError: message, lastRejection: undefined });
    throw error;
  }
},
async deleteCustomMap(mapId) {
  try {
    await lobbyApi.deleteCustomMap(session.guildId, mapId, session.discordUserId);
    set((state) => ({ customMaps: state.customMaps.filter((map) => map.id !== mapId) }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete custom map.";
    set({ lastError: message, lastRejection: undefined });
    throw error;
  }
},
```

- [ ] **Step 7: Write failing map library component tests**

Create `apps/client/src/maps/MapLibraryView.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PersistedCustomMap } from "@graphwar/shared";
import { MapLibraryView } from "./MapLibraryView";

function persistedMap(ownerDiscordUserId = "alice"): PersistedCustomMap {
  return {
    format: "graphwar-map",
    version: 1,
    id: "map-1",
    guildId: "guild-a",
    ownerDiscordUserId,
    name: "Imported Arena",
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    terrain: { blobs: [] },
    spawnPoints: Array.from({ length: 10 }, (_, index) => ({ id: `spawn-${index}`, position: { x: index, y: 0 } })),
    teamSpawnPointIds: { "team-a": ["spawn-0"], "team-b": ["spawn-1"] }
  };
}

describe("MapLibraryView", () => {
  it("lists custom maps and shows delete only for owned maps", () => {
    render(
      <MapLibraryView
        currentDiscordUserId="alice"
        guildId="guild-a"
        maps={[persistedMap("alice"), { ...persistedMap("bob"), id: "map-2", name: "Bob Arena" }]}
        onBack={vi.fn()}
        onDelete={vi.fn()}
        onImportText={vi.fn()}
        onLoad={vi.fn()}
      />
    );

    expect(screen.getByText("Imported Arena")).toBeInTheDocument();
    expect(screen.getByText("Bob Arena")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(1);
  });

  it("calls delete for an owned map", () => {
    const onDelete = vi.fn();
    render(
      <MapLibraryView
        currentDiscordUserId="alice"
        guildId="guild-a"
        maps={[persistedMap("alice")]}
        onBack={vi.fn()}
        onDelete={onDelete}
        onImportText={vi.fn()}
        onLoad={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("map-1");
  });
});
```

If testing library is not installed, add `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` as dev dependencies and configure Vitest client tests consistently with existing client tests.

- [ ] **Step 8: Run component test to verify it fails**

Run:

```bash
npm test -- apps/client/src/maps/MapLibraryView.test.tsx
```

Expected: FAIL because `MapLibraryView` does not exist.

- [ ] **Step 9: Implement `MapLibraryView`**

Create `apps/client/src/maps/MapLibraryView.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import type { PersistedCustomMap } from "@graphwar/shared";

type MapLibraryViewProps = {
  currentDiscordUserId: string;
  guildId: string;
  maps: PersistedCustomMap[];
  onBack: () => void;
  onDelete: (mapId: string) => Promise<void> | void;
  onImportText: (text: string) => Promise<void> | void;
  onLoad: () => Promise<void> | void;
};

export function MapLibraryView({
  currentDiscordUserId,
  guildId,
  maps,
  onBack,
  onDelete,
  onImportText,
  onLoad
}: MapLibraryViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void onLoad();
  }, [onLoad]);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onImportText(await file.text());
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import map.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel menu-panel map-library-screen" aria-labelledby="custom-maps-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Guild {guildId}</p>
          <h2 id="custom-maps-title">Custom Maps</h2>
        </div>
      </div>
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button className="secondary-action" onClick={onBack} type="button">
          Back
        </button>
        <button className="primary-action" disabled={busy} onClick={() => inputRef.current?.click()} type="button">
          {busy ? "Importing" : "Load Custom Map"}
        </button>
        <input
          ref={inputRef}
          accept="application/json,.json,.graphwar-map.json"
          className="hidden-file-input"
          onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
          type="file"
        />
      </div>
      <div className="map-list" aria-label="Custom maps">
        {maps.length === 0 ? (
          <p className="notice">No custom maps saved for this guild.</p>
        ) : (
          maps.map((map) => (
            <div className="map-row" key={map.id}>
              <div>
                <strong>{map.name}</strong>
                <span>Owner {map.ownerDiscordUserId}</span>
              </div>
              {map.ownerDiscordUserId === currentDiscordUserId ? (
                <button className="secondary-action compact-action" onClick={() => void onDelete(map.id)} type="button">
                  Delete
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 10: Add route, menu button, and create lobby map selector**

Modify `apps/client/src/menu/MainMenu.tsx`:

```tsx
<button className="secondary-action" onClick={() => onNavigate("custom-maps")} type="button">
  Custom Maps
</button>
```

Modify `CreateLobbyView` props and form:

```ts
customMaps?: PersistedCustomMap[];
onCreate: (form: { name: string; alias: string; mode: MatchModeId; initialSlot: LobbySlot; mapId?: string }) => Promise<void>;
```

Add state:

```ts
const [mapId, setMapId] = useState("");
```

Submit:

```ts
await onCreate({ ...prepareCreateLobbyForm({ name, alias, mode, initialSlot }).form, mapId: mapId || undefined });
```

Add label before initial slot:

```tsx
<label>
  Map
  <select value={mapId} onChange={(event) => setMapId(event.currentTarget.value)}>
    <option value="">Default Map</option>
    {(customMaps ?? []).map((map) => (
      <option key={map.id} value={map.id}>
        {map.name}
      </option>
    ))}
  </select>
</label>
```

Modify `apps/client/src/app/App.tsx`:

```ts
import { MapLibraryView } from "../maps/MapLibraryView";
import { parseCustomMapFileText } from "../maps/mapFile";
```

Read store actions:

```ts
const customMaps = useGameStore((state) => state.customMaps);
const loadCustomMaps = useGameStore((state) => state.loadCustomMaps);
const saveCustomMap = useGameStore((state) => state.saveCustomMap);
const deleteCustomMap = useGameStore((state) => state.deleteCustomMap);
```

Load maps for create lobby:

```ts
useEffect(() => {
  if (view === "create-lobby" || view === "custom-maps") {
    void loadCustomMaps();
  }
}, [loadCustomMaps, view]);
```

Pass `customMaps` into `CreateLobbyView`.

Add view:

```tsx
if (view === "custom-maps") {
  return (
    <MapLibraryView
      currentDiscordUserId={session.discordUserId}
      guildId={session.guildId}
      maps={customMaps}
      onBack={() => setView("main-menu")}
      onDelete={deleteCustomMap}
      onImportText={async (text) => saveCustomMap(parseCustomMapFileText(text))}
      onLoad={loadCustomMaps}
    />
  );
}
```

- [ ] **Step 11: Add compact CSS**

Modify `apps/client/src/styles.css`:

```css
.hidden-file-input {
  display: none;
}

.map-library-screen {
  width: min(760px, 92vw);
}

.map-list {
  display: grid;
  gap: 0.5rem;
  min-height: 0;
  overflow: hidden;
}

.map-row {
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  min-height: 3rem;
  padding: 0.55rem 0.65rem;
}

.map-row strong,
.map-row span {
  display: block;
}

.map-row span {
  color: var(--muted-text);
  font-size: 0.78rem;
}

.compact-action {
  min-height: 2.25rem;
  padding-inline: 0.75rem;
}
```

- [ ] **Step 12: Verify client flow**

Run:

```bash
npm test -- apps/client/src/maps apps/client/src/lobby apps/client/src/app
npm run check
npm --workspace apps/client run build
```

Expected: PASS.

- [ ] **Step 13: Update README, commit, and push client checkpoint**

Update README:

- Main menu includes Custom Maps.
- Create lobby can select Default Map or a guild custom map.
- Local testing can import a map file from the menu.

Run:

```bash
git add README.md apps/client/src packages/shared/src apps/server/src
git commit -m "feat: add custom map client flow"
git push origin feature/graphwar-prototype
```

Expected: commit and push succeed.

---

## Task 5: Electron Map Maker Workspace

**Files:**

- Modify: `package.json`
- Create: `apps/map-maker/package.json`
- Create: `apps/map-maker/tsconfig.json`
- Create: `apps/map-maker/vite.config.ts`
- Create: `apps/map-maker/index.html`
- Create: `apps/map-maker/src/main.ts`
- Create: `apps/map-maker/src/preload.ts`
- Create: `apps/map-maker/src/editor/editorTypes.ts`
- Create: `apps/map-maker/src/editor/editorModel.ts`
- Create: `apps/map-maker/src/editor/editorModel.test.ts`
- Create: `apps/map-maker/src/editor/mapExport.ts`
- Create: `apps/map-maker/src/editor/mapExport.test.ts`
- Create: `apps/map-maker/src/renderer/App.tsx`
- Create: `apps/map-maker/src/renderer/main.tsx`
- Create: `apps/map-maker/src/renderer/styles.css`

- [ ] **Step 1: Install Electron dependency if absent**

Run:

```bash
npm install --workspace apps/map-maker electron
```

If `apps/map-maker` does not exist yet, create `apps/map-maker/package.json` first with the content from Step 5, then run:

```bash
npm install
```

Expected: `package-lock.json` includes Electron. If network sandbox blocks installation, rerun the same install command with escalation.

- [ ] **Step 2: Write failing editor model tests**

Create `apps/map-maker/src/editor/editorModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addCircleTerrain,
  addPenPoint,
  addRectangleTerrain,
  addSpawnPoint,
  addTriangleTerrain,
  closePenShape,
  createEmptyEditorState,
  moveSelected,
  scaleSelectedFromBounds,
  selectItem,
  toggleTeamSpawn
} from "./editorModel";

describe("editorModel", () => {
  it("creates common polygon terrain shapes", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 2);
    state = addTriangleTerrain(state, { x: 10, y: 0 }, 6, 4);
    state = addCircleTerrain(state, { x: -10, y: 0 }, 3, 16);

    expect(state.terrainShapes).toHaveLength(3);
    expect(state.terrainShapes[0].points).toHaveLength(4);
    expect(state.terrainShapes[1].points).toHaveLength(3);
    expect(state.terrainShapes[2].points).toHaveLength(16);
  });

  it("closes a pen shape with at least three points", () => {
    let state = createEmptyEditorState();
    state = addPenPoint(state, { x: 0, y: 0 });
    state = addPenPoint(state, { x: 4, y: 0 });
    state = addPenPoint(state, { x: 0, y: 4 });
    state = closePenShape(state);

    expect(state.terrainShapes).toHaveLength(1);
    expect(state.penPoints).toHaveLength(0);
  });

  it("moves and scales selected terrain", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 2);
    state = selectItem(state, { type: "terrain", id: state.terrainShapes[0].id });
    state = moveSelected(state, { x: 2, y: 3 });
    state = scaleSelectedFromBounds(state, { minX: 0, minY: 0, maxX: 8, maxY: 4 });

    const xs = state.terrainShapes[0].points.map((point) => point.x);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(8);
  });

  it("assigns team subsets from existing spawn points", () => {
    let state = createEmptyEditorState();
    state = addSpawnPoint(state, { x: -5, y: 0 });
    state = toggleTeamSpawn(state, state.spawnPoints[0].id, "team-a");

    expect(state.teamSpawnPointIds["team-a"]).toEqual([state.spawnPoints[0].id]);
  });
});
```

- [ ] **Step 3: Run editor model tests to verify they fail**

Run:

```bash
npm test -- apps/map-maker/src/editor/editorModel.test.ts
```

Expected: FAIL because editor model functions do not exist.

- [ ] **Step 4: Add map maker package config**

Create `apps/map-maker/package.json`:

```json
{
  "name": "@graphwar/map-maker",
  "private": true,
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -p tsconfig.json && vite build",
    "start": "electron ."
  },
  "dependencies": {
    "@graphwar/shared": "file:../../packages/shared",
    "@vitejs/plugin-react": "^4.3.1",
    "electron": "^31.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "vite": "^5.3.2",
    "typescript": "^5.5.3"
  }
}
```

Modify root `package.json` scripts:

```json
"dev:map-maker": "npm --workspace apps/map-maker run dev",
"build:map-maker": "npm --workspace apps/map-maker run build"
```

Modify root `tsconfig.json` references:

```json
{ "path": "./apps/map-maker" }
```

Create `apps/map-maker/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node", "vite/client"]
  },
  "include": ["src"]
}
```

Create `apps/map-maker/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/renderer",
    emptyOutDir: false
  }
});
```

Create `apps/map-maker/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Graphwar Map Maker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Implement editor model**

Create `apps/map-maker/src/editor/editorTypes.ts`:

```ts
import type { CustomMapTeamSpawnPointIds, WorldPoint } from "@graphwar/shared";

export type EditorTerrainShape = {
  id: string;
  points: WorldPoint[];
};

export type EditorSpawnPoint = {
  id: string;
  position: WorldPoint;
};

export type EditorSelection =
  | { type: "terrain"; id: string }
  | { type: "spawn"; id: string }
  | undefined;

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type EditorState = {
  mapName: string;
  terrainShapes: EditorTerrainShape[];
  spawnPoints: EditorSpawnPoint[];
  teamSpawnPointIds: CustomMapTeamSpawnPointIds;
  penPoints: WorldPoint[];
  selection?: EditorSelection;
};
```

Create `apps/map-maker/src/editor/editorModel.ts` with deterministic ids and pure functions:

```ts
import type { Bounds, EditorSelection, EditorState, EditorTerrainShape } from "./editorTypes";
import type { WorldPoint } from "@graphwar/shared";

function nextId(prefix: string, count: number): string {
  return `${prefix}-${count + 1}`;
}

function translate(points: WorldPoint[], delta: WorldPoint): WorldPoint[] {
  return points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));
}

function boundsOf(points: WorldPoint[]): Bounds {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y))
  };
}

function scalePoints(points: WorldPoint[], nextBounds: Bounds): WorldPoint[] {
  const previous = boundsOf(points);
  const width = previous.maxX - previous.minX || 1;
  const height = previous.maxY - previous.minY || 1;
  return points.map((point) => ({
    x: nextBounds.minX + ((point.x - previous.minX) / width) * (nextBounds.maxX - nextBounds.minX),
    y: nextBounds.minY + ((point.y - previous.minY) / height) * (nextBounds.maxY - nextBounds.minY)
  }));
}

export function createEmptyEditorState(): EditorState {
  return {
    mapName: "Custom Arena",
    terrainShapes: [],
    spawnPoints: [],
    teamSpawnPointIds: { "team-a": [], "team-b": [] },
    penPoints: []
  };
}

export function addRectangleTerrain(state: EditorState, center: WorldPoint, width: number, height: number): EditorState {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shape: EditorTerrainShape = {
    id: nextId("terrain", state.terrainShapes.length),
    points: [
      { x: center.x - halfWidth, y: center.y - halfHeight },
      { x: center.x + halfWidth, y: center.y - halfHeight },
      { x: center.x + halfWidth, y: center.y + halfHeight },
      { x: center.x - halfWidth, y: center.y + halfHeight }
    ]
  };
  return { ...state, terrainShapes: [...state.terrainShapes, shape], selection: { type: "terrain", id: shape.id } };
}

export function addTriangleTerrain(state: EditorState, center: WorldPoint, width: number, height: number): EditorState {
  const shape: EditorTerrainShape = {
    id: nextId("terrain", state.terrainShapes.length),
    points: [
      { x: center.x, y: center.y + height / 2 },
      { x: center.x - width / 2, y: center.y - height / 2 },
      { x: center.x + width / 2, y: center.y - height / 2 }
    ]
  };
  return { ...state, terrainShapes: [...state.terrainShapes, shape], selection: { type: "terrain", id: shape.id } };
}

export function addCircleTerrain(state: EditorState, center: WorldPoint, radius: number, segments = 24): EditorState {
  const shape: EditorTerrainShape = {
    id: nextId("terrain", state.terrainShapes.length),
    points: Array.from({ length: segments }, (_, index) => {
      const angle = (Math.PI * 2 * index) / segments;
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    })
  };
  return { ...state, terrainShapes: [...state.terrainShapes, shape], selection: { type: "terrain", id: shape.id } };
}

export function addPenPoint(state: EditorState, point: WorldPoint): EditorState {
  return { ...state, penPoints: [...state.penPoints, point] };
}

export function closePenShape(state: EditorState): EditorState {
  if (state.penPoints.length < 3) {
    return state;
  }
  const shape = { id: nextId("terrain", state.terrainShapes.length), points: state.penPoints };
  return {
    ...state,
    terrainShapes: [...state.terrainShapes, shape],
    penPoints: [],
    selection: { type: "terrain", id: shape.id }
  };
}

export function addSpawnPoint(state: EditorState, position: WorldPoint): EditorState {
  const spawn = { id: nextId("spawn", state.spawnPoints.length), position };
  return { ...state, spawnPoints: [...state.spawnPoints, spawn], selection: { type: "spawn", id: spawn.id } };
}

export function selectItem(state: EditorState, selection: EditorSelection): EditorState {
  return { ...state, selection };
}

export function moveSelected(state: EditorState, delta: WorldPoint): EditorState {
  if (!state.selection) {
    return state;
  }
  if (state.selection.type === "terrain") {
    return {
      ...state,
      terrainShapes: state.terrainShapes.map((shape) =>
        shape.id === state.selection?.id ? { ...shape, points: translate(shape.points, delta) } : shape
      )
    };
  }
  return {
    ...state,
    spawnPoints: state.spawnPoints.map((spawn) =>
      spawn.id === state.selection?.id
        ? { ...spawn, position: { x: spawn.position.x + delta.x, y: spawn.position.y + delta.y } }
        : spawn
    )
  };
}

export function scaleSelectedFromBounds(state: EditorState, bounds: Bounds): EditorState {
  if (!state.selection || state.selection.type !== "terrain") {
    return state;
  }
  return {
    ...state,
    terrainShapes: state.terrainShapes.map((shape) =>
      shape.id === state.selection?.id ? { ...shape, points: scalePoints(shape.points, bounds) } : shape
    )
  };
}

export function toggleTeamSpawn(state: EditorState, spawnPointId: string, teamId: "team-a" | "team-b"): EditorState {
  const next = {
    "team-a": state.teamSpawnPointIds["team-a"].filter((id) => id !== spawnPointId),
    "team-b": state.teamSpawnPointIds["team-b"].filter((id) => id !== spawnPointId)
  };
  next[teamId] = [...next[teamId], spawnPointId];
  return { ...state, teamSpawnPointIds: next };
}
```

- [ ] **Step 6: Run editor model tests**

Run:

```bash
npm test -- apps/map-maker/src/editor/editorModel.test.ts
```

Expected: PASS.

- [ ] **Step 7: Write failing map export tests**

Create `apps/map-maker/src/editor/mapExport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addRectangleTerrain, addSpawnPoint, createEmptyEditorState, toggleTeamSpawn } from "./editorModel";
import { exportEditorMap } from "./mapExport";

describe("exportEditorMap", () => {
  it("exports editor terrain and spawns as graphwar map JSON", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 2);
    for (let index = 0; index < 10; index += 1) {
      state = addSpawnPoint(state, { x: index, y: 0 });
    }
    state = toggleTeamSpawn(state, state.spawnPoints[0].id, "team-a");
    state = toggleTeamSpawn(state, state.spawnPoints[5].id, "team-b");

    const exported = exportEditorMap(state);
    expect(exported.format).toBe("graphwar-map");
    expect(exported.terrain.blobs).toHaveLength(1);
    expect(exported.spawnPoints).toHaveLength(10);
  });

  it("blocks export with fewer than ten spawn points", () => {
    expect(() => exportEditorMap(createEmptyEditorState())).toThrow("at least 10 spawn points");
  });
});
```

- [ ] **Step 8: Run export tests to verify they fail**

Run:

```bash
npm test -- apps/map-maker/src/editor/mapExport.test.ts
```

Expected: FAIL because `mapExport` does not exist.

- [ ] **Step 9: Implement map export**

Create `apps/map-maker/src/editor/mapExport.ts`:

```ts
import { validateCustomMapImportForSave, type CustomMapImport } from "@graphwar/shared";
import type { EditorState } from "./editorTypes";

export function exportEditorMap(state: EditorState): CustomMapImport {
  const map: CustomMapImport = {
    format: "graphwar-map",
    version: 1,
    name: state.mapName.trim() || "Custom Arena",
    terrain: {
      blobs: state.terrainShapes.map((shape) => ({
        id: shape.id,
        outer: shape.points,
        holes: []
      }))
    },
    spawnPoints: state.spawnPoints.map((spawn) => ({ id: spawn.id, position: spawn.position })),
    teamSpawnPointIds: state.teamSpawnPointIds
  };

  return validateCustomMapImportForSave(map);
}

export function stringifyEditorMap(state: EditorState): string {
  return `${JSON.stringify(exportEditorMap(state), null, 2)}\n`;
}
```

- [ ] **Step 10: Add Electron shell and renderer**

Create `apps/map-maker/src/main.ts`:

```ts
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    webPreferences: {
      preload: join(app.getAppPath(), "dist/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(join(app.getAppPath(), "dist/renderer/index.html"));
  }
}

ipcMain.handle("graphwar-map-maker:save-map", async (_event, payload: { defaultPath: string; contents: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.defaultPath,
    filters: [{ name: "Graphwar Map", extensions: ["graphwar-map.json", "json"] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  await writeFile(result.filePath, payload.contents, "utf8");
  return { canceled: false, filePath: result.filePath };
});

app.whenReady().then(() => {
  void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
```

Create `apps/map-maker/src/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("graphwarMapMaker", {
  saveMap: (payload: { defaultPath: string; contents: string }) =>
    ipcRenderer.invoke("graphwar-map-maker:save-map", payload)
});
```

Create `apps/map-maker/src/renderer/electron.d.ts`:

```ts
export {};

declare global {
  interface Window {
    graphwarMapMaker?: {
      saveMap(payload: { defaultPath: string; contents: string }): Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}
```

Create `apps/map-maker/src/renderer/App.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { WorldPoint } from "@graphwar/shared";
import {
  addCircleTerrain,
  addPenPoint,
  addRectangleTerrain,
  addSpawnPoint,
  addTriangleTerrain,
  closePenShape,
  createEmptyEditorState,
  toggleTeamSpawn
} from "../editor/editorModel";
import type { EditorState } from "../editor/editorTypes";
import { stringifyEditorMap } from "../editor/mapExport";

type Tool = "select" | "rectangle" | "triangle" | "circle" | "pen" | "spawn" | "team-a" | "team-b";

function viewBoxPoint(event: React.MouseEvent<SVGSVGElement>): WorldPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 48 - 24;
  const y = 13.5 - ((event.clientY - rect.top) / rect.height) * 27;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

function addTenSpawns(state: EditorState): EditorState {
  let next = state;
  for (let index = 0; index < 10; index += 1) {
    next = addSpawnPoint(next, {
      x: index < 5 ? -18 : 18,
      y: -8 + (index % 5) * 4
    });
  }
  return next;
}

export function App() {
  const [state, setState] = useState(() => createEmptyEditorState());
  const [tool, setTool] = useState<Tool>("select");
  const [message, setMessage] = useState("Ready");
  const terrainPath = useMemo(
    () =>
      state.terrainShapes.map((shape) => ({
        id: shape.id,
        d: `${shape.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${-point.y}`).join(" ")} Z`
      })),
    [state.terrainShapes]
  );

  function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    const point = viewBoxPoint(event);
    if (tool === "rectangle") {
      setState((current) => addRectangleTerrain(current, point, 6, 3));
      return;
    }
    if (tool === "triangle") {
      setState((current) => addTriangleTerrain(current, point, 6, 4));
      return;
    }
    if (tool === "circle") {
      setState((current) => addCircleTerrain(current, point, 3, 24));
      return;
    }
    if (tool === "spawn") {
      setState((current) => addSpawnPoint(current, point));
      return;
    }
    if (tool === "pen") {
      setState((current) => addPenPoint(current, point));
    }
  }

  async function exportMap() {
    try {
      const contents = stringifyEditorMap(state);
      const result = await window.graphwarMapMaker?.saveMap({
        defaultPath: `${state.mapName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.graphwar-map.json`,
        contents
      });
      setMessage(result?.canceled ? "Export canceled" : `Exported ${result?.filePath ?? "map"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed");
    }
  }

  return (
    <main className="map-maker-shell">
      <header className="map-maker-toolbar">
        <input
          aria-label="Map name"
          value={state.mapName}
          onChange={(event) => setState((current) => ({ ...current, mapName: event.currentTarget.value }))}
        />
        {(["select", "rectangle", "triangle", "circle", "pen", "spawn", "team-a", "team-b"] as const).map((item) => (
          <button className={tool === item ? "active" : ""} key={item} onClick={() => setTool(item)} type="button">
            {item}
          </button>
        ))}
        <button onClick={() => setState((current) => closePenShape(current))} type="button">
          Close Pen
        </button>
        <button onClick={() => setState(addTenSpawns)} type="button">
          10 Spawns
        </button>
        <button onClick={() => void exportMap()} type="button">
          Export
        </button>
        <span>{message}</span>
      </header>
      <section className="map-maker-canvas">
        <svg onClick={handleCanvasClick} role="img" viewBox="-24 -13.5 48 27">
          <rect className="world-bg" height="27" width="48" x="-24" y="-13.5" />
          {terrainPath.map((shape) => (
            <path className="terrain-shape" d={shape.d} key={shape.id} />
          ))}
          {state.penPoints.length > 0 ? (
            <polyline
              className="pen-line"
              fill="none"
              points={state.penPoints.map((point) => `${point.x},${-point.y}`).join(" ")}
            />
          ) : null}
          {state.spawnPoints.map((spawn) => {
            const teamA = state.teamSpawnPointIds["team-a"].includes(spawn.id);
            const teamB = state.teamSpawnPointIds["team-b"].includes(spawn.id);
            return (
              <circle
                className={teamA ? "spawn team-a" : teamB ? "spawn team-b" : "spawn"}
                cx={spawn.position.x}
                cy={-spawn.position.y}
                key={spawn.id}
                onClick={(event) => {
                  event.stopPropagation();
                  if (tool === "team-a" || tool === "team-b") {
                    setState((current) => toggleTeamSpawn(current, spawn.id, tool));
                  }
                }}
                r="0.45"
              />
            );
          })}
        </svg>
      </section>
    </main>
  );
}
```

- [ ] **Step 11: Add renderer entry and styles**

Create `apps/map-maker/src/renderer/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/map-maker/src/renderer/styles.css` with a dense desktop editor layout:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #111318;
  color: #f4f7fb;
  font-family: Inter, system-ui, sans-serif;
}

button,
input {
  font: inherit;
}

.map-maker-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
}

.map-maker-toolbar {
  align-items: center;
  border-bottom: 1px solid #2a2f3a;
  display: flex;
  gap: 0.5rem;
  padding: 0.6rem;
}

.map-maker-canvas {
  min-height: 0;
  overflow: hidden;
}

.map-maker-canvas svg {
  display: block;
  height: 100%;
  width: 100%;
}

.world-bg {
  fill: #171a21;
}

.terrain-shape {
  fill: #4b5565;
  stroke: #d7dde8;
  stroke-width: 0.08;
}

.pen-line {
  stroke: #f3c969;
  stroke-width: 0.12;
}

.spawn {
  fill: #f4f7fb;
  stroke: #111318;
  stroke-width: 0.08;
}

.spawn.team-a {
  fill: #70a7ff;
}

.spawn.team-b {
  fill: #ff8f8f;
}

.map-maker-toolbar button.active {
  background: #f3c969;
  color: #111318;
}
```

- [ ] **Step 12: Verify map maker tests and build**

Run:

```bash
npm test -- apps/map-maker/src/editor
npm run check
npm --workspace apps/map-maker run build
```

Expected: PASS.

- [ ] **Step 13: Update README, commit, and push map maker checkpoint**

Update README:

- Add `apps/map-maker` to Current Workspace.
- Add `npm --workspace apps/map-maker run build`.
- Explain export/import flow.

Run:

```bash
git add README.md package.json package-lock.json apps/map-maker
git commit -m "feat: add local map maker"
git push origin feature/graphwar-prototype
```

Expected: commit and push succeed.

---

## Task 6: End-To-End Custom Map Smoke

**Files:**

- Create: `apps/client/e2e/custom-maps.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing E2E test**

Create `apps/client/e2e/custom-maps.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const customMap = {
  format: "graphwar-map",
  version: 1,
  name: "E2E Custom Arena",
  terrain: {
    blobs: [
      {
        id: "e2e-platform",
        outer: [
          { x: -2, y: -2 },
          { x: 2, y: -2 },
          { x: 2, y: 2 },
          { x: -2, y: 2 }
        ],
        holes: []
      }
    ]
  },
  spawnPoints: Array.from({ length: 10 }, (_, index) => ({
    id: `spawn-${index}`,
    position: { x: index < 5 ? -16 : 16, y: -8 + (index % 5) * 4 }
  })),
  teamSpawnPointIds: {
    "team-a": ["spawn-0", "spawn-1", "spawn-2", "spawn-3", "spawn-4"],
    "team-b": ["spawn-5", "spawn-6", "spawn-7", "spawn-8", "spawn-9"]
  }
};

test("imports custom map and starts a match with it", async ({ browser }) => {
  const alice = await browser.newPage();
  const bob = await browser.newPage();

  await alice.goto("/?guild=e2e-custom-map&user=alice");
  await bob.goto("/?guild=e2e-custom-map&user=bob");

  await alice.getByRole("button", { name: "Custom Maps" }).click();
  await alice.setInputFiles("input[type=file]", {
    name: "e2e.graphwar-map.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(customMap))
  });
  await expect(alice.getByText("E2E Custom Arena")).toBeVisible();
  await alice.getByRole("button", { name: "Back" }).click();

  await alice.getByRole("button", { name: "Create Lobby" }).click();
  await alice.getByLabel("Alias").fill("Alice");
  await alice.getByLabel("Map").selectOption({ label: "E2E Custom Arena" });
  await alice.getByRole("button", { name: "Create" }).click();

  await bob.getByRole("button", { name: "Join Lobby" }).click();
  await bob.getByLabel("Alias").fill("Bob");
  await bob.getByRole("button", { name: /join/i }).first().click();

  await alice.getByRole("button", { name: /start/i }).click();
  await expect(alice.getByText(/HP/i)).toBeVisible();
  await expect(bob.getByText(/HP/i)).toBeVisible();

  await alice.close();
  await bob.close();
});
```

- [ ] **Step 2: Run E2E test to verify it fails**

Run:

```bash
npm run test:e2e -- apps/client/e2e/custom-maps.spec.ts
```

Expected before prior tasks: FAIL because UI/routes do not exist. Expected after tasks: PASS.

- [ ] **Step 3: Adjust selectors only if required by existing UI**

Allowed changes:

- Use exact visible button names that exist after implementation.
- Use existing local server fixture helpers if current E2E tests already wrap startup.
- Do not remove the import/create/join/start assertions.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run check
npm test
npm run test:e2e
npm --workspace apps/client run build
npm --workspace apps/server run build
npm --workspace apps/map-maker run build
```

Expected: PASS.

- [ ] **Step 5: Update README, commit, and push E2E checkpoint**

Update README:

- Add custom map E2E command.
- Mention imported maps are guild-scoped and owner deletable.
- Mention map maker export file can be loaded through Custom Maps.

Run:

```bash
git add README.md apps/client/e2e/custom-maps.spec.ts
git commit -m "test: cover custom map gameplay flow"
git push origin feature/graphwar-prototype
```

Expected: commit and push succeed.

---

## Final Review Checklist

- [ ] Main menu has a `Custom Maps` button.
- [ ] Custom Maps screen fits 16:9 without page scrolling.
- [ ] Custom Maps screen imports `.graphwar-map.json`.
- [ ] Saved maps are guild-scoped.
- [ ] Map owner id is persisted.
- [ ] Non-owner delete is blocked by the server.
- [ ] Create Lobby offers Default Map plus saved maps.
- [ ] Selected custom map id/name appears in lobby summary/snapshot.
- [ ] Team-versus custom maps use team-specific spawn subsets.
- [ ] Free-for-all custom maps use maximally separated spawn selection.
- [ ] Custom terrain appears in match snapshot and uses existing terrain destruction.
- [ ] Default map generation still works.
- [ ] `apps/map-maker` exists as a local Electron app.
- [ ] Map maker exports `.graphwar-map.json`.
- [ ] Exported map passes shared validation.
- [ ] README documents testing and current state.
- [ ] No `Co-Authored-By` trailers in commits.
- [ ] Branch is pushed to `origin/feature/graphwar-prototype`.
