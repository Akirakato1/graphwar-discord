# Gameplay UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Halve shot travel length, preserve final killing-shot playback, add a blocking winner popup, and center the main menu.

**Architecture:** Keep the server authoritative and event-driven: every accepted shot emits `shot-resolved`, and match-ending shots then emit `match-ended`. The client stages the same pre-shot snapshot in HUD and canvas until playback completes, then shows a modal that owns the only permitted post-match action.

**Tech Stack:** TypeScript, React, Zustand, Fastify/ws, Zod protocol schemas, Vitest, Playwright.

---

## File Structure

- Modify `packages/shared/src/constants.ts`: halve `defaultMatchTuning.maxPathPoints`.
- Create `packages/shared/src/constants.test.ts`: prove the effective travel cap is `50.0` units.
- Modify `apps/server/src/match/MatchController.ts`: return ordered events for shot resolution plus optional match end.
- Modify `apps/server/src/match/MatchController.test.ts`: update shot assertions to the new ordered-events API.
- Modify `apps/server/src/rooms/GameRoom.ts`: broadcast shot and match-end events in order, without `turn-advanced` after match end.
- Modify `apps/server/src/rooms/RoomManager.integration.test.ts`: assert final shot broadcasts `shot-resolved` before `match-ended`.
- Create `apps/client/src/match-end/MatchEndModal.tsx`: render winner text and return action.
- Create `apps/client/src/match-end/MatchEndModal.test.tsx`: cover team and free-for-all winner formatting.
- Modify `apps/client/src/app/useGameStore.ts`: add `returnToMenu()` to clear active lobby/match state.
- Modify `apps/client/src/app/useGameStore.test.ts`: cover the new return-to-menu cleanup.
- Modify `apps/client/src/app/App.tsx`: pass `displaySnapshot` to `GameCanvas`, delay modal until playback ends, wire return action.
- Modify `apps/client/src/styles.css`: style centered main menu and modal overlay within no-scroll viewport.
- Modify `apps/client/e2e/local-lobby.spec.ts`: cover final-shot modal ordering and return to menu.
- Modify `README.md`: record the implemented checkpoint and current shot length.

---

### Task 1: Server Shot Sequencing And Length Limit

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/constants.test.ts`
- Modify: `apps/server/src/match/MatchController.ts`
- Modify: `apps/server/src/match/MatchController.test.ts`
- Modify: `apps/server/src/rooms/GameRoom.ts`
- Modify: `apps/server/src/rooms/RoomManager.integration.test.ts`

- [ ] **Step 1: Write the failing length-limit test**

Create `packages/shared/src/constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultMatchTuning } from "./constants";

describe("defaultMatchTuning", () => {
  it("caps normal shot travel at 50 world units before field clipping", () => {
    const travelLimit = defaultMatchTuning.sampleStep * (defaultMatchTuning.maxPathPoints - 1);

    expect(travelLimit).toBeCloseTo(50);
  });
});
```

- [ ] **Step 2: Write failing MatchController tests for ending shots**

In `apps/server/src/match/MatchController.test.ts`, update ending-shot tests to expect ordered events:

```ts
const events = controller.submitShot("alice", "normal", "0");

expect(events.map((event) => event.type)).toEqual(["shot-resolved", "match-ended"]);
const ended = events[1];
expect(ended.type).toBe("match-ended");
if (ended.type === "match-ended") {
  expect(ended.winnerIds).toEqual(["alice"]);
  expect(ended.snapshot.phase).toBe("ended");
}
```

Also update non-ending and rejection assertions to read the first event:

```ts
const [event] = controller.submitShot("alice", "normal", "0", "west");
expect(event.type).toBe("shot-resolved");
```

- [ ] **Step 3: Write failing RoomManager integration assertion**

In `apps/server/src/rooms/RoomManager.integration.test.ts`, in the persistence-failure end-match test, capture Alice event count before the final shot and assert order:

```ts
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
expect(finalEvents.map((event) => event.type)).toContain("shot-resolved");
expect(finalEvents.findIndex((event) => event.type === "shot-resolved")).toBeLessThan(
  finalEvents.findIndex((event) => event.type === "match-ended")
);
expect(finalEvents.slice(finalEvents.findIndex((event) => event.type === "match-ended")).some(
  (event) => event.type === "turn-advanced"
)).toBe(false);
```

- [ ] **Step 4: Run focused failing tests**

Run:

```bash
npm test -- packages/shared/src/constants.test.ts apps/server/src/match/MatchController.test.ts apps/server/src/rooms/RoomManager.integration.test.ts
```

Expected: fail because the cap is still `99.95` and `submitShot()` returns a single `match-ended` event for match-ending shots.

- [ ] **Step 5: Implement server changes**

Change `packages/shared/src/constants.ts`:

```ts
maxPathPoints: 1001
```

Change `apps/server/src/match/MatchController.ts` so `submitShot()` returns `ServerEvent[]`. Build the `shot-resolved` event before ending the snapshot:

```ts
const shotResolved: ServerEvent = {
  type: "shot-resolved",
  roomId: this.roomId,
  shooterId: playerId,
  functionFamilyId,
  aimDirection,
  expression,
  path: result.path,
  impact: result.impact,
  terrain: result.terrain,
  damage: result.damage,
  eliminations: result.eliminations,
  snapshot: this.getSnapshot()
};

