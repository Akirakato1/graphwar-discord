# Lobby Identity And Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add player color identity, clearer lobby movement controls, leader crown markers, centered lobby creation, and per-lobby max function length.

**Architecture:** Shared constants and schemas define the fixed color palette and max-function-length bounds. The server stores selected color and max function length in `LobbyDirectory`, propagates color into match snapshots, and configures `ShotSimulator` from the lobby setting. The client renders server snapshots with a compact 16:9-safe lobby layout and color-aware game labels.

**Tech Stack:** TypeScript, Zod, React, Canvas 2D, Fastify, Vitest, Playwright.

---

## File Structure

Create:

- `packages/shared/src/lobby/identity.ts`: fixed 10-color palette, default color, max function length bounds, validation helpers.

Modify:

- `packages/shared/src/index.ts`: export lobby identity helpers.
- `packages/shared/src/lobby/types.ts`: add `color`, `maxFunctionLength`, and session fields.
- `packages/shared/src/lobby/schemas.ts`: validate color and max function length.
- `packages/shared/src/protocol/schemas.ts`: add optional `color` to match players.
- `packages/shared/src/state/types.ts`: add optional `color` to `PlayerState`.
- `apps/server/src/lobbies/LobbyDirectory.ts`: persist runtime occupant colors and lobby max function length.
- `apps/server/src/lobbies/LobbyDirectory.test.ts`: cover color/max length and group movement.
- `apps/server/src/modes/GameMode.ts`: carry lobby player colors.
- `apps/server/src/match/MatchController.ts`: emit player colors and configure shot simulator max length.
- `apps/server/src/match/MatchController.test.ts`: cover color propagation and max path length.
- `apps/server/src/simulation/ShotSimulator.ts`: accept max travel distance.
- `apps/server/src/simulation/ShotSimulator.test.ts`: cover custom max travel length.
- `apps/server/src/rooms/GameRoom.ts`: pass lobby max function length to match start.
- `apps/client/src/lobby/ColorSelector.tsx`: reusable 10-swatch selector.
- `apps/client/src/lobby/ColorSelector.test.tsx`: swatch rendering coverage.
- `apps/client/src/lobby/CreateLobbyView.tsx`: add centered layout hooks, color selector, and max length field.
- `apps/client/src/lobby/CreateLobbyView.test.ts`: cover form payload.
- `apps/client/src/lobby/JoinLobbyView.tsx`: add color selector to join flow.
- `apps/client/src/lobby/JoinLobbyView.test.ts`: cover join payload.
- `apps/client/src/lobby/LobbySetupView.tsx`: crown icon and group-header join buttons.
- `apps/client/src/lobby/LobbySetupView.test.tsx`: cover crown and header join actions.
- `apps/client/src/app/useGameStore.ts`: send/track colors and max length.
- `apps/client/src/app/useGameStore.test.ts`: cover API payloads.
- `apps/client/src/networking/lobbyApi.ts`: allow new request fields through typed payloads.
- `apps/client/src/game-renderer/renderWorld.ts`: draw player icon/name with `player.color`.
- `apps/client/src/game-renderer/renderWorld.test.ts`: cover color use.
- `apps/client/src/styles.css`: centered create lobby, color swatches, crown, group header buttons.
- `apps/client/e2e/local-lobby.spec.ts`: update selectors for new movement controls.
- `README.md`: update status and commands.

## Task 1: Shared Identity Contract

- [ ] **Step 1: Write failing shared tests**

Add tests to `packages/shared/src/lobby/alias.test.ts` or create `packages/shared/src/lobby/identity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  defaultPlayerColor,
  functionLengthBounds,
  isPlayerColor,
  playerColorPalette,
  normalizeMaxFunctionLength
} from "./identity";

describe("lobby identity", () => {
  it("defines ten unique selectable colors", () => {
    expect(playerColorPalette).toHaveLength(10);
    expect(new Set(playerColorPalette).size).toBe(10);
    expect(isPlayerColor(defaultPlayerColor)).toBe(true);
  });

  it("bounds max function length for lobby settings", () => {
    expect(normalizeMaxFunctionLength(undefined)).toBe(50);
    expect(normalizeMaxFunctionLength(20)).toBe(20);
    expect(normalizeMaxFunctionLength(100)).toBe(100);
    expect(() => normalizeMaxFunctionLength(19)).toThrow("between 20 and 100");
    expect(() => normalizeMaxFunctionLength(101)).toThrow("between 20 and 100");
    expect(functionLengthBounds.default).toBe(50);
  });
});
```

Run: `npm test -- packages/shared/src/lobby/identity.test.ts`  
Expected: FAIL because `identity.ts` does not exist.

- [ ] **Step 2: Implement shared helpers and schemas**

Create `packages/shared/src/lobby/identity.ts`:

