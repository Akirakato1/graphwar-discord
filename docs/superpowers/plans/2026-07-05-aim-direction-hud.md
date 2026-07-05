# Aim Direction HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8-way rotated local shot axes, a minimal in-turn HUD with a direction dial, shot length color attenuation, and turn-start shot clearing.

**Architecture:** Aim direction is shared protocol state carried by shot commands and shot-resolved events. The authoritative server samples function coordinates in shooter-local space and transforms them into world points with a rotated coordinate frame before existing collision, terrain, damage, and turn logic runs. The client owns only input and rendering: it chooses a direction, sends it with the shot, draws returned paths with attenuation, and hides the previous path once turn events advance.

**Tech Stack:** TypeScript, Zod protocol schemas, Vitest, React, Zustand, Canvas 2D, WebSocket server.

---

### Task 1: Shared Aim Direction Model

**Files:**
- Modify: `packages/shared/src/state/types.ts`
- Modify: `packages/shared/src/geometry/coordinates.ts`
- Test: `packages/shared/src/geometry/coordinates.test.ts`
- Modify: `packages/shared/src/protocol/commands.ts`
- Modify: `packages/shared/src/protocol/events.ts`
- Modify: `packages/shared/src/protocol/schemas.ts`
- Test: `packages/shared/src/protocol/schemas.test.ts`

- [ ] **Step 1: Write failing coordinate tests**

Add tests that expect `localToWorld({ x: 3, y: 2 }, origin, "west")` to return `{ x: -3, y: -2 }`, `localToWorld(..., "north")` to return `{ x: -2, y: 3 }`, and `localToWorld(..., "south-east")` to use the normalized diagonal basis.

- [ ] **Step 2: Run shared coordinate tests to verify RED**

Run: `npm test -- packages/shared/src/geometry/coordinates.test.ts`

Expected: FAIL because `localToWorld` does not accept aim direction and does not rotate axes.

- [ ] **Step 3: Implement shared direction helpers**

Add `AimDirectionId = "east" | "north-east" | "north" | "north-west" | "west" | "south-west" | "south" | "south-east"`, an ordered `aimDirections` constant, `directionVector(direction)`, and update `localToWorld(localPoint, shooterPosition, aimDirection = "east")` to compute `shooter + forward * local.x + left * local.y`, where `left = { x: -forward.y, y: forward.x }`.

- [ ] **Step 4: Run shared coordinate tests to verify GREEN**

