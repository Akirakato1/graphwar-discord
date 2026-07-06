# Map Presentation Camera Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 map-size presets, authoritative world bounds, custom-map bounds fallback, camera zoom/pan, avatar rendering, and map-maker size setup.

**Architecture:** Shared types define `WorldBounds`, map-size presets, lobby `mapSizePreset`, and optional `avatarUrl`. The server carries authoritative bounds from lobby creation through map generation, custom-map spawning, match snapshots, and shot boundary clipping. Clients render from snapshot bounds through a camera transform; map maker creates/export maps with explicit bounds.

**Tech Stack:** TypeScript, Zod, React, Canvas 2D, SVG map-maker editor, Vitest, Playwright.

---

## File Structure

- `packages/shared/src/maps/worldBounds.ts`: shared preset catalog, bounds helpers, and bounds math.
- `packages/shared/src/maps/types.ts`: `WorldBounds`, custom map bounds alias, summary bounds.
- `packages/shared/src/maps/schemas.ts`: reusable bounds schema and custom map validation.
- `packages/shared/src/lobby/types.ts`: `mapSizePreset` and `avatarUrl` on lobby/session contracts.
- `packages/shared/src/lobby/schemas.ts`: schema defaults and validation for preset/avatar fields.
- `packages/shared/src/state/types.ts`: `PlayerState.avatarUrl` and `MatchSnapshot.worldBounds`.
- `apps/server/src/maps/*.ts`: bounds-aware default generators and custom spawner fallback bounds.
- `apps/server/src/match/MatchController.ts`: starts matches with selected bounds and includes bounds/avatar in snapshots.
- `apps/server/src/simulation/ShotSimulator.ts`: clips against active `worldBounds`.
- `apps/client/src/sessions/localSession.ts`: reads `avatar=<url>`.
- `apps/client/src/lobby/CreateLobbyView.tsx`: default-map map-size preset control.
- `apps/client/src/app/useGameStore.ts`: carries `mapSizePreset` and `avatarUrl` in create/join flow.
- `apps/client/src/game-renderer/camera.ts`: pure camera fit, pan, zoom-at-cursor transforms.
- `apps/client/src/game-renderer/renderWorld.ts`: renders from camera transform and uses avatar image cache.
- `apps/client/src/game-renderer/GameCanvas.tsx`: owns camera state and wheel/drag handlers.
- `apps/map-maker/src/editor/editorTypes.ts`: stores editor `worldBounds`.
- `apps/map-maker/src/editor/editorModel.ts`: creates editor state for chosen bounds and places helper spawns in bounds.
- `apps/map-maker/src/editor/mapExport.ts`: exports `worldBounds`.
- `apps/map-maker/src/renderer/App.tsx`: setup screen for map name/preset/custom bounds and bounds-aware SVG view.

---

### Task 1: Shared Contracts

**Files:**
- Create: `packages/shared/src/maps/worldBounds.ts`
- Modify: `packages/shared/src/maps/types.ts`
- Modify: `packages/shared/src/maps/schemas.ts`
- Modify: `packages/shared/src/maps/index.ts`
- Modify: `packages/shared/src/lobby/types.ts`
- Modify: `packages/shared/src/lobby/schemas.ts`
- Modify: `packages/shared/src/state/types.ts`
- Test: `packages/shared/src/maps/schemas.test.ts`
- Test: `packages/shared/src/lobby/schemas.test.ts`
- Test: `packages/shared/src/protocol/schemas.test.ts`

- [ ] **Step 1: Write failing shared tests**

Add tests that expect:

```ts
expect(worldBoundsForMapSize("small")).toEqual({ minX: -20, maxX: 20, minY: -12, maxY: 12 });
expect(worldBoundsForMapSize("standard")).toEqual(fieldBounds);
expect(mapSizePresetIds).toEqual(["small", "standard", "large", "huge"]);
expect(createLobbyRequestSchema.parse({ name: "A", leaderDiscordUserId: "u1", alias: "Alice", mode: "team-versus", initialSlot: "player" }).mapSizePreset).toBe("standard");
expect(createLobbyRequestSchema.parse({ name: "A", leaderDiscordUserId: "u1", alias: "Alice", mode: "team-versus", initialSlot: "player", mapSizePreset: "huge" }).mapSizePreset).toBe("huge");
expect(createLobbyRequestSchema.safeParse({ name: "A", leaderDiscordUserId: "u1", alias: "Alice", mode: "team-versus", initialSlot: "player", mapSizePreset: "giant" }).success).toBe(false);
expect(joinLobbyRequestSchema.parse({ discordUserId: "u1", alias: "Alice", slot: "player", avatarUrl: "https://cdn.example/a.png" }).avatarUrl).toBe("https://cdn.example/a.png");
expect(joinLobbyRequestSchema.parse({ discordUserId: "u1", alias: "Alice", slot: "player", avatarUrl: "not a url" }).avatarUrl).toBeUndefined();
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- packages/shared/src/maps/schemas.test.ts packages/shared/src/lobby/schemas.test.ts packages/shared/src/protocol/schemas.test.ts
```

Expected: FAIL because map-size helpers, snapshot bounds, and avatar schema fields do not exist yet.

- [ ] **Step 3: Implement shared contracts**

Add `worldBounds.ts` with:

```ts
import { fieldBounds } from "../constants";

export type WorldBounds = { minX: number; maxX: number; minY: number; maxY: number };
export const mapSizePresetIds = ["small", "standard", "large", "huge"] as const;
export type MapSizePresetId = (typeof mapSizePresetIds)[number];
export const defaultMapSizePreset: MapSizePresetId = "standard";
export const mapSizePresets: Record<MapSizePresetId, { width: number; height: number }> = {
  small: { width: 40, height: 24 },
  standard: { width: 50, height: 30 },
  large: { width: 75, height: 45 },
  huge: { width: 100, height: 60 }
};

export function worldBoundsForMapSize(preset: MapSizePresetId = defaultMapSizePreset): WorldBounds {
  if (preset === "standard") return { ...fieldBounds };
  const size = mapSizePresets[preset];
  return { minX: -size.width / 2, maxX: size.width / 2, minY: -size.height / 2, maxY: size.height / 2 };
}

export function boundsWidth(bounds: WorldBounds): number {
  return bounds.maxX - bounds.minX;
}

export function boundsHeight(bounds: WorldBounds): number {
  return bounds.maxY - bounds.minY;
}

export function isWorldPointInBounds(point: { x: number; y: number }, bounds: WorldBounds): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}
```