if (victory.ended) {
  this.snapshot = { ...this.snapshot, phase: "ended" };
  return [
    shotResolved,
    { type: "match-ended", roomId: this.roomId, winnerIds: victory.winnerIds, snapshot: this.getSnapshot() }
  ];
}

return [shotResolved];
```

Change all early rejections in `submitShot()` to return a one-event array. For example:

```ts
if (this.snapshot.phase !== "playing") {
  return [this.rejectShot(playerId, "Match is not playing")];
}

if (this.snapshot.turn.activePlayerId !== playerId) {
  return [this.rejectShot(playerId, "Player is not active")];
}
```

Change `apps/server/src/rooms/GameRoom.ts` to broadcast returned events in order:

```ts
const events = this.match.submitShot(command.playerId, command.functionFamilyId, command.expression, command.aimDirection);
const rejected = events[0];
if (rejected?.type === "shot-rejected") {
  this.sendTo(socket, rejected);
  return;
}

for (const event of events) {
  this.broadcast(this.withResolvedLobbyContext(event));
}

const matchEnded = events.find((event) => event.type === "match-ended");
if (matchEnded && this.lobbyContext) {
  await this.recordMatchResult(matchEnded.winnerIds, matchEnded.snapshot.players.map((player) => player.id));
  return;
}

const shotResolved = events.find((event) => event.type === "shot-resolved");
if (shotResolved) {
  this.broadcast({
    type: "turn-advanced",
    roomId: this.roomId,
    playerId: shotResolved.snapshot.turn.activePlayerId,
    turnNumber: shotResolved.snapshot.turn.turnNumber
  });
}
```

- [ ] **Step 6: Run focused tests again**

Run:

```bash
npm test -- packages/shared/src/constants.test.ts apps/server/src/match/MatchController.test.ts apps/server/src/rooms/RoomManager.integration.test.ts
```

Expected: pass.

---

### Task 2: Match-End Modal And Return-To-Menu State

**Files:**
- Create: `apps/client/src/match-end/MatchEndModal.tsx`
- Create: `apps/client/src/match-end/MatchEndModal.test.tsx`
- Modify: `apps/client/src/app/useGameStore.ts`
- Modify: `apps/client/src/app/useGameStore.test.ts`

- [ ] **Step 1: Write failing modal tests**

Create `apps/client/src/match-end/MatchEndModal.test.tsx`:

```tsx
import type { MatchEndedEvent, MatchSnapshot } from "@graphwar/shared";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatMatchWinner, MatchEndModal } from "./MatchEndModal";

const teamSnapshot: MatchSnapshot = {
  phase: "ended",
  mode: "team-versus",
  players: [
    { id: "alice", displayName: "Alice", teamId: "team-a", position: { x: 0, y: 0 }, hp: 65, alive: true },
    { id: "bob", displayName: "Bob", teamId: "team-a", position: { x: 1, y: 0 }, hp: 20, alive: true },
    { id: "cara", displayName: "Cara", teamId: "team-b", position: { x: 2, y: 0 }, hp: 0, alive: false }
  ],
  teams: [
    { id: "team-a", playerIds: ["alice", "bob"] },
    { id: "team-b", playerIds: ["cara"] }
  ],
  terrain: { blobs: [] },
  turn: { activePlayerId: "alice", order: ["alice", "bob", "cara"], turnNumber: 4 }
};