Run: `npm test -- packages/shared/src/geometry/coordinates.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing protocol tests**

Update schema tests so a `submit-shot` command without `aimDirection` fails and a command/event with `aimDirection: "west"` succeeds.

- [ ] **Step 6: Implement protocol shape**

Add `aimDirection: AimDirectionId` to `SubmitShotCommand` and `ShotResolvedEvent`, and add `aimDirectionSchema` to both command and event Zod schemas.

- [ ] **Step 7: Run protocol tests**

Run: `npm test -- packages/shared/src/protocol/schemas.test.ts`

Expected: PASS.

### Task 2: Authoritative Server Rotation

**Files:**
- Modify: `apps/server/src/simulation/ShotSimulator.ts`
- Test: `apps/server/src/simulation/ShotSimulator.test.ts`
- Modify: `apps/server/src/match/MatchController.ts`
- Test: `apps/server/src/match/MatchController.test.ts`
- Modify: `apps/server/src/rooms/GameRoom.ts`
- Test: `apps/server/src/rooms/RoomManager.integration.test.ts`

- [ ] **Step 1: Write failing simulator test**

Add a test where Bob is at `{ x: 10, y: 0 }`, Alice is at `{ x: 7, y: 0 }`, Bob fires `0` with `aimDirection: "west"`, and the result is a `player-hit` on Alice.

- [ ] **Step 2: Run simulator test to verify RED**

Run: `npm test -- apps/server/src/simulation/ShotSimulator.test.ts`

Expected: FAIL because `ShotSimulator.simulate` does not accept `aimDirection`.

- [ ] **Step 3: Implement simulator direction support**

Add `aimDirection` to `ShotSimulationInput`. Sample from local `x = 0` to `sampleStep * (maxPathPoints - 1)` so every direction gets the same function length budget, map with `localToWorld(point, shooter.position, aimDirection)`, and use the same direction when converting `lastFinitePoint`.

- [ ] **Step 4: Run simulator test to verify GREEN**

Run: `npm test -- apps/server/src/simulation/ShotSimulator.test.ts`

Expected: PASS.

- [ ] **Step 5: Thread command direction through controller and room**

Update `MatchController.submitShot(playerId, functionFamilyId, expression, aimDirection)`, pass it into `ShotSimulator`, include it in `shot-resolved`, and update `GameRoom` to pass `command.aimDirection`.

- [ ] **Step 6: Add controller/room tests**

Assert the returned `shot-resolved` event echoes `aimDirection: "west"` and local WebSocket command parsing accepts the new field.

- [ ] **Step 7: Run server tests**

Run: `npm test -- apps/server/src/simulation/ShotSimulator.test.ts apps/server/src/match/MatchController.test.ts apps/server/src/rooms/RoomManager.integration.test.ts`

Expected: PASS.

### Task 3: Client Direction Dial, Minimal HUD, Path Lifecycle

**Files:**
- Modify: `apps/client/src/app/useGameStore.ts`
- Test: `apps/client/src/app/useGameStore.test.ts`
- Modify: `apps/client/src/input/FunctionInput.tsx`
- Create: `apps/client/src/input/DirectionDial.tsx`
- Test: `apps/client/src/input/DirectionDial.test.tsx`
- Modify: `apps/client/src/hud/MatchHud.tsx`
- Test: `apps/client/src/hud/MatchHud.test.ts`
- Modify: `apps/client/src/game-renderer/renderWorld.ts`
- Test: `apps/client/src/game-renderer/renderWorld.test.ts`
- Modify: `apps/client/src/game-renderer/GameCanvas.tsx`
- Test: `apps/client/src/game-renderer/GameCanvas.test.ts`
- Modify: `apps/client/src/styles.css`

- [ ] **Step 1: Write failing store test**

Assert `submitShot("0", "west")` sends a `submit-shot` command with `aimDirection: "west"`, and `turn-advanced` removes the visible shot event from the renderable recent event window.

- [ ] **Step 2: Implement store direction and render-event clearing**

Change `submitShot(expression, aimDirection)` to send the field. When handling `turn-started` or `turn-advanced`, filter prior `shot-resolved` events out of `recentEvents` while keeping log behavior.

- [ ] **Step 3: Write failing dial/HUD tests**

Assert the in-turn HUD contains own HP, a direction dial with 8 direction buttons, no phase/mode/status grid while playing, and disabled direction controls when it is not the local player's turn.

- [ ] **Step 4: Implement DirectionDial and minimal playing HUD**

Create a direction dial component that renders 8 buttons, supports mouse wheel rotation, and calls `onChange`. Keep lobby/end HUD details, but while playing render only turn badge, own HP, notice, direction dial, and `FunctionInput`.

- [ ] **Step 5: Write failing renderer tests**

Assert rendered shot path sets progressively lower alpha/stroke color as it approaches `defaultMatchTuning.maxPathPoints`, and `GameCanvas` reports zero path points when a later turn event follows a shot.

- [ ] **Step 6: Implement renderer attenuation and clear-on-turn behavior**

Use per-segment stroke alpha based on remaining length budget, and make `findLatestShotResolvedEvent` stop at the newest turn event. Keep the impact ring only when the shot is visible.

- [ ] **Step 7: Run client tests**

Run: `npm test -- apps/client/src/app/useGameStore.test.ts apps/client/src/input/DirectionDial.test.tsx apps/client/src/hud/MatchHud.test.ts apps/client/src/game-renderer/renderWorld.test.ts apps/client/src/game-renderer/GameCanvas.test.ts`

Expected: PASS.

### Task 4: Docs, Ignore, Verification, Push

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Ignore brainstorm artifacts**

Add `.superpowers/` to `.gitignore` so visual companion files are not committed.

- [ ] **Step 2: Update README**

Document the 8-way direction dial, local rotated axes, mouse wheel control, minimal in-turn HUD, attenuation, and turn-start path clearing.

- [ ] **Step 3: Run verification**

Run: `npm run check`, `npm test`, `npm --workspace apps/client run build`, and `npm --workspace apps/server run build`.

- [ ] **Step 4: Commit and push**

Commit with no `Co-Authored-By` trailer and push to `origin feature/graphwar-prototype`.