Then export it from `packages/shared/src/maps/index.ts` and root `packages/shared/src/index.ts` through the existing map barrel. Update schemas to default `mapSizePreset` to `standard`, add `avatarUrl` preprocess that drops invalid/empty/over-2048 values, and add `worldBounds` to `MatchSnapshot`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- packages/shared/src/maps/schemas.test.ts packages/shared/src/lobby/schemas.test.ts packages/shared/src/protocol/schemas.test.ts
npm run check
```

Expected: all targeted tests pass; typecheck may still reveal downstream missing fields to fix in this task.

- [ ] **Step 5: Commit and push**

```bash
git add packages/shared/src
git commit -m "feat: add map bounds contracts"
git push
```

Update `README.md` in the same commit if public contracts are described there.

---

### Task 2: Server Bounds Propagation

**Files:**
- Modify: `apps/server/src/maps/MapGenerator.ts`
- Modify: `apps/server/src/maps/TeamVersusMapGenerator.ts`
- Modify: `apps/server/src/maps/FreeForAllMapGenerator.ts`
- Modify: `apps/server/src/maps/CustomMapSpawner.ts`
- Modify: `apps/server/src/match/MatchController.ts`
- Modify: `apps/server/src/simulation/ShotSimulator.ts`
- Modify: `apps/server/src/simulation/CollisionSystem.ts`
- Modify: `apps/server/src/rooms/GameRoom.ts`
- Modify: `apps/server/src/lobbies/LobbyDirectory.ts`
- Test: `apps/server/src/maps/MapGenerator.test.ts`
- Test: `apps/server/src/maps/CustomMapSpawner.test.ts`
- Test: `apps/server/src/simulation/ShotSimulator.test.ts`
- Test: `apps/server/src/match/MatchController.test.ts`
- Test: `apps/server/src/lobbies/LobbyDirectory.test.ts`

- [ ] **Step 1: Write failing server tests**

Add assertions for:

```ts
expect(new TeamVersusMapGenerator().generate("s", ["a", "b"], worldBoundsForMapSize("huge")).worldBounds).toEqual(worldBoundsForMapSize("huge"));
expect(new FreeForAllMapGenerator().generate("s", ["a", "b", "c"], worldBoundsForMapSize("large")).spawns.every((spawn) => isWorldPointInBounds(spawn.position, worldBoundsForMapSize("large")))).toBe(true);
expect(new CustomMapSpawner().generate("free-for-all", persistedMapWithoutBounds, players).worldBounds).toMatchObject({ minX: expect.any(Number), maxX: expect.any(Number) });
expect(controller.startMatch("team-versus", undefined, { mapSizePreset: "huge" }).worldBounds).toEqual(worldBoundsForMapSize("huge"));
expect(new ShotSimulator().simulate({ shooter, players: [shooter], terrain: { blobs: [] }, shot: NormalFunction.parse("0"), aimDirection: "east", worldBounds: { minX: -2, maxX: 2, minY: -2, maxY: 2 } }).impact.reason).toBe("field-boundary");
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- apps/server/src/maps/MapGenerator.test.ts apps/server/src/maps/CustomMapSpawner.test.ts apps/server/src/simulation/ShotSimulator.test.ts apps/server/src/match/MatchController.test.ts apps/server/src/lobbies/LobbyDirectory.test.ts
```

Expected: FAIL because generated maps do not expose bounds, match snapshots lack bounds, and simulator uses fixed `fieldBounds`.

- [ ] **Step 3: Implement server propagation**

Use these signatures:

```ts
export type GeneratedMap = { spawns: SpawnPoint[]; terrain: TerrainState; worldBounds: WorldBounds };
export abstract class MapGenerator {
  abstract generate(seed: string, playerIds: PlayerId[], worldBounds?: WorldBounds): GeneratedMap;
}
export type MatchStartOptions = { maxFunctionLength?: number; mapSizePreset?: MapSizePresetId };
export type ShotSimulationInput = { shooter: PlayerState; players: PlayerState[]; terrain: TerrainState; shot: ShotFunction; aimDirection?: AimDirectionId; maxFunctionLength?: number; worldBounds?: WorldBounds };
```

Scale default map geometry by `boundsWidth(bounds) / 50` and `boundsHeight(bounds) / 30`; return standard geometry unchanged for `standard`. In `CustomMapSpawner`, resolve bounds as `map.worldBounds ?? deriveBoundsFromTerrainAndSpawns(map) ?? worldBoundsForMapSize("standard")`. Pass `worldBounds` to `ShotSimulator`, replace `fieldBounds` and `isPointInBounds` with active bounds helpers, and include `worldBounds` in all match snapshots.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- apps/server/src/maps/MapGenerator.test.ts apps/server/src/maps/CustomMapSpawner.test.ts apps/server/src/simulation/ShotSimulator.test.ts apps/server/src/match/MatchController.test.ts apps/server/src/lobbies/LobbyDirectory.test.ts
npm run check
```

Expected: targeted tests pass and downstream type errors are resolved.

- [ ] **Step 5: Commit and push**

```bash
git add packages/shared/src apps/server/src README.md
git commit -m "feat: propagate map bounds server-side"
git push
```

---

### Task 3: Client Lobby And Avatar Identity Plumbing

**Files:**
- Modify: `apps/client/src/sessions/localSession.ts`
- Modify: `apps/client/src/app/useGameStore.ts`
- Modify: `apps/client/src/networking/lobbyApi.ts`
- Modify: `apps/client/src/lobby/CreateLobbyView.tsx`
- Modify: `apps/client/src/lobby/CreateLobbyView.test.ts`
- Modify: `apps/client/src/app/useGameStore.test.ts`
- Test: `apps/client/src/sessions/localSession.test.ts`

- [ ] **Step 1: Write failing client identity/lobby tests**

Add assertions for:

```ts
expect(readLocalSession("http://localhost:5173/?user=alice&avatar=https%3A%2F%2Fcdn.example%2Falice.png").avatarUrl).toBe("https://cdn.example/alice.png");
expect(readLocalSession("http://localhost:5173/?user=alice&avatar=bogus").avatarUrl).toBeUndefined();
expect(createLobbyInitialForm("Alice").mapSizePreset).toBe("standard");
expect(prepareCreateLobbyForm({ name: "A", alias: "Alice", mode: "team-versus", initialSlot: "player", color: defaultPlayerColor, maxFunctionLength: 50, mapSizePreset: "huge" }).form.mapSizePreset).toBe("huge");
```

Render `CreateLobbyView` with one custom map and assert the map-size control is present for `Default Map`; test helper behavior to omit or ignore `mapSizePreset` when `mapId` is set.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- apps/client/src/sessions/localSession.test.ts apps/client/src/lobby/CreateLobbyView.test.ts apps/client/src/app/useGameStore.test.ts
```

Expected: FAIL because avatar and map-size form fields are not wired.

- [ ] **Step 3: Implement client lobby/session plumbing**

Add `avatarUrl?: string` to `ClientSession`, parse it with the same drop-invalid behavior as shared schemas, include it in create/join payloads, selected lobby session, and join-room commands. Add map-size presets to `CreateLobbyView`:

```tsx
{!mapId && (
  <label>
    Map size
    <select value={mapSizePreset} onChange={(event) => setMapSizePreset(event.currentTarget.value as MapSizePresetId)}>
      <option value="small">Small</option>
      <option value="standard">Standard</option>
      <option value="large">Large</option>
      <option value="huge">Huge</option>
    </select>
  </label>
)}
```

Ensure `onCreate` submits `mapSizePreset` only when no `mapId` exists.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- apps/client/src/sessions/localSession.test.ts apps/client/src/lobby/CreateLobbyView.test.ts apps/client/src/app/useGameStore.test.ts
npm run check
```

Expected: all tests pass.

- [ ] **Step 5: Commit and push**

```bash
git add apps/client/src packages/shared/src README.md
git commit -m "feat: add client map size and avatar identity"
git push
```

---

### Task 4: Canvas Camera And Avatar Rendering

**Files:**
- Create: `apps/client/src/game-renderer/camera.ts`
- Modify: `apps/client/src/game-renderer/renderWorld.ts`
- Modify: `apps/client/src/game-renderer/GameCanvas.tsx`
- Test: `apps/client/src/game-renderer/GameCanvas.test.ts`
- Test: `apps/client/src/game-renderer/camera.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Add pure camera tests:

```ts
const bounds = { minX: -50, maxX: 50, minY: -30, maxY: 30 };
const camera = fitCameraToBounds(bounds, { width: 960, height: 576 });
expect(worldToCanvasWithCamera({ x: -50, y: 30 }, camera)).toEqual({ x: 0, y: 0 });
const zoomed = zoomCameraAtCanvasPoint(camera, { x: 480, y: 288 }, 1.25);
expect(canvasToWorldWithCamera({ x: 480, y: 288 }, zoomed)).toEqual(canvasToWorldWithCamera({ x: 480, y: 288 }, camera));
```

Extend `GameCanvas` static markup tests to assert `data-world-bounds="-50,50,-30,30"` for a huge snapshot and `data-camera-enabled="true"`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- apps/client/src/game-renderer/camera.test.ts apps/client/src/game-renderer/GameCanvas.test.ts
```

Expected: FAIL because camera helpers and data attributes do not exist.

- [ ] **Step 3: Implement camera helpers and render integration**

Implement:

```ts
export type Camera = { scale: number; offsetX: number; offsetY: number; boundsKey: string };
export function fitCameraToBounds(bounds: WorldBounds, size: CanvasSize): Camera;
export function worldToCanvasWithCamera(point: WorldPoint, camera: Camera): WorldPoint;
export function canvasToWorldWithCamera(point: WorldPoint, camera: Camera): WorldPoint;
export function panCamera(camera: Camera, delta: { x: number; y: number }): Camera;
export function zoomCameraAtCanvasPoint(camera: Camera, canvasPoint: WorldPoint, factor: number): Camera;
```

