# Gameplay Settings Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-authoritative damage-per-hit, unique successful function hits, and friendly-fire lobby settings.

**Architecture:** Shared lobby contracts define gameplay setting defaults, bounds, normalization, and schema validation. The lobby directory stores settings and exposes them in snapshots/summaries, the room passes them into match start, the match controller owns unique-hit history, and the simulator applies configured damage plus friendly-fire target filtering.

**Tech Stack:** TypeScript, Zod, React, Zustand, Fastify/WebSocket room flow, Vitest, Playwright.

---

## File Structure

- `packages/shared/src/lobby/gameplaySettings.ts`: gameplay setting defaults, bounds, normalization helpers, and unique-hit expression normalization.
- `packages/shared/src/lobby/types.ts`: add `damagePerHit`, `uniqueFunctionHits`, and `friendlyFire` to lobby request/snapshot/summary contracts.
- `packages/shared/src/lobby/schemas.ts`: validate/default new create-lobby gameplay setting fields and expose them in lobby snapshot/summary schemas.
- `packages/shared/src/lobby/schemas.test.ts`: shared schema RED/GREEN tests for defaults, valid bounds, and invalid damage values.
- `apps/server/src/lobbies/LobbyDirectory.ts`: store settings in runtime lobbies and expose them in snapshots/summaries.
- `apps/server/src/lobbies/LobbyDirectory.test.ts`: lobby persistence tests for gameplay settings.
- `apps/server/src/simulation/ShotSimulator.ts`: accept `damagePerHit` and `allowFriendlyFire`, then filter friendly targets before collision.
- `apps/server/src/simulation/ShotSimulator.test.ts`: configured damage and friendly-fire collision behavior tests.
- `apps/server/src/match/MatchController.ts`: store match rules, reset unique-hit history at start, reject duplicate successful target hits, and pass damage/friendly-fire options to simulation.
- `apps/server/src/match/MatchController.test.ts`: tests for configured damage, duplicate rejection, no turn consumption, and reset across new matches.
- `apps/server/src/rooms/GameRoom.ts`: pass lobby settings into `MatchController.startMatch()`.
- `apps/server/src/rooms/RoomManager.integration.test.ts`: HTTP/WebSocket coverage for selected settings and authoritative outcomes.
- `apps/client/src/lobby/CreateLobbyView.tsx`: compact create-lobby controls for damage, unique hits, and friendly fire.
- `apps/client/src/lobby/CreateLobbyView.test.ts`: helper and static markup tests for new controls.
- `apps/client/src/lobby/LobbySetupView.tsx`: read-only match-rules summary before match start.
- `apps/client/src/lobby/LobbySetupView.test.tsx`: summary rendering tests.
- `apps/client/src/app/useGameStore.ts`: carry settings from create-lobby form into API payload.
- `apps/client/src/app/useGameStore.test.ts`: create-lobby payload propagation tests.
- `apps/client/e2e/local-lobby.spec.ts`: smoke coverage for selecting settings and duplicate-hit rejection.
- `README.md`: update checkpoint after each pushed implementation checkpoint.

---

### Task 1: Shared Gameplay Setting Contracts

**Files:**
- Create: `packages/shared/src/lobby/gameplaySettings.ts`
- Modify: `packages/shared/src/lobby/types.ts`
- Modify: `packages/shared/src/lobby/schemas.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/lobby/schemas.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing shared schema tests**

Add tests in `packages/shared/src/lobby/schemas.test.ts`:

```ts
import {
  damagePerHitBounds,
  defaultFriendlyFire,
  defaultUniqueFunctionHits,
  normalizeFunctionHitExpression
} from "./gameplaySettings";

it("defaults phase 2 gameplay settings for backward-compatible create requests", () => {
  const parsed = createLobbyRequestSchema.parse({
    name: "Team Room",
    leaderDiscordUserId: "alice-id",
    alias: "Alice",
    mode: "team-versus",
    initialSlot: "player"
  });

  expect(parsed).toEqual(
    expect.objectContaining({
      damagePerHit: damagePerHitBounds.default,
      uniqueFunctionHits: defaultUniqueFunctionHits,
      friendlyFire: defaultFriendlyFire
    })
  );
});