describe("MatchEndModal", () => {
  it("formats team winners with team label and winner names", () => {
    expect(formatMatchWinner(teamSnapshot, ["alice", "bob"])).toEqual({
      title: "Team A wins",
      detail: "Alice, Bob"
    });
  });

  it("renders a blocking dialog with only the return action", () => {
    const event: MatchEndedEvent = {
      type: "match-ended",
      roomId: "room-1",
      winnerIds: ["alice", "bob"],
      snapshot: teamSnapshot
    };

    const html = renderToStaticMarkup(React.createElement(MatchEndModal, { event, onReturnToMenu: () => {} }));

    expect(html).toContain("role=\"dialog\"");
    expect(html).toContain("Team A wins");
    expect(html).toContain("Alice, Bob");
    expect(html).toContain("Return to Menu");
  });
});
```

- [ ] **Step 2: Write failing store cleanup test**

In `apps/client/src/app/useGameStore.test.ts`, add:

```ts
it("returns to the main menu and clears active lobby state", async () => {
  let closed = false;
  let onEvent: ((event: ServerEvent) => void) | undefined;
  const store = createGameStore({
    session,
    lobbyApi: lobbyApiFor(),
    clientFactory: (options) => {
      onEvent = options.onEvent;
      return {
        send: () => {},
        close: () => {
          closed = true;
          options.onClose();
        }
      };
    }
  });

  await selectLobby(store);
  onEvent?.({ type: "room-snapshot", roomId: "local-test", snapshot });

  store.getState().returnToMenu();

  expect(closed).toBe(true);
  expect(store.getState()).toMatchObject({
    view: "main-menu",
    connectionStatus: "closed",
    currentLobby: undefined,
    selectedLobbySession: undefined,
    snapshot: undefined,
    recentEvents: []
  });
});
```

- [ ] **Step 3: Run focused failing tests**

Run:

```bash
npm test -- apps/client/src/match-end/MatchEndModal.test.tsx apps/client/src/app/useGameStore.test.ts
```

Expected: fail because the modal and `returnToMenu()` do not exist.

- [ ] **Step 4: Implement modal and store action**

Create `apps/client/src/match-end/MatchEndModal.tsx`:

```tsx
import type { MatchEndedEvent, MatchSnapshot } from "@graphwar/shared";

type WinnerText = { title: string; detail: string };

export function formatMatchWinner(snapshot: MatchSnapshot, winnerIds: string[]): WinnerText {
  const winners = winnerIds
    .map((winnerId) => snapshot.players.find((player) => player.id === winnerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));
  const names = winners.map((winner) => winner.displayName).join(", ");

  if (winners.length === 0) {
    return { title: "Match ended", detail: "No winner" };
  }

  if (snapshot.mode === "team-versus") {
    const teamId = winners[0].teamId;
    const title = `${teamLabel(teamId)} wins`;
    return { title, detail: names };
  }

  return { title: winners.length === 1 ? `${names} wins` : "Winners", detail: names };
}

export function MatchEndModal({
  event,
  onReturnToMenu
}: {
  event: MatchEndedEvent;
  onReturnToMenu: () => void;
}) {
  const winnerText = formatMatchWinner(event.snapshot, event.winnerIds);

  return (
    <div className="match-end-backdrop">
      <section aria-labelledby="match-end-title" aria-modal="true" className="match-end-dialog" role="dialog">
        <p className="eyebrow">Match complete</p>
        <h2 id="match-end-title">{winnerText.title}</h2>
        <p>{winnerText.detail}</p>
        <button className="primary-action" onClick={onReturnToMenu} type="button">
          Return to Menu
        </button>
      </section>
    </div>
  );
}