`GameCanvas` resets camera when `snapshot.worldBounds` changes, handles wheel zoom with `event.preventDefault()`, and pans while dragging. `renderWorld` accepts `camera` and optional `avatarImages`, draws grid/axes from `snapshot.worldBounds`, and clips loaded avatar images inside the existing player circle with selected-color fallback.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- apps/client/src/game-renderer/camera.test.ts apps/client/src/game-renderer/GameCanvas.test.ts
npm run check
```

Expected: all tests pass.

- [ ] **Step 5: Commit and push**

```bash
git add apps/client/src/game-renderer README.md
git commit -m "feat: add map camera renderer"
git push
```

---

### Task 5: Map Maker Bounds Setup

**Files:**
- Modify: `apps/map-maker/src/editor/editorTypes.ts`
- Modify: `apps/map-maker/src/editor/editorModel.ts`
- Modify: `apps/map-maker/src/editor/mapExport.ts`
- Modify: `apps/map-maker/src/renderer/viewBoxGeometry.ts`
- Modify: `apps/map-maker/src/renderer/App.tsx`
- Modify: `apps/map-maker/src/renderer/styles.css`
- Test: `apps/map-maker/src/editor/editorModel.test.ts`
- Test: `apps/map-maker/src/editor/mapExport.test.ts`
- Test: `apps/map-maker/src/renderer/viewBoxGeometry.test.ts`

- [ ] **Step 1: Write failing map-maker tests**

Add assertions for:

```ts
const state = createEmptyEditorState({ mapName: "Huge Arena", worldBounds: worldBoundsForMapSize("huge") });
expect(state.worldBounds).toEqual(worldBoundsForMapSize("huge"));
expect(exportEditorMap(state).worldBounds).toEqual(worldBoundsForMapSize("huge"));
expect(addDefaultSpawnSet(state).spawnPoints.every((spawn) => isWorldPointInBounds(spawn.position, worldBoundsForMapSize("huge")))).toBe(true);
```

Add a view-box geometry test for non-standard bounds.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- apps/map-maker/src/editor/editorModel.test.ts apps/map-maker/src/editor/mapExport.test.ts apps/map-maker/src/renderer/viewBoxGeometry.test.ts
```

Expected: FAIL because editor state lacks `worldBounds`.

- [ ] **Step 3: Implement map-maker setup and export**

Add `worldBounds: WorldBounds` to `EditorState`. Update `createEmptyEditorState(options?: { mapName?: string; worldBounds?: WorldBounds })`. Add a setup state in `App.tsx` that asks map name and size preset before showing the editor. Derive `svgViewBox` from `state.worldBounds`, draw grid/axes from active bounds, and export `worldBounds` in `mapExport.ts`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- apps/map-maker/src/editor/editorModel.test.ts apps/map-maker/src/editor/mapExport.test.ts apps/map-maker/src/renderer/viewBoxGeometry.test.ts
npm run check
```

Expected: all tests pass.

- [ ] **Step 5: Commit and push**

```bash
git add apps/map-maker/src README.md
git commit -m "feat: add map maker bounds setup"
git push
```

---

### Task 6: End-To-End Verification And Docs

**Files:**
- Modify: `README.md`
- Modify: `apps/client/e2e/local-lobby.spec.ts`
- Modify: `apps/client/e2e/custom-maps.spec.ts`

- [ ] **Step 1: Add/adjust E2E smoke coverage**

Add a smoke path that creates a default `large` or `huge` lobby and verifies the canvas renders without page scroll:

```ts
await expect(page.getByLabel("Map size")).toBeVisible();
await page.getByLabel("Map size").selectOption("large");
await expect(page.getByTestId("game-canvas")).toHaveAttribute("data-rendered", "true");
await expect(page.locator("body")).toHaveJSProperty("scrollHeight", await page.evaluate(() => window.innerHeight));
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run check
npm run test:e2e
```

Expected: all tests pass. If Playwright cannot run because local browser dependencies are unavailable, record the exact failure in the final answer and keep unit/integration verification passing.

- [ ] **Step 3: Update README checkpoint**

Add a concise checkpoint line:

```md
- Implemented Phase 1 map presentation: default map-size presets, authoritative world bounds, custom-map bounds fallback, camera zoom/pan, avatar rendering fallback, and map-maker bounds setup.
```

- [ ] **Step 4: Commit and push**

```bash
git add README.md apps/client/e2e
git commit -m "test: cover map presentation phase"
git push
```