```ts
export const playerColorPalette = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f8fafc"
] as const;

export type PlayerColor = (typeof playerColorPalette)[number];
export const defaultPlayerColor: PlayerColor = playerColorPalette[5];

export const functionLengthBounds = {
  min: 20,
  max: 100,
  default: 50
} as const;

export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === "string" && (playerColorPalette as readonly string[]).includes(value);
}

export function normalizePlayerColor(value: unknown): PlayerColor {
  return isPlayerColor(value) ? value : defaultPlayerColor;
}

export function normalizeMaxFunctionLength(value: unknown): number {
  const length = value === undefined ? functionLengthBounds.default : Number(value);
  if (!Number.isFinite(length) || length < functionLengthBounds.min || length > functionLengthBounds.max) {
    throw new Error(`Max function length must be between ${functionLengthBounds.min} and ${functionLengthBounds.max}.`);
  }
  return length;
}
```

Update exports, schemas, and types so:

```ts
CreateLobbyRequest["color"]: PlayerColor;
CreateLobbyRequest["maxFunctionLength"]: number;
JoinLobbyRequest["color"]: PlayerColor;
LobbyOccupant["color"]: PlayerColor;
LobbyRuntimeSnapshot["maxFunctionLength"]: number;
LobbyJoinResult["session"]["color"]: PlayerColor;
PlayerState["color"]?: PlayerColor;
```

Run: `npm test -- packages/shared/src/lobby/identity.test.ts packages/shared/src/protocol/schemas.test.ts` and `npm run check`.

## Task 2: Server Lobby And Simulation Propagation

- [ ] **Step 1: Write failing server tests**

Add tests covering:

```ts
expect(result.lobby.occupants[0].color).toBe("#3b82f6");
expect(result.lobby.maxFunctionLength).toBe(35);
expect(result.session.color).toBe("#3b82f6");
```

Add `ShotSimulator` coverage:

```ts
const simulator = new ShotSimulator(undefined, undefined, undefined, { maxFunctionLength: 5 });
expect(result.path.at(-1)?.x).toBeLessThanOrEqual(5);
```

Run:

```bash
npm test -- apps/server/src/lobbies/LobbyDirectory.test.ts apps/server/src/simulation/ShotSimulator.test.ts apps/server/src/match/MatchController.test.ts
```

Expected: FAIL because fields/options are missing.

- [ ] **Step 2: Implement server propagation**

Update:

- `LobbyDirectory.createLobby()` stores `maxFunctionLength`.
- `LobbyDirectory.joinLobby()` stores validated occupant `color`.
- `LobbyDirectory.snapshot()` includes `maxFunctionLength`.
- `LobbySessionIdentity` includes `color`.
- `GameRoom` passes player colors and max length into match start.
- `MatchController.startMatch(modeId, generatedMap?, options?)` accepts `{ maxFunctionLength?: number }`.
- `ShotSimulator` accepts an options object and samples up to `maxFunctionLength`.

Run targeted server tests and `npm run check`.

## Task 3: Client Lobby UX

- [ ] **Step 1: Write failing component/store tests**

Cover:

- `CreateLobbyView` submits `color` and `maxFunctionLength`.
- `JoinLobbyView` submits `color`.
- `LobbySetupView` renders a crown and group-header `Join A`, `Join B`, `Join Spectator` buttons.
- Buttons are disabled for the local player's current group.
- `useGameStore.createLobby()` and `joinLobby()` include color/max length in API payloads.

Run:

```bash
npm test -- apps/client/src/lobby apps/client/src/app/useGameStore.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 2: Implement client UI**

Create `ColorSelector.tsx` and update lobby forms. Replace per-row move buttons with header-level join buttons in `LobbySetupView`. Style:

- `.create-lobby-screen` centered like `.menu-screen`.
- `.color-selector` swatches use stable square dimensions.
- `.leader-crown` is yellow and placed before the colored name.
- `.setup-column-heading` contains title left and join button right.

Run targeted client tests and `npm run check`.

## Task 4: Game Rendering And E2E

- [ ] **Step 1: Write/update failing rendering and E2E tests**

Update `renderWorld.test.ts` so a player with `color: "#ef4444"` causes fill/stroke text color calls with that color.

Update Playwright lobby tests to use group-header movement:

```ts
await alicePage.getByRole("region", { name: "Team B" }).getByRole("button", { name: "Join B" }).click();
```

Run:

```bash
npm test -- apps/client/src/game-renderer/renderWorld.test.ts
npm run test:e2e -- apps/client/e2e/local-lobby.spec.ts
```

Expected: FAIL until renderer/E2E selectors are updated.

- [ ] **Step 2: Implement renderer and E2E updates**

Use `player.color ?? colorForTeam(player.teamId)` for player circle and label color. Update E2E selectors to use group-header buttons.

Run:

```bash
npm run check
npm test
npm run test:e2e
npm --workspace apps/client run build
npm --workspace apps/server run build
```

Expected: PASS.

## Commit Plan

1. `docs: plan lobby identity settings`
2. `feat: add lobby identity settings`
3. `test: update lobby identity flows`

Push after each commit:

```bash
git push origin feature/graphwar-prototype
```

Do not add `Co-Authored-By` trailers.

## Self-Review

- Spec coverage: all approved requirements map to Tasks 1-4.
- Placeholder scan: no unresolved markers.
- Type consistency: field names are `color` and `maxFunctionLength` across shared, server, and client layers.