it("validates damage-per-hit bounds and accepts gameplay setting booleans", () => {
  expect(
    createLobbyRequestSchema.parse({
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      damagePerHit: 100,
      uniqueFunctionHits: false,
      friendlyFire: true
    })
  ).toEqual(expect.objectContaining({ damagePerHit: 100, uniqueFunctionHits: false, friendlyFire: true }));

  expect(() =>
    createLobbyRequestSchema.parse({
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      damagePerHit: 34
    })
  ).toThrow();

  expect(() =>
    createLobbyRequestSchema.parse({
      name: "Team Room",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      damagePerHit: 101
    })
  ).toThrow();
});

it("parses lobby snapshots and summaries with phase 2 gameplay settings", () => {
  const lobby = {
    guildId: "guild-1",
    roomId: "room-1",
    name: "Team Room",
    mode: "team-versus",
    status: "open",
    leaderDiscordUserId: "alice-id",
    occupants: [],
    canStart: false,
    maxFunctionLength: defaultMaxFunctionLength,
    damagePerHit: 80,
    uniqueFunctionHits: false,
    friendlyFire: true,
    createdAt: "2026-07-05T00:00:00.000Z"
  } as const;

  expect(lobbyRuntimeSnapshotSchema.parse(lobby)).toEqual(lobby);
  expect(
    lobbySummarySchema.parse({
      guildId: "guild-1",
      roomId: "room-1",
      name: "Team Room",
      mode: "team-versus",
      status: "open",
      leaderAlias: "Alice",
      leaderDiscordUserId: "alice-id",
      playerCount: 1,
      spectatorCount: 0,
      damagePerHit: 80,
      uniqueFunctionHits: false,
      friendlyFire: true,
      createdAt: "2026-07-05T00:00:00.000Z"
    })
  ).toEqual(expect.objectContaining({ damagePerHit: 80, uniqueFunctionHits: false, friendlyFire: true }));
});

it("normalizes duplicate-hit expressions by removing ASCII whitespace only", () => {
  expect(normalizeFunctionHitExpression(" sin( x ) + 2\tcos(x)\n")).toBe("sin(x)+2cos(x)");
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- packages/shared/src/lobby/schemas.test.ts
```

Expected: FAIL because `gameplaySettings.ts` and the new schema fields do not exist.

- [ ] **Step 3: Implement shared contracts**

Create `packages/shared/src/lobby/gameplaySettings.ts`:

```ts
import { defaultMatchTuning } from "../constants";

export const damagePerHitBounds = {
  min: 35,
  max: 100,
  default: defaultMatchTuning.directHitDamage
} as const;

export const defaultUniqueFunctionHits = true;
export const defaultFriendlyFire = false;

export type LobbyGameplaySettings = {
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
};

export const defaultLobbyGameplaySettings: LobbyGameplaySettings = {
  damagePerHit: damagePerHitBounds.default,
  uniqueFunctionHits: defaultUniqueFunctionHits,
  friendlyFire: defaultFriendlyFire
};

export function normalizeDamagePerHit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return damagePerHitBounds.default;
  }

  const rounded = Math.round(value);
  return Math.min(damagePerHitBounds.max, Math.max(damagePerHitBounds.min, rounded));
}

export function normalizeFunctionHitExpression(expression: string): string {
  return expression.replace(/[ \t\r\n\f\v]+/g, "");
}
```

Update `packages/shared/src/lobby/types.ts`:

```ts
import type { LobbyGameplaySettings } from "./gameplaySettings";

export type LobbyRuntimeSnapshot = {
  // existing fields...
  maxFunctionLength: number;
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  // existing map fields...
};

export type LobbySummary = {
  // existing fields...
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  // existing map fields...
};

export type CreateLobbyRequest = {
  // existing fields...
  maxFunctionLength?: number;
  damagePerHit?: number;
  uniqueFunctionHits?: boolean;
  friendlyFire?: boolean;
  // existing map fields...
};

export type LobbyGameplaySettingsSnapshot = LobbyGameplaySettings;
```

Update `packages/shared/src/lobby/schemas.ts`:

```ts
import { damagePerHitBounds, defaultFriendlyFire, defaultUniqueFunctionHits } from "./gameplaySettings";

