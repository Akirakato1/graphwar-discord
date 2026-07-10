# Resume Disconnect Lobby Join Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local test lobbies behave like Discord Activity sessions: refresh/reconnect resumes the same match, disconnected players get a 3-minute grace window before automatic FF, open lobbies disappear when the leader leaves, draft function input restores privately, and join actions are inline per lobby row.

**Architecture:** Keep match state and disconnect enforcement server-authoritative in `GameRoom`/`LobbyDirectory`, with a private function-draft command/event path that never broadcasts another player's prepared function. Persist the selected lobby session in browser localStorage for local refresh recovery, then let the existing websocket snapshot flow decide whether the user lands in setup or game. Simplify join lobby rendering by removing row selection state and putting player/spectator actions directly on each lobby row.

**Tech Stack:** TypeScript, React, Zustand, Fastify/ws, Vitest, Playwright e2e, Graphify project map.

## Global Constraints

- Local prototype first; keep behavior compatible with future Discord Activity wrapper.
- Server remains authoritative for match state, turn timer, disconnect timeout, and auto-FF.
- Private draft restore must only be sent to the reconnecting socket.
- Open lobbies are deleted/cancelled if their leader leaves via main menu or disconnects.
- Started matches allow reconnect for existing players; new users can only spectate.
- Discord-style screens must remain 16:9/no-scroll friendly.
- Update README before each push and update Graphify after structural changes.
- Push directly to `main`; do not add `Co-Authored-By`.

---

### Task 1: Shared Protocol For Private Function Drafts

**Files:**
- Modify: `packages/shared/src/protocol/commands.ts`
- Modify: `packages/shared/src/protocol/events.ts`
- Modify: `packages/shared/src/protocol/schemas.ts`
- Modify: `packages/shared/src/protocol/schemas.test.ts`

**Interfaces:**
- Produces command: `UpdateFunctionDraftCommand` with `{ type: "update-function-draft"; guildId?: string; roomId; playerId; expression; aimDirection; sessionToken?: string }`.
- Produces private event: `FunctionDraftRestoredEvent` with `{ type: "function-draft-restored"; guildId?: string; roomId; playerId; expression; aimDirection }`.
- Later tasks consume these through `ClientCommand` and `ServerEvent`.

- [x] **Step 1: Add failing protocol schema tests**

Add tests that parse `update-function-draft` and `function-draft-restored`, and allow empty draft expressions because drafts mirror live editor state.

- [x] **Step 2: Run focused protocol tests**

Run: `npm test -- packages/shared/src/protocol/schemas.test.ts`

Expected: FAIL because the command/event types are unknown.

- [x] **Step 3: Add protocol types and schemas**

Extend command/event TypeScript unions and zod schemas with the exact fields above. Use the existing `aimDirectionIdSchema` and optional session token style.

- [x] **Step 4: Re-run focused protocol tests**

Run: `npm test -- packages/shared/src/protocol/schemas.test.ts`

Expected: PASS.

### Task 2: Server Disconnect Grace And Draft Store

**Files:**
- Modify: `apps/server/src/rooms/GameRoom.ts`
- Modify: `apps/server/src/rooms/RoomManager.integration.test.ts`
- Modify: `apps/server/src/lobbies/LobbyDirectory.ts`
- Modify: `apps/server/src/lobbies/LobbyDirectory.test.ts`

**Interfaces:**
- Consumes `UpdateFunctionDraftCommand` and `FunctionDraftRestoredEvent` from Task 1.
- Produces server behavior:
  - `markDisconnected()` sets occupant `connected: false`.
  - Existing open-lobby leader disconnect triggers `lobby-cancelled`.
  - Existing playing-lobby player disconnect starts a 180,000 ms grace timer.
  - Reconnect cancels that player's grace timer and marks them connected.
  - Grace expiry calls the same path as `forfeit-match`.
  - Draft updates are stored per session player and restored only to the reconnecting socket.

- [x] **Step 1: Add failing room integration tests**

