# Turn Timer And Function UI Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-turn timer and robust resume, then ship keypad/keyboard/hybrid input modes with LaTeX-style live function preview and cursor-slot controls.

**Architecture:** Keep server as source of truth for match timing and turn state; continue using snapshot replay on client for rendering, with speculative preview computed locally.

**Tech Stack:** TypeScript, React, Zustand, Fastify/WS, Zod, Vitest, Playwright.

## Global Constraints
- Preserve Discord Activity-friendly UI: 16:9 fit, no scrolling required, and no extra chrome.
- Function input should support both key-based and button-based control depending on lobby setting.
- Turn transitions must be deterministic when restoring by refresh (room snapshot should carry enough timer context).

### Task 1: Turn timer protocol and lobby setting

**Files:**
- Modify: `packages/shared/src/state/types.ts`
- Modify: `packages/shared/src/protocol/events.ts`, `packages/shared/src/protocol/schemas.ts`
- Modify: `packages/shared/src/lobby/types.ts`, `packages/shared/src/lobby/schemas.ts`
- Modify: `apps/server/src/lobbies/LobbyDirectory.ts`, `apps/server/src/match/MatchController.ts`, `apps/server/src/rooms/GameRoom.ts`
- Modify: `apps/client/src/app/useGameStore.ts`, `apps/client/src/lobby/CreateLobbyView.tsx`, `apps/client/src/lobby/LobbySetupView.tsx`, `apps/client/src/hud/MatchHud.tsx`

- [x] **Step 1:** Add timer fields to shared types and events (`TurnState`, turn events, room snapshots, and validation).
- [x] **Step 2:** Add lobby setting and persistence (`turnDurationSeconds`) in create/setup flows with defaults.
- [x] **Step 3:** Enforce timer on server and emit timer-aware `turn-started/turn-advanced`.
- [x] **Step 4:** Resume timer on client from snapshot and block fire when turn has expired.

### Task 2: Input mode setting, keypad support, and live preview

**Files:**
- Modify: `packages/shared/src/lobby/types.ts`, `packages/shared/src/lobby/schemas.ts`
- Modify: `apps/client/src/lobby/LobbySetupView.tsx`
- Modify: `apps/client/src/input/FunctionInput.tsx`, `apps/client/src/input/insertSnippet.ts`
- Modify: `apps/client/src/styles.css`

- [x] **Step 1:** Add lobby input mode (`keypad`, `keyboard`, `hybrid`) with default `hybrid`.
- [x] **Step 2:** Gate controls by mode in function input component.
- [x] **Step 3:** Implement arrow-key navigation with partial LaTeX slot awareness (`sub`, `sup`, body) and delete controls.
- [x] **Step 4:** Add live formatted function preview in UI while typing or using keypad.

### Task 3: Requested UI cleanup

**Files:**
- Modify: `apps/client/src/input/insertSnippet.ts`, `apps/client/src/styles.css`

- [x] **Step 1:** Remove `factorial` and `wave` snippet actions and keep `^` exponent button.
- [x] **Step 2:** Ensure function input still supports typed power notation (e.g., `x^2`).

### Task 4: Verification, docs, and delivery

- [x] **Step 1:** Update tests for new schemas, lobby settings, timer events, and HUD/input behavior.
- [x] **Step 2:** Run checks for server, shared, and client packages.
- [x] **Step 3:** Update README with turn timer and input mode notes.
- [x] **Step 4:** Commit and push after completion.