export const damagePerHitSchema = z.preprocess((value) => {
  if (value === undefined) {
    return damagePerHitBounds.default;
  }

  return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
}, z.number().int().min(damagePerHitBounds.min).max(damagePerHitBounds.max));
```

Add `damagePerHit: damagePerHitSchema`, `uniqueFunctionHits: z.boolean().default(defaultUniqueFunctionHits)`, and `friendlyFire: z.boolean().default(defaultFriendlyFire)` to `createLobbyRequestSchema`, `lobbyRuntimeSnapshotSchema`, and `lobbySummarySchema`.

Update `packages/shared/src/index.ts`:

```ts
export * from "./lobby/gameplaySettings";
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- packages/shared/src/lobby/schemas.test.ts
npm run check
```

Expected: targeted shared tests pass; typecheck failures identify downstream files for later tasks, not missed shared exports.

- [ ] **Step 5: Commit and push**

Update `README.md` with a Phase 2 shared-contract checkpoint, then run:

```bash
git add packages/shared/src README.md docs/superpowers/plans/2026-07-06-gameplay-settings-phase-2.md
git commit -m "feat: add gameplay settings contracts"
git push
```

---

### Task 2: Lobby Storage And Room Propagation

**Files:**
- Modify: `apps/server/src/lobbies/LobbyDirectory.ts`
- Modify: `apps/server/src/lobbies/LobbyDirectory.test.ts`
- Modify: `apps/server/src/rooms/GameRoom.ts`
- Test: `apps/server/src/rooms/RoomManager.integration.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing lobby tests**

Add to `apps/server/src/lobbies/LobbyDirectory.test.ts`:

```ts
it("stores gameplay settings in lobby snapshots and summaries", async () => {
  const directory = createDirectory();

  const created = await directory.createLobby("guild-1", {
    name: "Rules Room",
    leaderDiscordUserId: "alice-id",
    alias: "Alice",
    mode: "team-versus",
    initialSlot: "player",
    damagePerHit: 80,
    uniqueFunctionHits: false,
    friendlyFire: true
  });

  expect(created.lobby).toEqual(
    expect.objectContaining({ damagePerHit: 80, uniqueFunctionHits: false, friendlyFire: true })
  );
  expect(directory.getLobby("guild-1", "room-1")).toEqual(
    expect.objectContaining({ damagePerHit: 80, uniqueFunctionHits: false, friendlyFire: true })
  );
  expect(directory.listLobbies("guild-1")).toEqual([
    expect.objectContaining({ damagePerHit: 80, uniqueFunctionHits: false, friendlyFire: true })
  ]);
});
```

Add to `apps/server/src/rooms/RoomManager.integration.test.ts`:

```ts
it("exposes gameplay settings in lobby websocket snapshots before match start", async () => {
  const app = await startTestServer();
  const createResponse = await app.inject({
    method: "POST",
    url: "/guilds/local-guild/lobbies",
    payload: {
      name: "Rules Preview",
      leaderDiscordUserId: "alice-id",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      damagePerHit: 80,
      uniqueFunctionHits: false,
      friendlyFire: true
    }
  });
  expect(createResponse.statusCode).toBe(201);
  const created = JSON.parse(createResponse.body);
  const alice = await connect(guildSocketUrl(app, "local-guild", created.session.roomId));
  const aliceEvents = collectEvents(alice);

  send(alice, lobbyJoinCommand(created.session));
  const event = await waitForEvent(
    () => aliceEvents,
    (candidate) => candidate.type === "room-snapshot" && candidate.lobby?.occupants.length === 1
  );

  expect(event.type).toBe("room-snapshot");
  if (event.type === "room-snapshot") {
    expect(event.lobby).toEqual(
      expect.objectContaining({ damagePerHit: 80, uniqueFunctionHits: false, friendlyFire: true })
    );
  }

  await closeSocket(alice);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- apps/server/src/lobbies/LobbyDirectory.test.ts apps/server/src/rooms/RoomManager.integration.test.ts
```

Expected: FAIL because runtime lobbies do not store or emit the new fields.

- [ ] **Step 3: Implement lobby storage and room start propagation**

In `apps/server/src/lobbies/LobbyDirectory.ts`, import `defaultLobbyGameplaySettings` and `normalizeDamagePerHit`. Add runtime fields:

```ts
damagePerHit: number;
uniqueFunctionHits: boolean;
friendlyFire: boolean;
```

Set them during `createLobby()`:

```ts
damagePerHit: normalizeDamagePerHit(request.damagePerHit),
uniqueFunctionHits: request.uniqueFunctionHits ?? defaultLobbyGameplaySettings.uniqueFunctionHits,
friendlyFire: request.friendlyFire ?? defaultLobbyGameplaySettings.friendlyFire,
```

Include them in `listLobbies()` summaries and `snapshot()`.

In `apps/server/src/rooms/GameRoom.ts`, pass the lobby values to match start:

```ts
const snapshot = this.match.startMatch(lobby.mode, generatedMap, {
  maxFunctionLength: lobby.maxFunctionLength,
  mapSizePreset: openLobby.mapId ? undefined : lobby.mapSizePreset,
  damagePerHit: lobby.damagePerHit,
  uniqueFunctionHits: lobby.uniqueFunctionHits,
  friendlyFire: lobby.friendlyFire
});
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- apps/server/src/lobbies/LobbyDirectory.test.ts apps/server/src/rooms/RoomManager.integration.test.ts
npm run check
```

Expected: targeted tests pass after match start options are added in Task 3, or typecheck points to the exact `MatchStartOptions` fields to add next.

- [ ] **Step 5: Commit and push**

Update `README.md`, then:

```bash
git add apps/server/src/lobbies apps/server/src/rooms README.md
git commit -m "feat: store gameplay settings in lobbies"
git push
```

---

### Task 3: Server Simulation Rules

**Files:**
- Modify: `apps/server/src/simulation/ShotSimulator.ts`
- Modify: `apps/server/src/simulation/ShotSimulator.test.ts`
- Modify: `apps/server/src/match/MatchController.ts`
- Modify: `apps/server/src/match/MatchController.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing simulator tests**

Add to `apps/server/src/simulation/ShotSimulator.test.ts`:

```ts
it("uses configured damage for player hits", () => {
  const players: PlayerState[] = [
    shooter,
    { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 100, alive: true }
  ];

  const result = new ShotSimulator().simulate({
    shooter,
    players,
    terrain: { blobs: [] },
    shot: NormalFunction.parse("0"),
    damagePerHit: 80
  });

  expect(result.damage).toEqual([{ playerId: "bob", amount: 80, hpAfter: 20 }]);
  expect(result.players.find((player) => player.id === "bob")).toMatchObject({ hp: 20, alive: true });
});

it("ignores living teammates when friendly fire is disabled", () => {
  const players: PlayerState[] = [
    shooter,
    { id: "ally", displayName: "Ally", teamId: "team-a", position: { x: 1, y: 0 }, hp: 100, alive: true },
    { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 100, alive: true }
  ];

  const result = new ShotSimulator().simulate({
    shooter,
    players,
    terrain: { blobs: [] },
    shot: NormalFunction.parse("0"),
    allowFriendlyFire: false
  });

  expect(result.impact.reason).toBe("player-hit");
  expect(result.impact.targetPlayerId).toBe("bob");
});

it("can damage teammates when friendly fire is enabled", () => {
  const players: PlayerState[] = [
    shooter,
    { id: "ally", displayName: "Ally", teamId: "team-a", position: { x: 1, y: 0 }, hp: 100, alive: true },
    { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 100, alive: true }
  ];

  const result = new ShotSimulator().simulate({
    shooter,
    players,
    terrain: { blobs: [] },
    shot: NormalFunction.parse("0"),
    allowFriendlyFire: true
  });

  expect(result.impact.targetPlayerId).toBe("ally");
  expect(result.damage).toEqual([{ playerId: "ally", amount: 35, hpAfter: 65 }]);
});
```

- [ ] **Step 2: Write failing controller tests**

Add to `apps/server/src/match/MatchController.test.ts`:

```ts
it("applies configured match damage to player hits", () => {
  const controller = new MatchController("room-1");
  controller.setLobbyPlayers("free-for-all", [
    { id: "alice-id", displayName: "Alice" },
    { id: "bob-id", displayName: "Bob" }
  ]);
  controller.startMatch(
    "free-for-all",
    {
      worldBounds: worldBoundsForMapSize("standard"),
      terrain: { blobs: [] },
      spawns: [
        { playerId: "alice-id", position: { x: 0, y: 0 } },
        { playerId: "bob-id", position: { x: 3, y: 0 } }
      ]
    },
    { damagePerHit: 100 }
  );

  const events = controller.submitShot("alice-id", "normal", "0");

  expect(events[0].type).toBe("shot-resolved");
  if (events[0].type === "shot-resolved") {
    expect(events[0].damage).toEqual([{ playerId: "bob-id", amount: 100, hpAfter: 0 }]);
  }
});