Add tests for:
- reconnect before grace expiry does not forfeit and broadcasts `connected: true`;
- grace expiry emits `player-forfeited`;
- leader disconnect in an open lobby emits `lobby-cancelled` and removes lobby from list;
- reconnecting socket receives `function-draft-restored` with its own draft.

- [x] **Step 2: Run focused server tests**

Run: `npm test -- apps/server/src/rooms/RoomManager.integration.test.ts apps/server/src/lobbies/LobbyDirectory.test.ts`

Expected: FAIL for missing auto-FF, leader disconnect cancellation, and draft handling.

- [x] **Step 3: Implement lobby helpers**

Add `isOpenLeaderSession(guildId, roomId, sessionToken)` or equivalent to `LobbyDirectory`, and a draft map keyed by `discordUserId` or `playerId` on the runtime lobby. Add methods to save and read draft state without exposing it in public lobby snapshots.

- [x] **Step 4: Implement room timers**

In `GameRoom`, add a disconnect timer map keyed by `playerId`. Schedule a 180,000 ms timer for playing player disconnects, clear it on reconnect, and clear all timers when the match ends or the room is destroyed. On timer expiry call `handleForfeitMatch` without a socket dependency and record/broadcast exactly like manual FF.

- [x] **Step 5: Implement open-lobby leader disconnect cancellation**

In `removeClient`, if the session belongs to the leader of an open lobby, call `cancelLobby`, broadcast `lobby-cancelled`, clear timers, and let room cleanup proceed.

- [x] **Step 6: Implement draft update/restore**

Handle `update-function-draft` by validating session token directly and storing `{ expression, aimDirection }`. On `join-room`, after validating the session, send `function-draft-restored` to that socket if a draft exists.

- [x] **Step 7: Re-run focused server tests**

Run: `npm test -- apps/server/src/rooms/RoomManager.integration.test.ts apps/server/src/lobbies/LobbyDirectory.test.ts`

Expected: PASS.

### Task 3: Client Session Persistence And Draft Sync

**Files:**
- Modify: `apps/client/src/app/useGameStore.ts`
- Modify: `apps/client/src/app/useGameStore.test.ts`
- Modify: `apps/client/src/app/App.tsx`
- Create: `apps/client/src/app/lobbySessionStorage.ts`
- Create: `apps/client/src/app/lobbySessionStorage.test.ts`

**Interfaces:**
- Consumes private `function-draft-restored` event.
- Produces store fields/actions:
  - `draftExpression: string`
  - `draftAimDirection: AimDirectionId`
  - `setDraftExpression(expression: string): void`
  - `setDraftAimDirection(aimDirection: AimDirectionId): void`
- Persists selected lobby session under a localStorage key scoped by guild and Discord user.

- [x] **Step 1: Add failing persistence and store tests**

Test that create/join saves `selectedLobbySession`, a new store restores it, auto-connect can use it, draft changes send `update-function-draft`, and `function-draft-restored` updates local draft without needing a public lobby snapshot.

- [x] **Step 2: Run focused client store tests**

Run: `npm test -- apps/client/src/app/lobbySessionStorage.test.ts apps/client/src/app/useGameStore.test.ts`

Expected: FAIL because storage helpers and draft actions do not exist.

- [x] **Step 3: Implement session storage helpers**

Create typed helpers to read/write/clear selected lobby sessions, scoped to `graphwar.selectedLobbySession:${guildId}:${discordUserId}`. Ignore malformed JSON and mismatched user/guild.

- [x] **Step 4: Wire store persistence**

Load persisted selected session during store creation. Save on create/join. Clear on explicit return-to-menu, lobby-cancelled, local player-forfeited, and match-ended return flow.

- [x] **Step 5: Wire draft state and command sending**

Move draft expression and aim direction from local component state into Zustand. Send `update-function-draft` when either changes and a selected lobby session exists. Handle `function-draft-restored` by replacing local draft values.

- [x] **Step 6: Auto-connect restored sessions**