function teamLabel(teamId: string): string {
  if (teamId === "team-a") return "Team A";
  if (teamId === "team-b") return "Team B";
  return teamId || "Winning team";
}
```

Modify `apps/client/src/app/useGameStore.ts` to add `returnToMenu(): void` to `GameStoreState` and implement it by closing the active client, clearing active lobby/match fields, clearing errors/rejections, and setting `view` to `main-menu`.

- [ ] **Step 5: Run focused tests again**

Run:

```bash
npm test -- apps/client/src/match-end/MatchEndModal.test.tsx apps/client/src/app/useGameStore.test.ts
```

Expected: pass.

---

### Task 3: Client Playback Integration And E2E Coverage

**Files:**
- Modify: `apps/client/src/app/App.tsx`
- Modify: `apps/client/e2e/local-lobby.spec.ts`

- [ ] **Step 1: Write failing E2E final-shot ordering test**

In `apps/client/e2e/local-lobby.spec.ts`, add a test that:

1. Creates a team-versus lobby with Alice and Bob.
2. Alice hits Bob three times with `0.05x(36-x)`.
3. Bob fires harmless misses between Alice turns.
4. After Alice's killing shot, asserts the canvas has path points before the dialog appears.
5. Waits for the path to clear, then asserts the dialog says `Team A wins`.
6. Clicks `Return to Menu` and asserts the Graphwar main menu is visible.

Use this helper inside the test for Bob's misses:

```ts
async function fireMiss(page: Page): Promise<void> {
  await page.getByLabel("Aim east").click();
  await page.getByLabel("Function Shot").fill("-x");
  await page.getByRole("button", { name: "Fire" }).click();
  await expect.poll(() => canvasPathPoints(page)).toBeGreaterThan(0);
  await expect.poll(() => canvasPathPoints(page), { timeout: 5_000 }).toBe(0);
}
```

- [ ] **Step 2: Run E2E to verify failure**

Run:

```bash
npm run test:e2e
```

Expected: fail because the modal does not exist and the killing shot path is not emitted yet.

- [ ] **Step 3: Implement App integration**

Modify `apps/client/src/app/App.tsx`:

```tsx
import { MatchEndModal } from "../match-end/MatchEndModal";
```

Add a local helper:

```ts
function findLatestMatchEndedEvent(events: ServerEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "match-ended") {
      return event;
    }
  }
  return undefined;
}
```

In `GameActivity`, read `returnToMenu`, compute `latestMatchEnded`, and delay modal visibility:

```tsx
const returnToMenu = useGameStore((state) => state.returnToMenu);
const latestMatchEnded = useMemo(() => findLatestMatchEndedEvent(recentEvents), [recentEvents]);
const showMatchEndModal = Boolean(latestMatchEnded && !playbackInProgress);
```

Pass the staged snapshot to the canvas:

```tsx
<GameCanvas events={recentEvents} snapshot={displaySnapshot} />
```

Render the modal after the grid:

```tsx
{showMatchEndModal && latestMatchEnded ? (
  <MatchEndModal event={latestMatchEnded} onReturnToMenu={returnToMenu} />
) : null}
```

- [ ] **Step 4: Run focused E2E**

Run:

```bash
npm run test:e2e
```

Expected: pass.

---

### Task 4: Main Menu And Modal Styling

**Files:**
- Modify: `apps/client/src/styles.css`
- Modify: `apps/client/src/menu/MainMenu.tsx`

- [ ] **Step 1: Update menu markup**

Wrap the existing main menu content in a centered group:

```tsx
<section className="menu-screen" aria-labelledby="main-menu-title">
  <div className="main-menu-cardless">
    <div className="main-menu-heading">
      <p className="eyebrow">Guild {guildId}</p>
      <h1 id="main-menu-title">Graphwar</h1>
    </div>
    <div className="menu-actions">
      <button className="primary-action" onClick={() => onNavigate("create-lobby")} type="button">
        Create Lobby
      </button>
      <button className="secondary-action" onClick={() => onNavigate("join-lobby")} type="button">
        Join Lobby
      </button>
      <button className="secondary-action" onClick={() => onNavigate("settings")} type="button">
        Settings
      </button>
      <button className="secondary-action" onClick={() => onNavigate("leaderboard")} type="button">
        Leaderboard
      </button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add responsive styles**

In `apps/client/src/styles.css`, update menu and modal styles:

```css
.menu-screen {
  align-items: center;
  justify-content: center;
}

.main-menu-cardless {
  display: grid;
  gap: 18px;
  justify-items: center;
  width: min(380px, 100%);
  text-align: center;
}

.main-menu-heading {
  display: grid;
  gap: 6px;
}

.menu-actions {
  display: grid;
  gap: 8px;
  width: 100%;
}

.menu-actions .primary-action,
.menu-actions .secondary-action {
  width: 100%;
}

.match-end-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  background: rgba(9, 10, 9, 0.72);
  padding: 16px;
}

.match-end-dialog {
  display: grid;
  gap: 10px;
  width: min(360px, 100%);
  border: 1px solid #3d4b43;
  border-radius: 8px;
  background: #20201d;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
  padding: 18px;
  text-align: center;
}

.match-end-dialog h2,
.match-end-dialog p {
  margin: 0;
}
```

- [ ] **Step 3: Run viewport E2E**

Run:

```bash
npm run test:e2e
```

Expected: pass with no page scroll at `1280x720` and `640x360`.

---

### Task 5: README, Full Verification, Commit, Push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Record:

- Effective normal shot travel limit is now `50.0` units before field-boundary clipping.
- Match-ending shots emit and render the final `shot-resolved` animation before the winner popup.
- The winner popup blocks gameplay and returns to the main menu.
- Main menu layout is centered for the Discord 16:9 no-scroll target.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run check
npm test
npm run test:e2e
npm --workspace apps/client run build
npm --workspace apps/server run build
```

Expected: all pass.

- [ ] **Step 3: Commit**

Run:

```bash
git status -sb
git add packages/shared/src/constants.ts packages/shared/src/constants.test.ts apps/server/src/match/MatchController.ts apps/server/src/match/MatchController.test.ts apps/server/src/rooms/GameRoom.ts apps/server/src/rooms/RoomManager.integration.test.ts apps/client/src/match-end/MatchEndModal.tsx apps/client/src/match-end/MatchEndModal.test.tsx apps/client/src/app/useGameStore.ts apps/client/src/app/useGameStore.test.ts apps/client/src/app/App.tsx apps/client/src/styles.css apps/client/src/menu/MainMenu.tsx apps/client/e2e/local-lobby.spec.ts README.md
git commit -m "fix: preserve match ending shot playback"
```

- [ ] **Step 4: Push**

Run:

```bash
git push
```

Expected: branch `feature/graphwar-prototype` pushes to `origin/feature/graphwar-prototype`.