it("rejects duplicate successful function hits without consuming the turn", () => {
  const controller = new MatchController("room-1");
  controller.setLobbyPlayers("free-for-all", [
    { id: "alice-id", displayName: "Alice" },
    { id: "bob-id", displayName: "Bob" },
    { id: "charlie-id", displayName: "Charlie" }
  ]);
  controller.startMatch(
    "free-for-all",
    {
      worldBounds: worldBoundsForMapSize("standard"),
      terrain: { blobs: [] },
      spawns: [
        { playerId: "alice-id", position: { x: 0, y: 0 } },
        { playerId: "bob-id", position: { x: 3, y: 0 } },
        { playerId: "charlie-id", position: { x: -3, y: 0 } }
      ]
    },
    { uniqueFunctionHits: true }
  );

  const [first] = controller.submitShot("alice-id", "normal", "0");
  expect(first.type).toBe("shot-resolved");
  const snapshotAfterFirst = controller.getSnapshot();
  controller.submitShot("bob-id", "normal", "10");

  const [duplicate] = controller.submitShot("charlie-id", "normal", " 0 ", "east");

  expect(duplicate).toEqual({
    type: "shot-rejected",
    roomId: "room-1",
    playerId: "charlie-id",
    reason: "That function already hit this target. Try a different function."
  });
  expect(controller.getSnapshot().turn).toEqual(expect.objectContaining({ activePlayerId: "charlie-id" }));
  expect(controller.getSnapshot().players).toEqual(snapshotAfterFirst.players);
});
```

Add a companion test that starts a new controller or starts with `uniqueFunctionHits: false` and verifies the same normalized expression can damage the same target again.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- apps/server/src/simulation/ShotSimulator.test.ts apps/server/src/match/MatchController.test.ts
```

Expected: FAIL because simulator options and controller unique-hit memory are missing.

- [ ] **Step 4: Implement simulator options**

Update `ShotSimulationInput`:

```ts
damagePerHit?: number;
allowFriendlyFire?: boolean;
```

Resolve target players before collision:

```ts
private targetPlayersFor(input: ShotSimulationInput): PlayerState[] {
  return input.players.filter((candidate) => {
    if (candidate.id === input.shooter.id || !candidate.alive) return false;
    if (input.allowFriendlyFire !== false) return true;
    return !candidate.teamId || !input.shooter.teamId || candidate.teamId !== input.shooter.teamId;
  });
}
```

Call `findFirstPlayerHit(worldPath, [input.shooter, ...this.targetPlayersFor(input)], input.shooter.id)` or change `CollisionSystem.findFirstPlayerHit()` to accept a filtered candidate list. Use:

```ts
const damageAmount = normalizeDamagePerHit(input.damagePerHit);
```

for player-hit damage.

- [ ] **Step 5: Implement controller rules**

Add:

```ts
type MatchRules = {
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
};

const duplicateHitRejection = "That function already hit this target. Try a different function.";
```

Extend `MatchStartOptions` with `damagePerHit?: number`, `uniqueFunctionHits?: boolean`, `friendlyFire?: boolean`.

Store defaults on controller:

```ts
private matchRules: MatchRules = { ...defaultLobbyGameplaySettings };
private readonly successfulHitKeys = new Set<string>();
```

At start:

```ts
this.matchRules = {
  damagePerHit: normalizeDamagePerHit(options.damagePerHit),
  uniqueFunctionHits: options.uniqueFunctionHits ?? defaultLobbyGameplaySettings.uniqueFunctionHits,
  friendlyFire: options.friendlyFire ?? defaultLobbyGameplaySettings.friendlyFire
};
this.successfulHitKeys.clear();
```

After tentative simulation and before committing:

```ts
const duplicateHitKey = this.uniqueHitKey(playerId, functionFamilyId, expression, aimDirection, result);
if (duplicateHitKey && this.successfulHitKeys.has(duplicateHitKey)) {
  return [this.rejectShot(playerId, duplicateHitRejection)];
}
```

After committing a successful accepted hit:

```ts
if (duplicateHitKey) {
  this.successfulHitKeys.add(duplicateHitKey);
}
```