In `App`, if a selected lobby session exists and connection is `idle` or `closed`, call `connect()`. Use the existing `room-snapshot` event to move into game when the lobby status is playing.

- [x] **Step 7: Re-run focused client store tests**

Run: `npm test -- apps/client/src/app/lobbySessionStorage.test.ts apps/client/src/app/useGameStore.test.ts`

Expected: PASS.

### Task 4: Join Lobby Row UI And Disconnected UX

**Files:**
- Modify: `apps/client/src/lobby/JoinLobbyView.tsx`
- Modify: `apps/client/src/lobby/JoinLobbyView.test.ts`
- Modify: `apps/client/src/lobby/LobbySetupView.tsx`
- Modify: `apps/client/src/lobby/LobbySetupView.test.tsx`
- Modify: `apps/client/src/styles.css`
- Modify: `apps/client/src/hud/MatchHud.tsx`
- Modify: `apps/client/src/hud/MatchHud.test.ts`

**Interfaces:**
- Consumes lobby occupant `connected: false`.
- Produces inline join row buttons and visible disconnected/reconnecting states.

- [x] **Step 1: Add failing UI tests**

Test JoinLobbyView static render contains inline join buttons for each lobby row and does not render clickable lobby name buttons. Test disconnected lobby occupants render a `Disconnected` label. Test MatchHud connection copy contains “Trying to reestablish connection” for reconnecting.

- [x] **Step 2: Run focused UI tests**

Run: `npm test -- apps/client/src/lobby/JoinLobbyView.test.ts apps/client/src/lobby/LobbySetupView.test.tsx apps/client/src/hud/MatchHud.test.ts`

Expected: FAIL for the old selected-lobby UI and missing disconnected copy.

- [x] **Step 3: Implement inline join actions**

Remove `selectedRoomId` and render each `lobby-row` with lobby name/status on the left and `Join As Player` / `Spectate` buttons on the right. Disable player join for playing lobbies and spectator join while a join request is in flight.

- [x] **Step 4: Implement disconnected labels**

Add compact disconnected status text next to lobby setup occupants and ensure the game HUD says “Trying to reestablish connection” while reconnecting.

- [x] **Step 5: Adjust CSS for Discord-sized layout**

Keep row actions compact, prevent overflow, and preserve no-scroll menu behavior.

- [x] **Step 6: Re-run focused UI tests**

Run: `npm test -- apps/client/src/lobby/JoinLobbyView.test.ts apps/client/src/lobby/LobbySetupView.test.tsx apps/client/src/hud/MatchHud.test.ts`

Expected: PASS.

### Task 5: Full Verification, Docs, Graphify, Push

**Files:**
- Modify: `README.md`
- Modify: `graphify-out/*` via Graphify update
- Commit all intended files except unrelated untracked notes.

**Interfaces:**
- Consumes completed Tasks 1-4.
- Produces a pushed `main` commit with README and graph current.

- [x] **Step 1: Run full verification**

Run:
- `npm run check`
- `npm test`
- `npm run test:e2e`

Expected: all pass.

- [x] **Step 2: Update README**

Mention refresh resume, 3-minute disconnect FF, private draft restore, and inline lobby joins in the local prototype feature list.

- [x] **Step 3: Update Graphify**

Run: `graphify update .`

Remove any accidental references to `prompt notes.txt` from Graphify outputs if they appear.

- [ ] **Step 4: Final status and commit**

Run `git status -sb`; stage intended files only; leave `prompt notes.txt` untracked. Commit with message `Add reconnect resume and disconnect forfeits`.

- [ ] **Step 5: Push**

Run: `git push origin main`.

Expected: `main -> main`.

## Self-Review

- Spec coverage: resume after refresh, reconnect status, timer authority, draft restore, 3-minute auto-FF, leader open-lobby cancellation, inline join buttons, local-first implementation, README/Graphify/push are covered.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: draft command/event names are identical across shared protocol, server, and client tasks.