The key helper uses `normalizeFunctionHitExpression(expression)`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm test -- apps/server/src/simulation/ShotSimulator.test.ts apps/server/src/match/MatchController.test.ts
npm run check
```

Expected: simulator and controller tests pass.

- [ ] **Step 7: Commit and push**

Update `README.md`, then:

```bash
git add apps/server/src/simulation apps/server/src/match README.md
git commit -m "feat: enforce gameplay shot settings"
git push
```

---

### Task 4: Client Create-Lobby And Lobby Setup UI

**Files:**
- Modify: `apps/client/src/lobby/CreateLobbyView.tsx`
- Modify: `apps/client/src/lobby/CreateLobbyView.test.ts`
- Modify: `apps/client/src/lobby/LobbySetupView.tsx`
- Modify: `apps/client/src/lobby/LobbySetupView.test.tsx`
- Modify: `apps/client/src/app/useGameStore.ts`
- Modify: `apps/client/src/app/useGameStore.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing UI/store tests**

Add to `CreateLobbyView.test.ts`:

```ts
it("defaults and prepares phase 2 gameplay settings", () => {
  expect(createLobbyInitialForm("Alice")).toEqual(
    expect.objectContaining({ damagePerHit: 35, uniqueFunctionHits: true, friendlyFire: false })
  );

  expect(
    prepareCreateLobbyForm({
      name: "Arena",
      alias: "Alice",
      mode: "team-versus",
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      damagePerHit: 83,
      uniqueFunctionHits: false,
      friendlyFire: true
    }).form
  ).toEqual(expect.objectContaining({ damagePerHit: 83, uniqueFunctionHits: false, friendlyFire: true }));
});

it("renders compact gameplay setting controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(CreateLobbyView, {
      defaultAlias: "Alice",
      onBack: () => {},
      onCreate: async () => {}
    })
  );

  expect(html).toContain("Damage");
  expect(html).toContain('min="35"');
  expect(html).toContain('max="100"');
  expect(html).toContain("Unique function hits");
  expect(html).toContain("Friendly fire");
});
```

Add to `LobbySetupView.test.tsx`:

```ts
it("shows read-only gameplay rules before match start", () => {
  const html = renderToStaticMarkup(
    <LobbySetupView
      currentPlayerId="alice-id"
      lobby={{ ...lobby, damagePerHit: 80, uniqueFunctionHits: false, friendlyFire: true }}
      onAutoAssign={() => undefined}
      onBack={() => undefined}
      onMove={() => undefined}
      onStart={() => undefined}
    />
  );

  expect(html).toContain("Damage 80");
  expect(html).toContain("Unique hits Off");
  expect(html).toContain("Friendly fire On");
});
```

Add to `useGameStore.test.ts`:

```ts
it("passes phase 2 gameplay settings when creating lobbies", async () => {
  const lobbyApi = createMockLobbyApi();
  const store = createGameStore({ lobbyApi, session: mockSession });

  await store.getState().createLobby({
    name: "Rules Room",
    alias: "Alice",
    mode: "team-versus",
    initialSlot: "player",
    color: defaultPlayerColor,
    maxFunctionLength: 50,
    damagePerHit: 80,
    uniqueFunctionHits: false,
    friendlyFire: true
  });

  expect(lobbyApi.createLobby).toHaveBeenCalledWith(
    mockSession.guildId,
    expect.objectContaining({ damagePerHit: 80, uniqueFunctionHits: false, friendlyFire: true })
  );
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- apps/client/src/lobby/CreateLobbyView.test.ts apps/client/src/lobby/LobbySetupView.test.tsx apps/client/src/app/useGameStore.test.ts
```

Expected: FAIL because form types, controls, summary, and store payload do not carry the fields.

- [ ] **Step 3: Implement create-lobby controls and payload**

In `CreateLobbyView.tsx`, import settings defaults and add state:

```ts
const [damagePerHit, setDamagePerHit] = useState(initialForm.damagePerHit);
const [uniqueFunctionHits, setUniqueFunctionHits] = useState(initialForm.uniqueFunctionHits);
const [friendlyFire, setFriendlyFire] = useState(initialForm.friendlyFire);
```

Add compact labels:

```tsx
<label>
  Damage
  <input min={35} max={100} type="number" value={damagePerHit} onChange={(event) => setDamagePerHit(Number(event.currentTarget.value))} />
</label>
<label className="toggle-row">
  <input checked={uniqueFunctionHits} onChange={(event) => setUniqueFunctionHits(event.currentTarget.checked)} type="checkbox" />
  Unique function hits
</label>
{mode === "team-versus" ? (
  <label className="toggle-row">
    <input checked={friendlyFire} onChange={(event) => setFriendlyFire(event.currentTarget.checked)} type="checkbox" />
    Friendly fire
  </label>
) : null}
```

Keep `friendlyFire` in the submitted form even when free-for-all; the server accepts it with no gameplay effect.

In `LobbySetupView.tsx`, render a small summary:

```tsx
<dl className="rules-summary" aria-label="Match rules">
  <div><dt>Damage</dt><dd>{lobby.damagePerHit}</dd></div>
  <div><dt>Unique hits</dt><dd>{lobby.uniqueFunctionHits ? "On" : "Off"}</dd></div>
  <div><dt>Friendly fire</dt><dd>{lobby.friendlyFire ? "On" : "Off"}</dd></div>
</dl>
```

In `useGameStore.ts`, extend `createLobby()` form type and API payload with `damagePerHit`, `uniqueFunctionHits`, and `friendlyFire`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- apps/client/src/lobby/CreateLobbyView.test.ts apps/client/src/lobby/LobbySetupView.test.tsx apps/client/src/app/useGameStore.test.ts
npm run check
```

Expected: client tests pass and no layout type errors remain.

- [ ] **Step 5: Commit and push**

Update `README.md`, then:

```bash
git add apps/client/src README.md
git commit -m "feat: add gameplay settings lobby UI"
git push
```

---

### Task 5: Integration, E2E, And Final Verification

**Files:**
- Modify: `apps/server/src/rooms/RoomManager.integration.test.ts`
- Modify: `apps/client/e2e/local-lobby.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add integration coverage for authoritative settings**

Extend `RoomManager.integration.test.ts` with a match-start path that creates a lobby with `damagePerHit: 100`, starts the match, fires a known hit, and asserts the `shot-resolved` event reports `amount: 100` and `hpAfter: 0`.

- [ ] **Step 2: Add E2E smoke for duplicate successful hits**

In `apps/client/e2e/local-lobby.spec.ts`, add a test that:

```ts
await createLobby(pageOne, { damagePerHit: "35", uniqueFunctionHits: true });
await joinLobby(pageTwo, "Bob");
await startLobby(pageOne);
await fireFunction(pageOne, "0", "east");
await fireFunction(pageTwo, "10", "east");
await fireFunction(pageOne, " 0 ", "east");
await expect(pageOne.getByText("That function already hit this target. Try a different function.")).toBeVisible();
await expect(pageOne.getByText(/Turn 3/)).toBeVisible();
```

Use existing helper names if they differ; keep the assertion focused on the rejection notice and unchanged turn.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm run test:e2e
```

Expected: FAIL before client/server settings are fully wired or before duplicate rejection is exposed.

- [ ] **Step 4: Implement missing test helper wiring**

Extend local E2E helper types to set `damagePerHit`, toggle `uniqueFunctionHits`, and toggle `friendlyFire` in the create-lobby form. Do not add new UI panels outside the existing create-lobby form.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run check
npm run build:map-maker
npm run test:e2e
```

Expected: all unit, type, build, and E2E checks pass.

- [ ] **Step 6: Request final review**

Ask a code-review subagent to review the Phase 2 commit range against `docs/superpowers/specs/2026-07-06-gameplay-settings-phase-2-design.md` and this plan. Fix Critical/Important issues before pushing the final checkpoint.

- [ ] **Step 7: Commit and push**

Update `README.md`, then:

```bash
git add apps/server/src/rooms apps/client/e2e README.md
git commit -m "test: cover gameplay settings phase"
git push
```

---

## Self-Review

- Spec coverage: damage bounds/defaults, unique-hit tracking, duplicate rejection, friendly-fire filtering, lobby propagation, UI controls, and E2E smoke are covered by Tasks 1-5.
- Placeholder scan: no TBD/TODO placeholders remain; each task includes concrete file paths, tests, implementation steps, and commands.
- Type consistency: all tasks use `damagePerHit`, `uniqueFunctionHits`, and `friendlyFire` consistently across shared, server, and client boundaries.
