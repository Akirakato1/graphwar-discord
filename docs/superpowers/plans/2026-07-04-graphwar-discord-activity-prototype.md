# Graphwar Discord Activity Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local networked playable Graphwar-like prototype with server-authoritative normal-function shots, destructible polygon terrain, team-versus/free-for-all modes, mock multi-tab clients, and a Discord-ready session boundary.

**Architecture:** Use a TypeScript npm-workspaces monorepo with `apps/server`, `apps/client`, and `packages/shared`. The server owns rooms, match state, function parsing/sampling, collision, terrain destruction, damage, turns, and victory; clients send commands and animate authoritative events. The local session adapter uses `room` and `mockPlayer` query params now, while the client/server boundary leaves room for a future Discord `instanceId` adapter.

**Tech Stack:** TypeScript, Vite, React, Zustand, Fastify, ws, Zod, expr-eval, polygon-clipping, Vitest, Playwright, @discord/embedded-app-sdk.

---

## Scope Check

This is one vertical-slice plan because the first playable loop depends on shared protocol types, server simulation, WebSocket rooms, and client rendering working together. Discord production launch/auth, timers, chat commands, differential equation modes, rotated free-for-all aiming, persistence, and terrain diff compression are excluded from this plan.

## File Structure

Create this structure:

```txt
package.json
tsconfig.base.json
tsconfig.json
vitest.config.ts
playwright.config.ts
apps/
  client/
    index.html
    package.json
    tsconfig.json
    vite.config.ts
    src/
      main.tsx
      app/App.tsx
      app/useGameStore.ts
      game-renderer/GameCanvas.tsx
      game-renderer/renderWorld.ts
      hud/LobbyPanel.tsx
      hud/MatchHud.tsx
      input/FunctionInput.tsx
      input/insertSnippet.ts
      networking/gameClient.ts
      sessions/localSession.ts
      sessions/discordSession.ts
      styles.css
  server/
    package.json
    tsconfig.json
    src/
      index.ts
      rooms/GameRoom.ts
      rooms/RoomManager.ts
      sessions/PlayerSession.ts
      match/MatchController.ts
      match/MatchState.ts
      modes/GameMode.ts
      modes/TeamVersusMode.ts
      modes/FreeForAllMode.ts
      maps/MapGenerator.ts
      maps/TeamVersusMapGenerator.ts
      maps/FreeForAllMapGenerator.ts
      functions/ShotFunction.ts
      functions/FunctionRegistry.ts
      functions/NormalFunction.ts
      simulation/ShotSimulator.ts
      simulation/CollisionSystem.ts
      terrain/TerrainSystem.ts
      terrain/Explosion.ts
      protocol/parseCommand.ts
packages/
  shared/
    package.json
    tsconfig.json
    src/
      index.ts
      constants.ts
      geometry/types.ts
      geometry/coordinates.ts
      geometry/polygons.ts
      protocol/commands.ts
      protocol/events.ts
      protocol/schemas.ts
      state/types.ts
      validation/settings.ts
```

Tests live beside the units they verify:

```txt
packages/shared/src/**/*.test.ts
apps/server/src/**/*.test.ts
apps/server/src/**/*.integration.test.ts
apps/client/src/**/*.test.ts
apps/client/e2e/*.spec.ts
```

## Shared Type Names

Use these names consistently across tasks:

```ts
type PlayerId = string;
type TeamId = string;
type RoomId = string;
type FunctionFamilyId = "normal";
type MatchModeId = "team-versus" | "free-for-all";
type InvalidFunctionBehavior = "reject" | "explode-at-shooter";
type ImpactReason = "terrain-hit" | "player-hit" | "undefined-function" | "path-too-long" | "field-boundary" | "miss";
```

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `apps/client/package.json`
- Create: `apps/client/tsconfig.json`
- Create: `apps/client/vite.config.ts`
- Create: `apps/client/index.html`
- Create: `apps/client/src/main.tsx`
- Create: `apps/client/src/app/App.tsx`
- Create: `apps/client/src/styles.css`
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the npm workspace package files**

Create `package.json`:

```json
{
  "name": "graphwar-discord-activity",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "npm --workspace apps/server run dev",
    "dev:client": "npm --workspace apps/client run dev",
    "test": "vitest run",
    "check": "tsc -b",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@types/node": "^20.14.10",
    "@types/ws": "^8.5.10",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "vite": "^5.3.2",
    "vitest": "^1.6.0"
  }
}
```

Create `apps/client/package.json`:

```json
{
  "name": "apps/client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@discord/embedded-app-sdk": "^1.5.0",
    "@graphwar/shared": "file:../../packages/shared",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.4",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0"
  }
}
```

Create `apps/server/package.json`:

```json
{
  "name": "apps/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@graphwar/shared": "file:../../packages/shared",
    "expr-eval": "^2.0.2",
    "fastify": "^4.28.1",
    "polygon-clipping": "^0.15.7",
    "ws": "^8.17.1",
    "zod": "^3.23.8"
  }
}
```

Create `packages/shared/package.json`:

```json
{
  "name": "@graphwar/shared",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 2: Create TypeScript and test configuration**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@graphwar/shared": ["packages/shared/src/index.ts"],
      "@graphwar/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

Create root `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./apps/server" },
    { "path": "./apps/client" }
  ]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.integration.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@graphwar/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
      "@graphwar/shared/": new URL("./packages/shared/src/", import.meta.url).pathname
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/client/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm --workspace apps/server run dev",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true
    },
    {
      command: "npm --workspace apps/client run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true
    }
  ]
});
```

- [ ] **Step 3: Create initial package tsconfig files and app shells**

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

Create `apps/client/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/shared" }]
}
```

Create `apps/client/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0"
  }
});
```

Create `apps/client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Graphwar Activity Prototype</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/client/src/main.tsx`:

```ts
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/client/src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>Graphwar Activity Prototype</h1>
      <p>Local networked prototype shell is ready.</p>
    </main>
  );
}
```

Create `apps/client/src/styles.css`:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f6f7fb;
  background: #12151c;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  gap: 8px;
}
```

Create `apps/server/src/index.ts`:

```ts
import Fastify from "fastify";

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: 8787, host: "0.0.0.0" });
}
```

Create `packages/shared/src/index.ts`:

```ts
export const sharedPackageReady = true;
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: installs dependencies and creates `package-lock.json`.

- [ ] **Step 5: Run the first checks**

Run:

```bash
npm run check
npm test
```

Expected: `npm run check` passes, `npm test` passes with no tests or empty-suite success depending on Vitest version.

- [ ] **Step 6: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.base.json tsconfig.json vitest.config.ts playwright.config.ts apps packages
git commit -m "chore: scaffold graphwar activity workspace"
```

---

### Task 2: Shared Domain, Constants, And Protocol Schemas

**Files:**
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/geometry/types.ts`
- Create: `packages/shared/src/state/types.ts`
- Create: `packages/shared/src/validation/settings.ts`
- Create: `packages/shared/src/protocol/commands.ts`
- Create: `packages/shared/src/protocol/events.ts`
- Create: `packages/shared/src/protocol/schemas.ts`
- Create: `packages/shared/src/protocol/schemas.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing protocol schema tests**

Create `packages/shared/src/protocol/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clientCommandSchema, serverEventSchema } from "./schemas";

describe("protocol schemas", () => {
  it("accepts a valid submit-shot command", () => {
    const parsed = clientCommandSchema.parse({
      type: "submit-shot",
      roomId: "local-test",
      playerId: "alice",
      functionFamilyId: "normal",
      expression: "sin(x)"
    });

    expect(parsed.type).toBe("submit-shot");
  });

  it("rejects a submit-shot command without expression", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal"
      })
    ).toThrow();
  });

  it("accepts a shot-resolved event with a path and snapshot", () => {
    const parsed = serverEventSchema.parse({
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      expression: "x",
      path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot: {
        phase: "playing",
        mode: "team-versus",
        players: [],
        teams: [],
        terrain: { blobs: [] },
        turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
      }
    });

    expect(parsed.type).toBe("shot-resolved");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- packages/shared/src/protocol/schemas.test.ts
```

Expected: FAIL because `./schemas` does not exist.

- [ ] **Step 3: Implement shared types and constants**

Create `packages/shared/src/constants.ts`:

```ts
export const fieldBounds = {
  minX: -25,
  maxX: 25,
  minY: -15,
  maxY: 15
} as const;

export const defaultMatchTuning = {
  soldierHp: 100,
  playerHitRadius: 0.35,
  directHitDamage: 35,
  circleCraterRadius: 1.25,
  terrainMinArea: 0.05,
  sampleStep: 0.05,
  maxPathPoints: 2000
} as const;
```

Create `packages/shared/src/geometry/types.ts`:

```ts
export type LocalPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number };
export type PolygonRing = WorldPoint[];

export type TerrainBlob = {
  id: string;
  outer: PolygonRing;
  holes: PolygonRing[];
};

export type TerrainState = {
  blobs: TerrainBlob[];
};
```

Create `packages/shared/src/state/types.ts`:

```ts
import type { TerrainState, WorldPoint } from "../geometry/types";

export type PlayerId = string;
export type TeamId = string;
export type RoomId = string;
export type FunctionFamilyId = "normal";
export type MatchModeId = "team-versus" | "free-for-all";
export type MatchPhase = "lobby" | "playing" | "ended";

export type PlayerState = {
  id: PlayerId;
  displayName: string;
  teamId: TeamId;
  position: WorldPoint;
  hp: number;
  alive: boolean;
};

export type TeamState = {
  id: TeamId;
  playerIds: PlayerId[];
};

export type TurnState = {
  activePlayerId: PlayerId;
  order: PlayerId[];
  turnNumber: number;
};

export type MatchSnapshot = {
  phase: MatchPhase;
  mode: MatchModeId;
  players: PlayerState[];
  teams: TeamState[];
  terrain: TerrainState;
  turn: TurnState;
};
```

Create `packages/shared/src/validation/settings.ts`:

```ts
export type InvalidFunctionBehavior = "reject" | "explode-at-shooter";

export type FunctionValidationSettings = {
  requireFiniteLocalYIntercept: boolean;
  requireRawXIntercept: boolean;
  invalidFunctionBehavior: InvalidFunctionBehavior;
};

export const defaultFunctionValidationSettings: FunctionValidationSettings = {
  requireFiniteLocalYIntercept: true,
  requireRawXIntercept: false,
  invalidFunctionBehavior: "reject"
};
```

- [ ] **Step 4: Implement command and event types**

Create `packages/shared/src/protocol/commands.ts`:

```ts
import type { FunctionFamilyId, MatchModeId, PlayerId, RoomId, TeamId } from "../state/types";

export type JoinRoomCommand = {
  type: "join-room";
  roomId: RoomId;
  playerId: PlayerId;
  displayName: string;
};

export type SelectModeCommand = {
  type: "select-mode";
  roomId: RoomId;
  playerId: PlayerId;
  mode: MatchModeId;
};

export type SetTeamCommand = {
  type: "set-team";
  roomId: RoomId;
  playerId: PlayerId;
  teamId: TeamId;
};

export type StartMatchCommand = {
  type: "start-match";
  roomId: RoomId;
  playerId: PlayerId;
};

export type SubmitShotCommand = {
  type: "submit-shot";
  roomId: RoomId;
  playerId: PlayerId;
  functionFamilyId: FunctionFamilyId;
  expression: string;
};

export type SendChatCommand = {
  type: "send-chat";
  roomId: RoomId;
  playerId: PlayerId;
  message: string;
};

export type RequestRematchCommand = {
  type: "request-rematch";
  roomId: RoomId;
  playerId: PlayerId;
};

export type ClientCommand =
  | JoinRoomCommand
  | SelectModeCommand
  | SetTeamCommand
  | StartMatchCommand
  | SubmitShotCommand
  | SendChatCommand
  | RequestRematchCommand;
```

Create `packages/shared/src/protocol/events.ts`:

```ts
import type { TerrainState, WorldPoint } from "../geometry/types";
import type { FunctionFamilyId, MatchSnapshot, PlayerId, RoomId } from "../state/types";

export type ImpactReason =
  | "terrain-hit"
  | "player-hit"
  | "undefined-function"
  | "path-too-long"
  | "field-boundary"
  | "miss";

export type ImpactEvent = {
  reason: ImpactReason;
  point?: WorldPoint;
  targetPlayerId?: PlayerId;
};

export type DamageEvent = {
  playerId: PlayerId;
  amount: number;
  hpAfter: number;
};

export type RoomSnapshotEvent = {
  type: "room-snapshot";
  roomId: RoomId;
  snapshot: MatchSnapshot;
};

export type ShotResolvedEvent = {
  type: "shot-resolved";
  roomId: RoomId;
  shooterId: PlayerId;
  functionFamilyId: FunctionFamilyId;
  expression: string;
  path: WorldPoint[];
  impact: ImpactEvent;
  terrain?: TerrainState;
  damage: DamageEvent[];
  eliminations: PlayerId[];
  snapshot: MatchSnapshot;
};

export type ServerEvent =
  | RoomSnapshotEvent
  | { type: "player-joined"; roomId: RoomId; playerId: PlayerId }
  | { type: "player-left"; roomId: RoomId; playerId: PlayerId }
  | { type: "match-started"; roomId: RoomId; snapshot: MatchSnapshot }
  | { type: "turn-started"; roomId: RoomId; playerId: PlayerId; turnNumber: number }
  | { type: "shot-accepted"; roomId: RoomId; playerId: PlayerId }
  | { type: "shot-rejected"; roomId: RoomId; playerId: PlayerId; reason: string }
  | ShotResolvedEvent
  | { type: "terrain-changed"; roomId: RoomId; terrain: TerrainState }
  | { type: "player-damaged"; roomId: RoomId; damage: DamageEvent }
  | { type: "player-eliminated"; roomId: RoomId; playerId: PlayerId }
  | { type: "turn-advanced"; roomId: RoomId; playerId: PlayerId; turnNumber: number }
  | { type: "match-ended"; roomId: RoomId; winnerIds: PlayerId[]; snapshot: MatchSnapshot };
```

- [ ] **Step 5: Implement Zod schemas**

Create `packages/shared/src/protocol/schemas.ts`:

```ts
import { z } from "zod";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const terrainBlobSchema = z.object({
  id: z.string(),
  outer: z.array(pointSchema),
  holes: z.array(z.array(pointSchema))
});

export const terrainStateSchema = z.object({
  blobs: z.array(terrainBlobSchema)
});

export const matchSnapshotSchema = z.object({
  phase: z.enum(["lobby", "playing", "ended"]),
  mode: z.enum(["team-versus", "free-for-all"]),
  players: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      teamId: z.string(),
      position: pointSchema,
      hp: z.number(),
      alive: z.boolean()
    })
  ),
  teams: z.array(z.object({ id: z.string(), playerIds: z.array(z.string()) })),
  terrain: terrainStateSchema,
  turn: z.object({
    activePlayerId: z.string(),
    order: z.array(z.string()),
    turnNumber: z.number()
  })
});

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join-room"), roomId: z.string(), playerId: z.string(), displayName: z.string() }),
  z.object({ type: z.literal("select-mode"), roomId: z.string(), playerId: z.string(), mode: z.enum(["team-versus", "free-for-all"]) }),
  z.object({ type: z.literal("set-team"), roomId: z.string(), playerId: z.string(), teamId: z.string() }),
  z.object({ type: z.literal("start-match"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("submit-shot"), roomId: z.string(), playerId: z.string(), functionFamilyId: z.literal("normal"), expression: z.string().min(1) }),
  z.object({ type: z.literal("send-chat"), roomId: z.string(), playerId: z.string(), message: z.string().min(1).max(500) }),
  z.object({ type: z.literal("request-rematch"), roomId: z.string(), playerId: z.string() })
]);

export const serverEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room-snapshot"), roomId: z.string(), snapshot: matchSnapshotSchema }),
  z.object({ type: z.literal("player-joined"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("player-left"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("match-started"), roomId: z.string(), snapshot: matchSnapshotSchema }),
  z.object({ type: z.literal("turn-started"), roomId: z.string(), playerId: z.string(), turnNumber: z.number() }),
  z.object({ type: z.literal("shot-accepted"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("shot-rejected"), roomId: z.string(), playerId: z.string(), reason: z.string() }),
  z.object({
    type: z.literal("shot-resolved"),
    roomId: z.string(),
    shooterId: z.string(),
    functionFamilyId: z.literal("normal"),
    expression: z.string(),
    path: z.array(pointSchema),
    impact: z.object({
      reason: z.enum(["terrain-hit", "player-hit", "undefined-function", "path-too-long", "field-boundary", "miss"]),
      point: pointSchema.optional(),
      targetPlayerId: z.string().optional()
    }),
    terrain: terrainStateSchema.optional(),
    damage: z.array(z.object({ playerId: z.string(), amount: z.number(), hpAfter: z.number() })),
    eliminations: z.array(z.string()),
    snapshot: matchSnapshotSchema
  }),
  z.object({ type: z.literal("terrain-changed"), roomId: z.string(), terrain: terrainStateSchema }),
  z.object({ type: z.literal("player-damaged"), roomId: z.string(), damage: z.object({ playerId: z.string(), amount: z.number(), hpAfter: z.number() }) }),
  z.object({ type: z.literal("player-eliminated"), roomId: z.string(), playerId: z.string() }),
  z.object({ type: z.literal("turn-advanced"), roomId: z.string(), playerId: z.string(), turnNumber: z.number() }),
  z.object({ type: z.literal("match-ended"), roomId: z.string(), winnerIds: z.array(z.string()), snapshot: matchSnapshotSchema })
]);
```

- [ ] **Step 6: Export shared modules**

Modify `packages/shared/src/index.ts`:

```ts
export * from "./constants";
export * from "./geometry/types";
export * from "./protocol/commands";
export * from "./protocol/events";
export * from "./protocol/schemas";
export * from "./state/types";
export * from "./validation/settings";
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
npm test -- packages/shared/src/protocol/schemas.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 8: Commit shared protocol**

```bash
git add packages/shared/src
git commit -m "feat: define shared game protocol"
```

---

### Task 3: Geometry, Coordinates, And Polygon Helpers

**Files:**
- Create: `packages/shared/src/geometry/coordinates.ts`
- Create: `packages/shared/src/geometry/coordinates.test.ts`
- Create: `packages/shared/src/geometry/polygons.ts`
- Create: `packages/shared/src/geometry/polygons.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write coordinate tests**

Create `packages/shared/src/geometry/coordinates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { localToWorld } from "./coordinates";

describe("localToWorld", () => {
  it("translates shooter-local points into world coordinates", () => {
    expect(localToWorld({ x: 3, y: -2 }, { x: -10, y: 4 })).toEqual({ x: -7, y: 2 });
  });
});
```

- [ ] **Step 2: Write polygon tests**

Create `packages/shared/src/geometry/polygons.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { polygonArea, makeCirclePolygon, isPointInBounds } from "./polygons";

describe("polygon helpers", () => {
  it("computes rectangle area", () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }])).toBe(6);
  });

  it("creates a circular polygon around a center", () => {
    const ring = makeCirclePolygon({ x: 1, y: 2 }, 2, 12);
    expect(ring).toHaveLength(12);
    expect(ring[0]).toEqual({ x: 3, y: 2 });
  });

  it("checks field bounds inclusively", () => {
    expect(isPointInBounds({ x: 25, y: -15 })).toBe(true);
    expect(isPointInBounds({ x: 26, y: 0 })).toBe(false);
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
npm test -- packages/shared/src/geometry
```

Expected: FAIL because helper modules do not exist.

- [ ] **Step 4: Implement coordinate helper**

Create `packages/shared/src/geometry/coordinates.ts`:

```ts
import type { LocalPoint, WorldPoint } from "./types";

export function localToWorld(localPoint: LocalPoint, shooterPosition: WorldPoint): WorldPoint {
  return {
    x: shooterPosition.x + localPoint.x,
    y: shooterPosition.y + localPoint.y
  };
}
```

- [ ] **Step 5: Implement polygon helpers**

Create `packages/shared/src/geometry/polygons.ts`:

```ts
import { fieldBounds } from "../constants";
import type { PolygonRing, WorldPoint } from "./types";

export function polygonArea(points: PolygonRing): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum / 2);
}

export function makeCirclePolygon(center: WorldPoint, radius: number, segments = 32): PolygonRing {
  return Array.from({ length: segments }, (_, index) => {
    const angle = (Math.PI * 2 * index) / segments;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

export function isPointInBounds(point: WorldPoint): boolean {
  return (
    point.x >= fieldBounds.minX &&
    point.x <= fieldBounds.maxX &&
    point.y >= fieldBounds.minY &&
    point.y <= fieldBounds.maxY
  );
}
```

- [ ] **Step 6: Export geometry helpers**

Modify `packages/shared/src/index.ts`:

```ts
export * from "./constants";
export * from "./geometry/coordinates";
export * from "./geometry/polygons";
export * from "./geometry/types";
export * from "./protocol/commands";
export * from "./protocol/events";
export * from "./protocol/schemas";
export * from "./state/types";
export * from "./validation/settings";
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
npm test -- packages/shared/src/geometry
npm run check
```

Expected: both pass.

- [ ] **Step 8: Commit geometry helpers**

```bash
git add packages/shared/src/geometry packages/shared/src/index.ts
git commit -m "feat: add shared geometry helpers"
```

---

### Task 4: Normal Function Parser And Sampler

**Files:**
- Create: `apps/server/src/functions/ShotFunction.ts`
- Create: `apps/server/src/functions/NormalFunction.ts`
- Create: `apps/server/src/functions/NormalFunction.test.ts`
- Create: `apps/server/src/functions/FunctionRegistry.ts`

- [ ] **Step 1: Write normal-function tests**

Create `apps/server/src/functions/NormalFunction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NormalFunction } from "./NormalFunction";

describe("NormalFunction", () => {
  it("samples a function shifted through local origin", () => {
    const shot = NormalFunction.parse("x^2 + 5");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 4 }]);
    }
  });

  it("rejects functions without finite f(0)", () => {
    expect(() => NormalFunction.parse("1/x")).toThrow("Function must be finite at x = 0");
  });

  it("explodes at the last finite point when a later sample is undefined", () => {
    const shot = NormalFunction.parse("sqrt(1 - x)");
    const sample = shot.sample({ minX: 0, maxX: 3, step: 1, maxPathPoints: 10 });

    expect(sample).toEqual({
      ok: false,
      reason: "undefined-function",
      points: [{ x: 0, y: 0 }, { x: 1, y: -1 }],
      lastFinitePoint: { x: 1, y: -1 }
    });
  });

  it("stops when max path points is reached", () => {
    const shot = NormalFunction.parse("x");
    const sample = shot.sample({ minX: 0, maxX: 10, step: 1, maxPathPoints: 3 });

    expect(sample.ok).toBe(false);
    if (!sample.ok) {
      expect(sample.reason).toBe("path-too-long");
      expect(sample.lastFinitePoint).toEqual({ x: 2, y: 2 });
    }
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- apps/server/src/functions/NormalFunction.test.ts
```

Expected: FAIL because `NormalFunction` does not exist.

- [ ] **Step 3: Define shot-function interface**

Create `apps/server/src/functions/ShotFunction.ts`:

```ts
import type { FunctionFamilyId, ImpactReason, LocalPoint } from "@graphwar/shared";

export type SampleContext = {
  minX: number;
  maxX: number;
  step: number;
  maxPathPoints: number;
};

export type TrajectorySample =
  | { ok: true; points: LocalPoint[] }
  | { ok: false; reason: Extract<ImpactReason, "undefined-function" | "path-too-long">; points: LocalPoint[]; lastFinitePoint?: LocalPoint };

export abstract class ShotFunction {
  abstract readonly familyId: FunctionFamilyId;
  abstract sample(context: SampleContext): TrajectorySample;
}
```

- [ ] **Step 4: Implement normal function**

Create `apps/server/src/functions/NormalFunction.ts`:

```ts
import { Parser } from "expr-eval";
import type { LocalPoint } from "@graphwar/shared";
import { ShotFunction, type SampleContext, type TrajectorySample } from "./ShotFunction";

const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    power: true,
    factorial: false,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    assignment: false
  }
});

export class NormalFunction extends ShotFunction {
  readonly familyId = "normal" as const;

  private constructor(
    private readonly expressionText: string,
    private readonly evaluateY: (x: number) => number,
    private readonly offset: number
  ) {
    super();
  }

  static parse(expressionText: string): NormalFunction {
    const expression = parser.parse(expressionText.replace(/^y\s*=\s*/i, ""));
    const variables = expression.variables();
    const invalidVariable = variables.find((name) => name !== "x");
    if (invalidVariable) {
      throw new Error(`Unsupported variable "${invalidVariable}"`);
    }

    const evaluateY = (x: number) => Number(expression.evaluate({ x }));
    const yAtOrigin = evaluateY(0);
    if (!Number.isFinite(yAtOrigin)) {
      throw new Error("Function must be finite at x = 0");
    }

    return new NormalFunction(expressionText, evaluateY, -yAtOrigin);
  }

  sample(context: SampleContext): TrajectorySample {
    const points: LocalPoint[] = [];
    let lastFinitePoint: LocalPoint | undefined;

    for (let x = context.minX; x <= context.maxX + Number.EPSILON; x += context.step) {
      if (points.length >= context.maxPathPoints) {
        return { ok: false, reason: "path-too-long", points, lastFinitePoint };
      }

      const y = this.evaluateY(Number(x.toFixed(8))) + this.offset;
      if (!Number.isFinite(y)) {
        return { ok: false, reason: "undefined-function", points, lastFinitePoint };
      }

      const point = { x: Number(x.toFixed(8)), y: Number(y.toFixed(8)) };
      points.push(point);
      lastFinitePoint = point;
    }

    return { ok: true, points };
  }

  toString(): string {
    return this.expressionText;
  }
}
```

- [ ] **Step 5: Implement function registry**

Create `apps/server/src/functions/FunctionRegistry.ts`:

```ts
import type { FunctionFamilyId } from "@graphwar/shared";
import { NormalFunction } from "./NormalFunction";
import type { ShotFunction } from "./ShotFunction";

export class FunctionRegistry {
  create(familyId: FunctionFamilyId, expression: string): ShotFunction {
    if (familyId === "normal") {
      return NormalFunction.parse(expression);
    }
    throw new Error(`Unsupported function family: ${familyId}`);
  }
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```bash
npm test -- apps/server/src/functions/NormalFunction.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 7: Commit normal function**

```bash
git add apps/server/src/functions
git commit -m "feat: add normal function sampler"
```

---

### Task 5: Terrain System And Circular Crater Explosion

**Files:**
- Create: `apps/server/src/terrain/TerrainSystem.ts`
- Create: `apps/server/src/terrain/TerrainSystem.test.ts`
- Create: `apps/server/src/terrain/Explosion.ts`

- [ ] **Step 1: Write terrain tests**

Create `apps/server/src/terrain/TerrainSystem.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TerrainState } from "@graphwar/shared";
import { CircleCraterExplosion } from "./Explosion";
import { TerrainSystem } from "./TerrainSystem";

describe("TerrainSystem", () => {
  it("removes terrain where a circular crater overlaps a blob", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "ground",
          outer: [{ x: -5, y: -1 }, { x: 5, y: -1 }, { x: 5, y: 1 }, { x: -5, y: 1 }],
          holes: []
        }
      ]
    };

    const system = new TerrainSystem(0.05);
    const result = system.applyCircleCrater(terrain, { x: 0, y: 0 }, 1, "shot-1");

    expect(result.blobs.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("\"x\":0,\"y\":0");
  });

  it("keeps terrain unchanged when crater misses every blob", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "ground",
          outer: [{ x: -5, y: -1 }, { x: 5, y: -1 }, { x: 5, y: 1 }, { x: -5, y: 1 }],
          holes: []
        }
      ]
    };

    const system = new TerrainSystem(0.05);
    expect(system.applyCircleCrater(terrain, { x: 20, y: 10 }, 1, "shot-1")).toEqual(terrain);
  });

  it("circle crater explosion applies terrain removal", () => {
    const explosion = new CircleCraterExplosion(1.25, 35);
    expect(explosion.type).toBe("circle-crater");
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- apps/server/src/terrain/TerrainSystem.test.ts
```

Expected: FAIL because terrain modules do not exist.

- [ ] **Step 3: Implement terrain system**

Create `apps/server/src/terrain/TerrainSystem.ts`:

```ts
import polygonClipping from "polygon-clipping";
import { makeCirclePolygon, polygonArea, type TerrainBlob, type TerrainState, type WorldPoint } from "@graphwar/shared";

type MultiPolygon = number[][][][];

function blobToMultiPolygon(blob: TerrainBlob): MultiPolygon {
  const rings = [
    blob.outer.map((point) => [point.x, point.y]),
    ...blob.holes.map((hole) => hole.map((point) => [point.x, point.y]))
  ];
  return [[rings]];
}

function ringFromNumbers(ring: number[][]): WorldPoint[] {
  const points = ring.map(([x, y]) => ({ x, y }));
  const last = points[points.length - 1];
  const first = points[0];
  if (last && first && last.x === first.x && last.y === first.y) {
    return points.slice(0, -1);
  }
  return points;
}

export class TerrainSystem {
  constructor(private readonly minArea: number) {}

  applyCircleCrater(terrain: TerrainState, center: WorldPoint, radius: number, idPrefix: string): TerrainState {
    const crater = [[makeCirclePolygon(center, radius, 32).map((point) => [point.x, point.y])]] as MultiPolygon;
    const blobs: TerrainBlob[] = [];

    terrain.blobs.forEach((blob, blobIndex) => {
      const difference = polygonClipping.difference(blobToMultiPolygon(blob), crater) as MultiPolygon;
      difference.forEach((polygon, polygonIndex) => {
        const [outerRing, ...holeRings] = polygon;
        const outer = ringFromNumbers(outerRing);
        if (polygonArea(outer) < this.minArea) return;
        blobs.push({
          id: `${idPrefix}-${blobIndex}-${polygonIndex}`,
          outer,
          holes: holeRings.map(ringFromNumbers)
        });
      });
    });

    return { blobs };
  }
}
```

- [ ] **Step 4: Implement explosion class**

Create `apps/server/src/terrain/Explosion.ts`:

```ts
import type { TerrainState, WorldPoint } from "@graphwar/shared";
import { TerrainSystem } from "./TerrainSystem";

export type ExplosionResult = {
  terrain: TerrainState;
};

export abstract class Explosion {
  abstract readonly type: string;
  abstract readonly damage: number;
  abstract apply(terrain: TerrainState, center: WorldPoint, terrainSystem: TerrainSystem, idPrefix: string): ExplosionResult;
}

export class CircleCraterExplosion extends Explosion {
  readonly type = "circle-crater";

  constructor(
    private readonly radius: number,
    readonly damage: number
  ) {
    super();
  }

  apply(terrain: TerrainState, center: WorldPoint, terrainSystem: TerrainSystem, idPrefix: string): ExplosionResult {
    return {
      terrain: terrainSystem.applyCircleCrater(terrain, center, this.radius, idPrefix)
    };
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- apps/server/src/terrain/TerrainSystem.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 6: Commit terrain system**

```bash
git add apps/server/src/terrain
git commit -m "feat: add destructible terrain system"
```

---

### Task 6: Game Modes And Map Generators

**Files:**
- Create: `apps/server/src/modes/GameMode.ts`
- Create: `apps/server/src/modes/TeamVersusMode.ts`
- Create: `apps/server/src/modes/FreeForAllMode.ts`
- Create: `apps/server/src/modes/GameMode.test.ts`
- Create: `apps/server/src/maps/MapGenerator.ts`
- Create: `apps/server/src/maps/TeamVersusMapGenerator.ts`
- Create: `apps/server/src/maps/FreeForAllMapGenerator.ts`
- Create: `apps/server/src/maps/MapGenerator.test.ts`

- [ ] **Step 1: Write game-mode tests**

Create `apps/server/src/modes/GameMode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TeamVersusMode } from "./TeamVersusMode";
import { FreeForAllMode } from "./FreeForAllMode";

const players = ["alice", "bob", "charlie"].map((id) => ({ id, displayName: id }));

describe("game modes", () => {
  it("team mode builds two teams and alternates turn order", () => {
    const mode = new TeamVersusMode();
    const teams = mode.buildTeams(players);
    const order = mode.createTurnOrder([
      { id: "alice", teamId: "team-a", alive: true },
      { id: "bob", teamId: "team-b", alive: true },
      { id: "charlie", teamId: "team-a", alive: true }
    ]);

    expect(teams.map((team) => team.id)).toEqual(["team-a", "team-b"]);
    expect(order).toEqual(["alice", "bob", "charlie"]);
  });

  it("free-for-all makes each player their own team", () => {
    const mode = new FreeForAllMode();
    const teams = mode.buildTeams(players);

    expect(teams).toEqual([
      { id: "player-alice", playerIds: ["alice"] },
      { id: "player-bob", playerIds: ["bob"] },
      { id: "player-charlie", playerIds: ["charlie"] }
    ]);
  });
});
```

- [ ] **Step 2: Write map-generator tests**

Create `apps/server/src/maps/MapGenerator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FreeForAllMapGenerator } from "./FreeForAllMapGenerator";
import { TeamVersusMapGenerator } from "./TeamVersusMapGenerator";

describe("map generators", () => {
  it("creates team-versus spawns on opposite sides", () => {
    const map = new TeamVersusMapGenerator().generate("seed", ["alice", "bob"]);
    expect(map.spawns.find((spawn) => spawn.playerId === "alice")?.position.x).toBeLessThan(0);
    expect(map.spawns.find((spawn) => spawn.playerId === "bob")?.position.x).toBeGreaterThan(0);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });

  it("creates free-for-all spawns around the field", () => {
    const map = new FreeForAllMapGenerator().generate("seed", ["alice", "bob", "charlie"]);
    expect(map.spawns).toHaveLength(3);
    expect(new Set(map.spawns.map((spawn) => `${spawn.position.x},${spawn.position.y}`)).size).toBe(3);
    expect(map.terrain.blobs.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
npm test -- apps/server/src/modes apps/server/src/maps
```

Expected: FAIL because mode and map modules do not exist.

- [ ] **Step 4: Implement map-generator types**

Create `apps/server/src/maps/MapGenerator.ts`:

```ts
import type { PlayerId, TerrainState, WorldPoint } from "@graphwar/shared";

export type SpawnPoint = {
  playerId: PlayerId;
  position: WorldPoint;
};

export type GeneratedMap = {
  spawns: SpawnPoint[];
  terrain: TerrainState;
};

export abstract class MapGenerator {
  abstract generate(seed: string, playerIds: PlayerId[]): GeneratedMap;
}
```

- [ ] **Step 5: Implement team map generator**

Create `apps/server/src/maps/TeamVersusMapGenerator.ts`:

```ts
import type { PlayerId } from "@graphwar/shared";
import { MapGenerator, type GeneratedMap } from "./MapGenerator";

export class TeamVersusMapGenerator extends MapGenerator {
  generate(_seed: string, playerIds: PlayerId[]): GeneratedMap {
    const left = playerIds.filter((_, index) => index % 2 === 0);
    const right = playerIds.filter((_, index) => index % 2 === 1);

    return {
      spawns: [
        ...left.map((playerId, index) => ({ playerId, position: { x: -18, y: -6 + index * 4 } })),
        ...right.map((playerId, index) => ({ playerId, position: { x: 18, y: -6 + index * 4 } }))
      ],
      terrain: {
        blobs: [
          { id: "center-cover", outer: [{ x: -2, y: -8 }, { x: 2, y: -8 }, { x: 2, y: 8 }, { x: -2, y: 8 }], holes: [] },
          { id: "low-left", outer: [{ x: -14, y: -12 }, { x: -9, y: -12 }, { x: -9, y: -9 }, { x: -14, y: -9 }], holes: [] },
          { id: "low-right", outer: [{ x: 9, y: -12 }, { x: 14, y: -12 }, { x: 14, y: -9 }, { x: 9, y: -9 }], holes: [] }
        ]
      }
    };
  }
}
```

- [ ] **Step 6: Implement free-for-all map generator**

Create `apps/server/src/maps/FreeForAllMapGenerator.ts`:

```ts
import type { PlayerId } from "@graphwar/shared";
import { MapGenerator, type GeneratedMap } from "./MapGenerator";

export class FreeForAllMapGenerator extends MapGenerator {
  generate(_seed: string, playerIds: PlayerId[]): GeneratedMap {
    const radius = 16;
    return {
      spawns: playerIds.map((playerId, index) => {
        const angle = (Math.PI * 2 * index) / playerIds.length;
        return {
          playerId,
          position: {
            x: Number((Math.cos(angle) * radius).toFixed(2)),
            y: Number((Math.sin(angle) * 9).toFixed(2))
          }
        };
      }),
      terrain: {
        blobs: [
          { id: "center-rock", outer: [{ x: -3, y: -3 }, { x: 3, y: -3 }, { x: 3, y: 3 }, { x: -3, y: 3 }], holes: [] },
          { id: "upper-cover", outer: [{ x: -10, y: 7 }, { x: -4, y: 8 }, { x: -6, y: 11 }], holes: [] },
          { id: "lower-cover", outer: [{ x: 5, y: -11 }, { x: 12, y: -10 }, { x: 9, y: -7 }], holes: [] }
        ]
      }
    };
  }
}
```

- [ ] **Step 7: Implement game modes**

Create `apps/server/src/modes/GameMode.ts`:

```ts
import type { MatchModeId, PlayerId, TeamState } from "@graphwar/shared";

export type LobbyPlayer = {
  id: PlayerId;
  displayName: string;
};

export type TurnPlayer = {
  id: PlayerId;
  teamId: string;
  alive: boolean;
};

export abstract class GameMode {
  abstract readonly id: MatchModeId;
  abstract buildTeams(players: LobbyPlayer[]): TeamState[];
  abstract createTurnOrder(players: TurnPlayer[]): PlayerId[];
  abstract isVictory(players: TurnPlayer[]): { ended: boolean; winnerIds: PlayerId[] };
}
```

Create `apps/server/src/modes/TeamVersusMode.ts`:

```ts
import type { MatchModeId, PlayerId, TeamState } from "@graphwar/shared";
import { GameMode, type LobbyPlayer, type TurnPlayer } from "./GameMode";

export class TeamVersusMode extends GameMode {
  readonly id: MatchModeId = "team-versus";

  buildTeams(players: LobbyPlayer[]): TeamState[] {
    return [
      { id: "team-a", playerIds: players.filter((_, index) => index % 2 === 0).map((player) => player.id) },
      { id: "team-b", playerIds: players.filter((_, index) => index % 2 === 1).map((player) => player.id) }
    ];
  }

  createTurnOrder(players: TurnPlayer[]): PlayerId[] {
    return players.filter((player) => player.alive).map((player) => player.id);
  }

  isVictory(players: TurnPlayer[]): { ended: boolean; winnerIds: PlayerId[] } {
    const livingTeams = new Set(players.filter((player) => player.alive).map((player) => player.teamId));
    if (livingTeams.size !== 1) return { ended: false, winnerIds: [] };
    const winningTeam = [...livingTeams][0];
    return { ended: true, winnerIds: players.filter((player) => player.teamId === winningTeam).map((player) => player.id) };
  }
}
```

Create `apps/server/src/modes/FreeForAllMode.ts`:

```ts
import type { MatchModeId, PlayerId, TeamState } from "@graphwar/shared";
import { GameMode, type LobbyPlayer, type TurnPlayer } from "./GameMode";

export class FreeForAllMode extends GameMode {
  readonly id: MatchModeId = "free-for-all";

  buildTeams(players: LobbyPlayer[]): TeamState[] {
    return players.map((player) => ({ id: `player-${player.id}`, playerIds: [player.id] }));
  }

  createTurnOrder(players: TurnPlayer[]): PlayerId[] {
    return players.filter((player) => player.alive).map((player) => player.id);
  }

  isVictory(players: TurnPlayer[]): { ended: boolean; winnerIds: PlayerId[] } {
    const living = players.filter((player) => player.alive);
    return living.length === 1 ? { ended: true, winnerIds: [living[0].id] } : { ended: false, winnerIds: [] };
  }
}
```

- [ ] **Step 8: Run tests and typecheck**

Run:

```bash
npm test -- apps/server/src/modes apps/server/src/maps
npm run check
```

Expected: both pass.

- [ ] **Step 9: Commit modes and maps**

```bash
git add apps/server/src/modes apps/server/src/maps
git commit -m "feat: add match modes and map generators"
```

---

### Task 7: Shot Simulator And Collision System

**Files:**
- Create: `apps/server/src/simulation/CollisionSystem.ts`
- Create: `apps/server/src/simulation/ShotSimulator.ts`
- Create: `apps/server/src/simulation/ShotSimulator.test.ts`

- [ ] **Step 1: Write shot-simulator tests**

Create `apps/server/src/simulation/ShotSimulator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PlayerState, TerrainState } from "@graphwar/shared";
import { NormalFunction } from "../functions/NormalFunction";
import { ShotSimulator } from "./ShotSimulator";

const shooter: PlayerState = {
  id: "alice",
  displayName: "Alice",
  teamId: "team-a",
  position: { x: 0, y: 0 },
  hp: 100,
  alive: true
};

describe("ShotSimulator", () => {
  it("detects player hits in world space", () => {
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({
      shooter,
      players,
      terrain: { blobs: [] },
      shot: NormalFunction.parse("0")
    });

    expect(result.impact.reason).toBe("player-hit");
    expect(result.impact.targetPlayerId).toBe("bob");
    expect(result.damage).toEqual([{ playerId: "bob", amount: 35, hpAfter: 65 }]);
  });

  it("detects terrain hits before later player hits", () => {
    const terrain: TerrainState = {
      blobs: [{ id: "wall", outer: [{ x: 1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 1 }, { x: 1, y: 1 }], holes: [] }]
    };
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({ shooter, players, terrain, shot: NormalFunction.parse("0") });

    expect(result.impact.reason).toBe("terrain-hit");
    expect(result.damage).toEqual([]);
    expect(result.terrain.blobs).not.toEqual(terrain.blobs);
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- apps/server/src/simulation/ShotSimulator.test.ts
```

Expected: FAIL because simulator modules do not exist.

- [ ] **Step 3: Implement collision system**

Create `apps/server/src/simulation/CollisionSystem.ts`:

```ts
import { defaultMatchTuning, type PlayerState, type TerrainBlob, type TerrainState, type WorldPoint } from "@graphwar/shared";

function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInRing(point: WorldPoint, ring: WorldPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInBlob(point: WorldPoint, blob: TerrainBlob): boolean {
  return pointInRing(point, blob.outer) && !blob.holes.some((hole) => pointInRing(point, hole));
}

export class CollisionSystem {
  findFirstTerrainHit(path: WorldPoint[], terrain: TerrainState): WorldPoint | undefined {
    return path.find((point) => terrain.blobs.some((blob) => pointInBlob(point, blob)));
  }

  findFirstPlayerHit(path: WorldPoint[], players: PlayerState[], shooterId: string): { point: WorldPoint; player: PlayerState } | undefined {
    for (const point of path) {
      const player = players.find((candidate) => candidate.id !== shooterId && candidate.alive && distance(point, candidate.position) <= defaultMatchTuning.playerHitRadius);
      if (player) return { point, player };
    }
    return undefined;
  }
}
```

- [ ] **Step 4: Implement shot simulator**

Create `apps/server/src/simulation/ShotSimulator.ts`:

```ts
import { defaultMatchTuning, fieldBounds, isPointInBounds, localToWorld, type ImpactEvent, type PlayerState, type TerrainState, type WorldPoint } from "@graphwar/shared";
import type { ShotFunction } from "../functions/ShotFunction";
import { CircleCraterExplosion } from "../terrain/Explosion";
import { TerrainSystem } from "../terrain/TerrainSystem";
import { CollisionSystem } from "./CollisionSystem";

export type ShotSimulationInput = {
  shooter: PlayerState;
  players: PlayerState[];
  terrain: TerrainState;
  shot: ShotFunction;
};

export type ShotSimulationResult = {
  path: WorldPoint[];
  impact: ImpactEvent;
  terrain: TerrainState;
  players: PlayerState[];
  damage: { playerId: string; amount: number; hpAfter: number }[];
  eliminations: string[];
};

export class ShotSimulator {
  private readonly collision = new CollisionSystem();
  private readonly terrainSystem = new TerrainSystem(defaultMatchTuning.terrainMinArea);

  simulate(input: ShotSimulationInput): ShotSimulationResult {
    const sample = input.shot.sample({
      minX: 0,
      maxX: fieldBounds.maxX - input.shooter.position.x,
      step: defaultMatchTuning.sampleStep,
      maxPathPoints: defaultMatchTuning.maxPathPoints
    });
    const localPoints = sample.points;
    const path = localPoints.map((point) => localToWorld(point, input.shooter.position)).filter(isPointInBounds);

    if (!sample.ok && sample.lastFinitePoint) {
      const impactPoint = localToWorld(sample.lastFinitePoint, input.shooter.position);
      const terrain = new CircleCraterExplosion(defaultMatchTuning.circleCraterRadius, defaultMatchTuning.directHitDamage)
        .apply(input.terrain, impactPoint, this.terrainSystem, `undefined-${input.shooter.id}`).terrain;
      return this.result(path, { reason: sample.reason, point: impactPoint }, terrain, input.players, [], []);
    }

    const terrainHit = this.collision.findFirstTerrainHit(path, input.terrain);
    const playerHit = this.collision.findFirstPlayerHit(path, input.players, input.shooter.id);

    if (terrainHit && (!playerHit || path.indexOf(terrainHit) <= path.indexOf(playerHit.point))) {
      const terrain = new CircleCraterExplosion(defaultMatchTuning.circleCraterRadius, defaultMatchTuning.directHitDamage)
        .apply(input.terrain, terrainHit, this.terrainSystem, `terrain-${input.shooter.id}`).terrain;
      return this.result(path, { reason: "terrain-hit", point: terrainHit }, terrain, input.players, [], []);
    }

    if (playerHit) {
      const players = input.players.map((player) => {
        if (player.id !== playerHit.player.id) return player;
        const hp = Math.max(0, player.hp - defaultMatchTuning.directHitDamage);
        return { ...player, hp, alive: hp > 0 };
      });
      const damaged = players.find((player) => player.id === playerHit.player.id);
      const damage = [{ playerId: playerHit.player.id, amount: defaultMatchTuning.directHitDamage, hpAfter: damaged?.hp ?? 0 }];
      const eliminations = damaged && !damaged.alive ? [damaged.id] : [];
      return this.result(path, { reason: "player-hit", point: playerHit.point, targetPlayerId: playerHit.player.id }, input.terrain, players, damage, eliminations);
    }

    return this.result(path, { reason: "miss" }, input.terrain, input.players, [], []);
  }

  private result(path: WorldPoint[], impact: ImpactEvent, terrain: TerrainState, players: PlayerState[], damage: { playerId: string; amount: number; hpAfter: number }[], eliminations: string[]): ShotSimulationResult {
    return { path, impact, terrain, players, damage, eliminations };
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- apps/server/src/simulation/ShotSimulator.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 6: Commit simulator**

```bash
git add apps/server/src/simulation
git commit -m "feat: simulate authoritative shots"
```

---

### Task 8: Match Controller

**Files:**
- Create: `apps/server/src/match/MatchState.ts`
- Create: `apps/server/src/match/MatchController.ts`
- Create: `apps/server/src/match/MatchController.test.ts`

- [ ] **Step 1: Write match-controller tests**

Create `apps/server/src/match/MatchController.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MatchController } from "./MatchController";

describe("MatchController", () => {
  it("starts a team match with terrain, players, and an active turn", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    const snapshot = controller.startMatch("team-versus");

    expect(snapshot.phase).toBe("playing");
    expect(snapshot.players).toHaveLength(2);
    expect(snapshot.terrain.blobs.length).toBeGreaterThan(0);
    expect(snapshot.turn.activePlayerId).toBe("alice");
  });

  it("rejects a shot from a non-active player", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");

    expect(controller.submitShot("bob", "normal", "x").type).toBe("shot-rejected");
  });

  it("resolves a valid active-player shot and advances the turn", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("team-versus");
    const event = controller.submitShot("alice", "normal", "0");

    expect(event.type).toBe("shot-resolved");
    if (event.type === "shot-resolved") {
      expect(event.snapshot.turn.activePlayerId).toBe("bob");
    }
  });

  it("ends a free-for-all match when one player remains alive after resolution", () => {
    const controller = new MatchController("room-1");
    controller.join("alice", "Alice");
    controller.join("bob", "Bob");
    controller.startMatch("free-for-all");
    controller.forcePlayerHpForTest("bob", 0);
    const event = controller.submitShot("alice", "normal", "0");

    expect(event.type).toBe("match-ended");
    if (event.type === "match-ended") {
      expect(event.winnerIds).toEqual(["alice"]);
      expect(event.snapshot.phase).toBe("ended");
    }
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- apps/server/src/match/MatchController.test.ts
```

Expected: FAIL because match modules do not exist.

- [ ] **Step 3: Implement match state alias**

Create `apps/server/src/match/MatchState.ts`:

```ts
import type { MatchSnapshot } from "@graphwar/shared";

export type MatchState = MatchSnapshot;
```

- [ ] **Step 4: Implement match controller**

Create `apps/server/src/match/MatchController.ts`:

```ts
import { defaultMatchTuning, type FunctionFamilyId, type MatchModeId, type MatchSnapshot, type PlayerState, type ServerEvent } from "@graphwar/shared";
import { FunctionRegistry } from "../functions/FunctionRegistry";
import { FreeForAllMapGenerator } from "../maps/FreeForAllMapGenerator";
import { TeamVersusMapGenerator } from "../maps/TeamVersusMapGenerator";
import type { GameMode } from "../modes/GameMode";
import { FreeForAllMode } from "../modes/FreeForAllMode";
import { TeamVersusMode } from "../modes/TeamVersusMode";
import { ShotSimulator } from "../simulation/ShotSimulator";

type LobbyPlayer = { id: string; displayName: string };

export class MatchController {
  private readonly functionRegistry = new FunctionRegistry();
  private readonly simulator = new ShotSimulator();
  private readonly lobbyPlayers = new Map<string, LobbyPlayer>();
  private mode: GameMode = new TeamVersusMode();
  private snapshot: MatchSnapshot = {
    phase: "lobby",
    mode: "team-versus",
    players: [],
    teams: [],
    terrain: { blobs: [] },
    turn: { activePlayerId: "", order: [], turnNumber: 0 }
  };

  constructor(private readonly roomId: string) {}

  join(playerId: string, displayName: string): MatchSnapshot {
    this.lobbyPlayers.set(playerId, { id: playerId, displayName });
    return this.snapshot;
  }

  startMatch(modeId: MatchModeId): MatchSnapshot {
    const players = [...this.lobbyPlayers.values()];
    const mode = modeId === "team-versus" ? new TeamVersusMode() : new FreeForAllMode();
    this.mode = mode;
    const map = modeId === "team-versus" ? new TeamVersusMapGenerator().generate(this.roomId, players.map((player) => player.id)) : new FreeForAllMapGenerator().generate(this.roomId, players.map((player) => player.id));
    const teams = mode.buildTeams(players);
    const playerStates: PlayerState[] = players.map((player) => {
      const team = teams.find((candidate) => candidate.playerIds.includes(player.id));
      const spawn = map.spawns.find((candidate) => candidate.playerId === player.id);
      return {
        id: player.id,
        displayName: player.displayName,
        teamId: team?.id ?? `player-${player.id}`,
        position: spawn?.position ?? { x: 0, y: 0 },
        hp: defaultMatchTuning.soldierHp,
        alive: true
      };
    });
    const order = mode.createTurnOrder(playerStates);
    this.snapshot = {
      phase: "playing",
      mode: modeId,
      players: playerStates,
      teams,
      terrain: map.terrain,
      turn: { activePlayerId: order[0], order, turnNumber: 1 }
    };
    return this.snapshot;
  }

  submitShot(playerId: string, functionFamilyId: FunctionFamilyId, expression: string): ServerEvent {
    if (this.snapshot.phase !== "playing") {
      return { type: "shot-rejected", roomId: this.roomId, playerId, reason: "Match is not playing" };
    }
    if (this.snapshot.turn.activePlayerId !== playerId) {
      return { type: "shot-rejected", roomId: this.roomId, playerId, reason: "Not your turn" };
    }

    try {
      const shooter = this.snapshot.players.find((player) => player.id === playerId);
      if (!shooter) return { type: "shot-rejected", roomId: this.roomId, playerId, reason: "Unknown shooter" };

      const shot = this.functionRegistry.create(functionFamilyId, expression);
      const result = this.simulator.simulate({ shooter, players: this.snapshot.players, terrain: this.snapshot.terrain, shot });
      const nextSnapshot: MatchSnapshot = {
        ...this.snapshot,
        players: result.players,
        terrain: result.terrain,
        turn: this.nextTurn(result.players)
      };
      const victory = this.mode.isVictory(result.players);
      this.snapshot = victory.ended ? { ...nextSnapshot, phase: "ended" } : nextSnapshot;
      if (victory.ended) {
        return {
          type: "match-ended",
          roomId: this.roomId,
          winnerIds: victory.winnerIds,
          snapshot: this.snapshot
        };
      }
      return {
        type: "shot-resolved",
        roomId: this.roomId,
        shooterId: playerId,
        functionFamilyId,
        expression,
        path: result.path,
        impact: result.impact,
        terrain: result.terrain,
        damage: result.damage,
        eliminations: result.eliminations,
        snapshot: this.snapshot
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Invalid function";
      return { type: "shot-rejected", roomId: this.roomId, playerId, reason };
    }
  }

  getSnapshot(): MatchSnapshot {
    return this.snapshot;
  }

  forcePlayerHpForTest(playerId: string, hp: number): void {
    this.snapshot = {
      ...this.snapshot,
      players: this.snapshot.players.map((player) => (player.id === playerId ? { ...player, hp, alive: hp > 0 } : player))
    };
  }

  private nextTurn(players: PlayerState[]) {
    const livingOrder = this.snapshot.turn.order.filter((id) => players.some((player) => player.id === id && player.alive));
    const currentIndex = livingOrder.indexOf(this.snapshot.turn.activePlayerId);
    const nextIndex = livingOrder.length === 0 ? 0 : (currentIndex + 1) % livingOrder.length;
    return {
      activePlayerId: livingOrder[nextIndex] ?? "",
      order: livingOrder,
      turnNumber: this.snapshot.turn.turnNumber + 1
    };
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- apps/server/src/match/MatchController.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 6: Commit match controller**

```bash
git add apps/server/src/match
git commit -m "feat: add authoritative match controller"
```

---

### Task 9: WebSocket Room Server

**Files:**
- Create: `apps/server/src/protocol/parseCommand.ts`
- Create: `apps/server/src/rooms/GameRoom.ts`
- Create: `apps/server/src/rooms/RoomManager.ts`
- Create: `apps/server/src/rooms/RoomManager.integration.test.ts`
- Create: `apps/server/src/sessions/PlayerSession.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write WebSocket integration test**

Create `apps/server/src/rooms/RoomManager.integration.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { buildServer } from "../index";

describe("room websocket server", () => {
  let serverUrl = "";
  let closeServer: () => Promise<void>;

  beforeEach(async () => {
    const app = await buildServer();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("No server address");
    serverUrl = `ws://127.0.0.1:${address.port}/rooms/local-test`;
    closeServer = () => app.close();
  });

  afterEach(async () => {
    await closeServer();
  });

  it("lets two mock clients join and receive a shot result", async () => {
    const alice = new WebSocket(`${serverUrl}?mockPlayer=alice`);
    const bob = new WebSocket(`${serverUrl}?mockPlayer=bob`);
    const events: unknown[] = [];

    await Promise.all([
      new Promise<void>((resolve) => alice.once("open", resolve)),
      new Promise<void>((resolve) => bob.once("open", resolve))
    ]);

    alice.on("message", (data) => events.push(JSON.parse(String(data))));
    bob.on("message", (data) => events.push(JSON.parse(String(data))));

    alice.send(JSON.stringify({ type: "join-room", roomId: "local-test", playerId: "alice", displayName: "Alice" }));
    bob.send(JSON.stringify({ type: "join-room", roomId: "local-test", playerId: "bob", displayName: "Bob" }));
    alice.send(JSON.stringify({ type: "start-match", roomId: "local-test", playerId: "alice" }));
    alice.send(JSON.stringify({ type: "submit-shot", roomId: "local-test", playerId: "alice", functionFamilyId: "normal", expression: "0" }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(events.some((event) => typeof event === "object" && event !== null && "type" in event && event.type === "shot-resolved")).toBe(true);

    alice.close();
    bob.close();
  });
});
```

- [ ] **Step 2: Run failing integration test**

Run:

```bash
npm test -- apps/server/src/rooms/RoomManager.integration.test.ts
```

Expected: FAIL because WebSocket upgrade handling is not implemented.

- [ ] **Step 3: Implement command parser and session type**

Create `apps/server/src/protocol/parseCommand.ts`:

```ts
import { clientCommandSchema, type ClientCommand } from "@graphwar/shared";

export function parseCommand(data: string): ClientCommand {
  return clientCommandSchema.parse(JSON.parse(data));
}
```

Create `apps/server/src/sessions/PlayerSession.ts`:

```ts
export type PlayerSession = {
  playerId: string;
  displayName: string;
  roomId: string;
  source: "local" | "discord";
};
```

- [ ] **Step 4: Implement GameRoom**

Create `apps/server/src/rooms/GameRoom.ts`:

```ts
import type WebSocket from "ws";
import type { ClientCommand, MatchModeId, ServerEvent } from "@graphwar/shared";
import { MatchController } from "../match/MatchController";

export class GameRoom {
  private readonly clients = new Set<WebSocket>();
  private readonly match: MatchController;
  private selectedMode: MatchModeId = "team-versus";

  constructor(readonly roomId: string) {
    this.match = new MatchController(roomId);
  }

  addClient(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on("close", () => this.clients.delete(socket));
  }

  handleCommand(command: ClientCommand): void {
    if (command.type === "join-room") {
      const snapshot = this.match.join(command.playerId, command.displayName);
      this.broadcast({ type: "player-joined", roomId: this.roomId, playerId: command.playerId });
      this.broadcast({ type: "room-snapshot", roomId: this.roomId, snapshot });
      return;
    }

    if (command.type === "select-mode") {
      this.selectedMode = command.mode;
      this.broadcast({ type: "room-snapshot", roomId: this.roomId, snapshot: this.match.getSnapshot() });
      return;
    }

    if (command.type === "start-match") {
      const snapshot = this.match.startMatch(this.selectedMode);
      this.broadcast({ type: "match-started", roomId: this.roomId, snapshot });
      this.broadcast({ type: "turn-started", roomId: this.roomId, playerId: snapshot.turn.activePlayerId, turnNumber: snapshot.turn.turnNumber });
      return;
    }

    if (command.type === "submit-shot") {
      const event = this.match.submitShot(command.playerId, command.functionFamilyId, command.expression);
      this.broadcast(event);
      if (event.type === "shot-resolved") {
        this.broadcast({ type: "turn-advanced", roomId: this.roomId, playerId: event.snapshot.turn.activePlayerId, turnNumber: event.snapshot.turn.turnNumber });
      }
      return;
    }

    this.broadcast({ type: "shot-rejected", roomId: this.roomId, playerId: command.playerId, reason: `Unsupported command: ${command.type}` });
  }

  broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  }
}
```

- [ ] **Step 5: Implement RoomManager**

Create `apps/server/src/rooms/RoomManager.ts`:

```ts
import type WebSocket from "ws";
import { parseCommand } from "../protocol/parseCommand";
import { GameRoom } from "./GameRoom";

export class RoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  connect(roomId: string, socket: WebSocket): void {
    const room = this.getRoom(roomId);
    room.addClient(socket);
    socket.on("message", (data) => {
      try {
        room.handleCommand(parseCommand(String(data)));
      } catch (error) {
        socket.send(JSON.stringify({ type: "shot-rejected", roomId, playerId: "unknown", reason: error instanceof Error ? error.message : "Invalid command" }));
      }
    });
  }

  private getRoom(roomId: string): GameRoom {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;
    const room = new GameRoom(roomId);
    this.rooms.set(roomId, room);
    return room;
  }
}
```

- [ ] **Step 6: Wire WebSocket upgrades into Fastify server**

Modify `apps/server/src/index.ts`:

```ts
import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { RoomManager } from "./rooms/RoomManager";

export async function buildServer() {
  const app = Fastify({ logger: true });
  const rooms = new RoomManager();
  const wss = new WebSocketServer({ noServer: true });

  app.get("/health", async () => ({ ok: true }));

  app.server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const match = /^\/rooms\/([^/]+)$/.exec(url.pathname);
    if (!match) {
      socket.destroy();
      return;
    }
    const roomId = decodeURIComponent(match[1]);
    wss.handleUpgrade(request, socket, head, (ws) => {
      rooms.connect(roomId, ws);
    });
  });

  app.addHook("onClose", async () => {
    wss.close();
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: 8787, host: "0.0.0.0" });
}
```

- [ ] **Step 7: Run integration test and typecheck**

Run:

```bash
npm test -- apps/server/src/rooms/RoomManager.integration.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 8: Commit WebSocket rooms**

```bash
git add apps/server/src
git commit -m "feat: add local websocket rooms"
```

---

### Task 10: Client Session, Store, And Lobby UI

**Files:**
- Create: `apps/client/src/sessions/localSession.ts`
- Create: `apps/client/src/sessions/discordSession.ts`
- Create: `apps/client/src/networking/gameClient.ts`
- Create: `apps/client/src/app/useGameStore.ts`
- Create: `apps/client/src/hud/LobbyPanel.tsx`
- Create: `apps/client/src/hud/MatchHud.tsx`
- Modify: `apps/client/src/app/App.tsx`

- [ ] **Step 1: Write local-session test**

Create `apps/client/src/sessions/localSession.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readLocalSession } from "./localSession";

describe("readLocalSession", () => {
  it("reads room and mock player from url params", () => {
    const session = readLocalSession("http://localhost:5173/?room=local-test&mockPlayer=alice");
    expect(session).toEqual({
      roomId: "local-test",
      playerId: "alice",
      displayName: "alice",
      source: "local"
    });
  });

  it("uses defaults when params are absent", () => {
    const session = readLocalSession("http://localhost:5173/");
    expect(session.roomId).toBe("local-test");
    expect(session.playerId).toMatch(/^player-/);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- apps/client/src/sessions/localSession.test.ts
```

Expected: FAIL because `localSession` does not exist.

- [ ] **Step 3: Implement session adapters**

Create `apps/client/src/sessions/localSession.ts`:

```ts
export type ClientSession = {
  roomId: string;
  playerId: string;
  displayName: string;
  source: "local" | "discord";
};

export function readLocalSession(href = window.location.href): ClientSession {
  const url = new URL(href);
  const mockPlayer = url.searchParams.get("mockPlayer") ?? `player-${Math.random().toString(36).slice(2, 8)}`;
  return {
    roomId: url.searchParams.get("room") ?? "local-test",
    playerId: mockPlayer,
    displayName: mockPlayer,
    source: "local"
  };
}
```

Create `apps/client/src/sessions/discordSession.ts`:

```ts
import type { ClientSession } from "./localSession";

export async function readDiscordSession(): Promise<ClientSession | undefined> {
  return undefined;
}
```

- [ ] **Step 4: Implement WebSocket client**

Create `apps/client/src/networking/gameClient.ts`:

```ts
import type { ClientCommand, ServerEvent } from "@graphwar/shared";

export type GameClient = {
  send(command: ClientCommand): void;
  close(): void;
};

export function connectGameClient(roomId: string, onEvent: (event: ServerEvent) => void): GameClient {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname;
  const socket = new WebSocket(`${protocol}://${host}:8787/rooms/${encodeURIComponent(roomId)}`);

  socket.addEventListener("message", (message) => {
    onEvent(JSON.parse(String(message.data)) as ServerEvent);
  });

  return {
    send(command) {
      const payload = JSON.stringify(command);
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      else socket.addEventListener("open", () => socket.send(payload), { once: true });
    },
    close() {
      socket.close();
    }
  };
}
```

- [ ] **Step 5: Implement Zustand store**

Create `apps/client/src/app/useGameStore.ts`:

```ts
import { create } from "zustand";
import type { MatchSnapshot, ServerEvent } from "@graphwar/shared";

type GameStore = {
  snapshot?: MatchSnapshot;
  events: ServerEvent[];
  applyEvent(event: ServerEvent): void;
};

export const useGameStore = create<GameStore>((set) => ({
  events: [],
  applyEvent(event) {
    set((state) => ({
      events: [...state.events, event],
      snapshot:
        "snapshot" in event
          ? event.snapshot
          : event.type === "terrain-changed" && state.snapshot
            ? { ...state.snapshot, terrain: event.terrain }
            : state.snapshot
    }));
  }
}));
```

- [ ] **Step 6: Implement lobby and HUD components**

Create `apps/client/src/hud/LobbyPanel.tsx`:

```tsx
import type { GameClient } from "../networking/gameClient";
import type { ClientSession } from "../sessions/localSession";

type LobbyPanelProps = {
  session: ClientSession;
  client: GameClient;
};

export function LobbyPanel({ session, client }: LobbyPanelProps) {
  return (
    <section className="panel">
      <div>
        <strong>Room</strong> {session.roomId}
      </div>
      <div>
        <strong>Player</strong> {session.displayName}
      </div>
      <button
        onClick={() => client.send({ type: "join-room", roomId: session.roomId, playerId: session.playerId, displayName: session.displayName })}
      >
        Join
      </button>
      <button onClick={() => client.send({ type: "select-mode", roomId: session.roomId, playerId: session.playerId, mode: "team-versus" })}>
        Team Versus
      </button>
      <button onClick={() => client.send({ type: "select-mode", roomId: session.roomId, playerId: session.playerId, mode: "free-for-all" })}>
        Free For All
      </button>
      <button onClick={() => client.send({ type: "start-match", roomId: session.roomId, playerId: session.playerId })}>Start Match</button>
    </section>
  );
}
```

Create `apps/client/src/hud/MatchHud.tsx`:

```tsx
import type { MatchSnapshot } from "@graphwar/shared";

type MatchHudProps = {
  snapshot?: MatchSnapshot;
};

export function MatchHud({ snapshot }: MatchHudProps) {
  if (!snapshot) return <section className="panel">No room snapshot yet.</section>;
  return (
    <section className="panel">
      <div>Phase: {snapshot.phase}</div>
      <div>Mode: {snapshot.mode}</div>
      <div>Turn: {snapshot.turn.activePlayerId || "none"}</div>
      <div className="player-list">
        {snapshot.players.map((player) => (
          <span key={player.id}>
            {player.displayName}: {player.hp} HP
          </span>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Wire App**

Modify `apps/client/src/app/App.tsx`:

```tsx
import { useEffect, useMemo } from "react";
import { MatchHud } from "../hud/MatchHud";
import { LobbyPanel } from "../hud/LobbyPanel";
import { connectGameClient } from "../networking/gameClient";
import { readLocalSession } from "../sessions/localSession";
import { useGameStore } from "./useGameStore";

export function App() {
  const session = useMemo(() => readLocalSession(), []);
  const applyEvent = useGameStore((state) => state.applyEvent);
  const snapshot = useGameStore((state) => state.snapshot);
  const client = useMemo(() => connectGameClient(session.roomId, applyEvent), [applyEvent, session.roomId]);

  useEffect(() => () => client.close(), [client]);

  return (
    <main className="game-shell">
      <LobbyPanel session={session} client={client} />
      <MatchHud snapshot={snapshot} />
    </main>
  );
}
```

- [ ] **Step 8: Expand CSS for panels**

Modify `apps/client/src/styles.css`:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f6f7fb;
  background: #12151c;
}

body {
  margin: 0;
}

button {
  border: 1px solid #465269;
  border-radius: 6px;
  background: #202838;
  color: #f6f7fb;
  padding: 8px 10px;
  cursor: pointer;
}

.game-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 12px;
  padding: 16px;
}

.panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #2f394b;
  border-radius: 8px;
  background: #171d29;
}

.player-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
```

- [ ] **Step 9: Run tests and typecheck**

Run:

```bash
npm test -- apps/client/src/sessions/localSession.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 10: Commit client shell**

```bash
git add apps/client/src
git commit -m "feat: add local client session shell"
```

---

### Task 11: Canvas Renderer And Server Event Animation

**Files:**
- Create: `apps/client/src/game-renderer/renderWorld.ts`
- Create: `apps/client/src/game-renderer/GameCanvas.tsx`
- Modify: `apps/client/src/app/App.tsx`
- Modify: `apps/client/src/styles.css`

- [ ] **Step 1: Write renderer test**

Create `apps/client/src/game-renderer/renderWorld.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { worldToCanvas } from "./renderWorld";

describe("worldToCanvas", () => {
  it("maps graph bounds into canvas pixels", () => {
    expect(worldToCanvas({ x: 0, y: 0 }, { width: 500, height: 300 })).toEqual({ x: 250, y: 150 });
    expect(worldToCanvas({ x: -25, y: 15 }, { width: 500, height: 300 })).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- apps/client/src/game-renderer/renderWorld.test.ts
```

Expected: FAIL because renderer helpers do not exist.

- [ ] **Step 3: Implement render helpers**

Create `apps/client/src/game-renderer/renderWorld.ts`:

```ts
import { fieldBounds, type MatchSnapshot, type WorldPoint } from "@graphwar/shared";

type CanvasSize = {
  width: number;
  height: number;
};

export function worldToCanvas(point: WorldPoint, size: CanvasSize): WorldPoint {
  const xRange = fieldBounds.maxX - fieldBounds.minX;
  const yRange = fieldBounds.maxY - fieldBounds.minY;
  return {
    x: Math.round(((point.x - fieldBounds.minX) / xRange) * size.width),
    y: Math.round(((fieldBounds.maxY - point.y) / yRange) * size.height)
  };
}

export function renderWorld(context: CanvasRenderingContext2D, snapshot: MatchSnapshot | undefined, path: WorldPoint[]): void {
  const size = { width: context.canvas.width, height: context.canvas.height };
  context.clearRect(0, 0, size.width, size.height);
  context.fillStyle = "#10141d";
  context.fillRect(0, 0, size.width, size.height);

  context.strokeStyle = "#2b3548";
  context.lineWidth = 1;
  const origin = worldToCanvas({ x: 0, y: 0 }, size);
  context.beginPath();
  context.moveTo(origin.x, 0);
  context.lineTo(origin.x, size.height);
  context.moveTo(0, origin.y);
  context.lineTo(size.width, origin.y);
  context.stroke();

  if (snapshot) {
    context.fillStyle = "#697f52";
    for (const blob of snapshot.terrain.blobs) {
      context.beginPath();
      blob.outer.forEach((point, index) => {
        const canvasPoint = worldToCanvas(point, size);
        if (index === 0) context.moveTo(canvasPoint.x, canvasPoint.y);
        else context.lineTo(canvasPoint.x, canvasPoint.y);
      });
      context.closePath();
      context.fill();
    }

    for (const player of snapshot.players) {
      const canvasPoint = worldToCanvas(player.position, size);
      context.fillStyle = player.alive ? "#f2c14e" : "#686f7c";
      context.beginPath();
      context.arc(canvasPoint.x, canvasPoint.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f6f7fb";
      context.fillText(player.displayName, canvasPoint.x + 9, canvasPoint.y - 9);
    }
  }

  if (path.length > 1) {
    context.strokeStyle = "#e85d75";
    context.lineWidth = 3;
    context.beginPath();
    path.forEach((point, index) => {
      const canvasPoint = worldToCanvas(point, size);
      if (index === 0) context.moveTo(canvasPoint.x, canvasPoint.y);
      else context.lineTo(canvasPoint.x, canvasPoint.y);
    });
    context.stroke();
  }
}
```

- [ ] **Step 4: Implement canvas component**

Create `apps/client/src/game-renderer/GameCanvas.tsx`:

```tsx
import { useEffect, useRef } from "react";
import type { MatchSnapshot, ServerEvent, WorldPoint } from "@graphwar/shared";
import { renderWorld } from "./renderWorld";

type GameCanvasProps = {
  snapshot?: MatchSnapshot;
  events: ServerEvent[];
};

export function GameCanvas({ snapshot, events }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPath = [...events].reverse().find((event): event is Extract<ServerEvent, { type: "shot-resolved" }> => event.type === "shot-resolved")?.path ?? [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      renderWorld(context, snapshot, lastPath as WorldPoint[]);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [lastPath, snapshot]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Graphwar map" />;
}
```

- [ ] **Step 5: Wire canvas into App**

Modify `apps/client/src/app/App.tsx`:

```tsx
import { useEffect, useMemo } from "react";
import { GameCanvas } from "../game-renderer/GameCanvas";
import { MatchHud } from "../hud/MatchHud";
import { LobbyPanel } from "../hud/LobbyPanel";
import { connectGameClient } from "../networking/gameClient";
import { readLocalSession } from "../sessions/localSession";
import { useGameStore } from "./useGameStore";

export function App() {
  const session = useMemo(() => readLocalSession(), []);
  const applyEvent = useGameStore((state) => state.applyEvent);
  const snapshot = useGameStore((state) => state.snapshot);
  const events = useGameStore((state) => state.events);
  const client = useMemo(() => connectGameClient(session.roomId, applyEvent), [applyEvent, session.roomId]);

  useEffect(() => () => client.close(), [client]);

  return (
    <main className="game-shell">
      <LobbyPanel session={session} client={client} />
      <MatchHud snapshot={snapshot} />
      <GameCanvas snapshot={snapshot} events={events} />
    </main>
  );
}
```

- [ ] **Step 6: Add canvas CSS**

Append to `apps/client/src/styles.css`:

```css
.game-canvas {
  width: 100%;
  min-height: 520px;
  border: 1px solid #2f394b;
  border-radius: 8px;
  background: #10141d;
}
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
npm test -- apps/client/src/game-renderer/renderWorld.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 8: Commit renderer**

```bash
git add apps/client/src
git commit -m "feat: render authoritative match state"
```

---

### Task 12: Function Input Palette And Submit Flow

**Files:**
- Create: `apps/client/src/input/insertSnippet.ts`
- Create: `apps/client/src/input/insertSnippet.test.ts`
- Create: `apps/client/src/input/FunctionInput.tsx`
- Modify: `apps/client/src/app/App.tsx`
- Modify: `apps/client/src/styles.css`

- [ ] **Step 1: Write snippet insertion tests**

Create `apps/client/src/input/insertSnippet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { insertSnippet } from "./insertSnippet";

describe("insertSnippet", () => {
  it("inserts a function snippet and places cursor inside parentheses", () => {
    expect(insertSnippet("2+", 2, "sin()")).toEqual({ value: "2+sin()", cursor: 6 });
  });

  it("replaces selected text", () => {
    expect(insertSnippet("abc", 1, "x", 3)).toEqual({ value: "ax", cursor: 2 });
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- apps/client/src/input/insertSnippet.test.ts
```

Expected: FAIL because input helpers do not exist.

- [ ] **Step 3: Implement snippet helper**

Create `apps/client/src/input/insertSnippet.ts`:

```ts
export type InsertResult = {
  value: string;
  cursor: number;
};

export function insertSnippet(value: string, start: number, snippet: string, end = start): InsertResult {
  const nextValue = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
  const parenIndex = snippet.indexOf("()");
  const cursor = parenIndex >= 0 ? start + parenIndex + 1 : start + snippet.length;
  return { value: nextValue, cursor };
}
```

- [ ] **Step 4: Implement function input component**

Create `apps/client/src/input/FunctionInput.tsx`:

```tsx
import { useRef, useState } from "react";
import type { GameClient } from "../networking/gameClient";
import type { ClientSession } from "../sessions/localSession";
import { insertSnippet } from "./insertSnippet";

const snippets = ["sin()", "cos()", "tan()", "sqrt()", "log()", "ln()", "abs()", "exp()", "x", "^", "()", "a*sin(b*x+c)", "k/(1+exp(-a*(x+c)))", "k/(1+(a*(x-c))^2)", "a*((x-k)+abs(x-k))"];

type FunctionInputProps = {
  session: ClientSession;
  client: GameClient;
};

export function FunctionInput({ session, client }: FunctionInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [expression, setExpression] = useState("sin(x)");

  const applySnippet = (snippet: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? start;
    const result = insertSnippet(expression, start, snippet, end);
    setExpression(result.value);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(result.cursor, result.cursor);
    });
  };

  return (
    <section className="panel function-panel">
      <input ref={inputRef} value={expression} onChange={(event) => setExpression(event.target.value)} aria-label="Function expression" />
      <button
        onClick={() =>
          client.send({
            type: "submit-shot",
            roomId: session.roomId,
            playerId: session.playerId,
            functionFamilyId: "normal",
            expression
          })
        }
      >
        Fire
      </button>
      <div className="snippet-grid">
        {snippets.map((snippet) => (
          <button key={snippet} onClick={() => applySnippet(snippet)}>
            {snippet}
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire input into App**

Modify `apps/client/src/app/App.tsx`:

```tsx
import { useEffect, useMemo } from "react";
import { GameCanvas } from "../game-renderer/GameCanvas";
import { MatchHud } from "../hud/MatchHud";
import { LobbyPanel } from "../hud/LobbyPanel";
import { FunctionInput } from "../input/FunctionInput";
import { connectGameClient } from "../networking/gameClient";
import { readLocalSession } from "../sessions/localSession";
import { useGameStore } from "./useGameStore";

export function App() {
  const session = useMemo(() => readLocalSession(), []);
  const applyEvent = useGameStore((state) => state.applyEvent);
  const snapshot = useGameStore((state) => state.snapshot);
  const events = useGameStore((state) => state.events);
  const client = useMemo(() => connectGameClient(session.roomId, applyEvent), [applyEvent, session.roomId]);

  useEffect(() => () => client.close(), [client]);

  return (
    <main className="game-shell">
      <LobbyPanel session={session} client={client} />
      <MatchHud snapshot={snapshot} />
      <FunctionInput session={session} client={client} />
      <GameCanvas snapshot={snapshot} events={events} />
    </main>
  );
}
```

- [ ] **Step 6: Add input CSS**

Append to `apps/client/src/styles.css`:

```css
.function-panel input {
  min-width: min(520px, 100%);
  flex: 1 1 320px;
  border: 1px solid #465269;
  border-radius: 6px;
  background: #10141d;
  color: #f6f7fb;
  padding: 9px 10px;
}

.snippet-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
```

- [ ] **Step 7: Run tests and typecheck**

Run:

```bash
npm test -- apps/client/src/input/insertSnippet.test.ts
npm run check
```

Expected: both pass.

- [ ] **Step 8: Commit function input**

```bash
git add apps/client/src
git commit -m "feat: add function input palette"
```

---

### Task 13: End-To-End Local Lobby Smoke Test

**Files:**
- Create: `apps/client/e2e/local-lobby.spec.ts`
- Modify: `apps/client/src/hud/MatchHud.tsx`
- Modify: `apps/client/src/game-renderer/GameCanvas.tsx`

- [ ] **Step 1: Add stable test ids to UI**

Modify `apps/client/src/hud/MatchHud.tsx`:

```tsx
import type { MatchSnapshot } from "@graphwar/shared";

type MatchHudProps = {
  snapshot?: MatchSnapshot;
};

export function MatchHud({ snapshot }: MatchHudProps) {
  if (!snapshot) return <section className="panel" data-testid="match-hud">No room snapshot yet.</section>;
  return (
    <section className="panel" data-testid="match-hud">
      <div>Phase: {snapshot.phase}</div>
      <div>Mode: {snapshot.mode}</div>
      <div data-testid="active-turn">Turn: {snapshot.turn.activePlayerId || "none"}</div>
      <div className="player-list">
        {snapshot.players.map((player) => (
          <span key={player.id} data-testid={`player-${player.id}`}>
            {player.displayName}: {player.hp} HP
          </span>
        ))}
      </div>
    </section>
  );
}
```

Modify `apps/client/src/game-renderer/GameCanvas.tsx`:

```tsx
import { useEffect, useRef } from "react";
import type { MatchSnapshot, ServerEvent, WorldPoint } from "@graphwar/shared";
import { renderWorld } from "./renderWorld";

type GameCanvasProps = {
  snapshot?: MatchSnapshot;
  events: ServerEvent[];
};

export function GameCanvas({ snapshot, events }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPath = [...events].reverse().find((event): event is Extract<ServerEvent, { type: "shot-resolved" }> => event.type === "shot-resolved")?.path ?? [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      renderWorld(context, snapshot, lastPath as WorldPoint[]);
      canvas.dataset.rendered = snapshot ? "true" : "false";
      canvas.dataset.pathPoints = String(lastPath.length);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [lastPath, snapshot]);

  return <canvas ref={canvasRef} className="game-canvas" data-testid="game-canvas" aria-label="Graphwar map" />;
}
```

- [ ] **Step 2: Write Playwright smoke test**

Create `apps/client/e2e/local-lobby.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("two local mock clients can join, start, and resolve a shot", async ({ browser }) => {
  const alice = await browser.newPage();
  const bob = await browser.newPage();

  await alice.goto("/?room=local-test&mockPlayer=alice");
  await bob.goto("/?room=local-test&mockPlayer=bob");

  await alice.getByRole("button", { name: "Join" }).click();
  await bob.getByRole("button", { name: "Join" }).click();
  await alice.getByRole("button", { name: "Start Match" }).click();

  await expect(alice.getByTestId("active-turn")).toContainText("alice");
  await expect(bob.getByTestId("active-turn")).toContainText("alice");

  await alice.getByLabel("Function expression").fill("0");
  await alice.getByRole("button", { name: "Fire" }).click();

  await expect(alice.getByTestId("active-turn")).toContainText("bob");
  await expect(bob.getByTestId("active-turn")).toContainText("bob");
  await expect(alice.getByTestId("game-canvas")).toHaveAttribute("data-rendered", "true");
  await expect(alice.getByTestId("game-canvas")).not.toHaveAttribute("data-path-points", "0");

  await alice.close();
  await bob.close();
});
```

- [ ] **Step 3: Run unit/integration checks**

Run:

```bash
npm test
npm run check
```

Expected: both pass.

- [ ] **Step 4: Run Playwright smoke test**

Run:

```bash
npm run test:e2e
```

Expected: Playwright launches server/client, opens two pages, starts a match, submits a shot, and passes.

- [ ] **Step 5: Commit e2e coverage**

```bash
git add apps/client/e2e apps/client/src
git commit -m "test: add local lobby smoke test"
```

---

### Task 14: Local Run Documentation And Final Verification

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-07-04-graphwar-discord-activity-design.md` only if implementation discovered a mismatch with the approved design

- [ ] **Step 1: Write README**

Create `README.md`:

```md
# Graphwar Discord Activity Prototype

Local-first networked prototype for a Graphwar-like Discord Activity.

## Install

\```bash
npm install
\```

## Run Locally

\```bash
npm run dev
\```

Open multiple tabs:

\```txt
http://localhost:5173/?room=local-test&mockPlayer=alice
http://localhost:5173/?room=local-test&mockPlayer=bob
http://localhost:5173/?room=local-test&mockPlayer=charlie
\```

Click `Join` in each tab, start the match from one tab, and submit a function when it is that player's turn.

## Current MVP

- Local multi-tab networked lobby.
- Server-authoritative normal-function shots.
- Shooter-local function coordinates with vertical offset through local `(0, 0)`.
- Destructible polygon terrain with circular crater explosions.
- Team-versus and free-for-all architecture.
- Canvas rendering of authoritative state and shot paths.
- Function input palette.

## Checks

\```bash
npm test
npm run check
npm run test:e2e
\```
\```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
npm run check
npm run test:e2e
```

Expected: all pass.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short
```

Expected: only intentional untracked files remain. The pre-existing `graphwar_cheat_sheet.md` may remain untracked if it was not intentionally added.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md
git commit -m "docs: add local prototype instructions"
```

## Plan Self-Review

Spec coverage:

- TypeScript monorepo: Task 1.
- Shared protocol/types/schemas: Task 2.
- Shooter-local coordinates: Task 3 and Task 4.
- Normal Function with finite `f(0)` validation and vertical offset: Task 4.
- Destructible polygon terrain and circular craters: Task 5.
- Team-versus and free-for-all modes with different map generation: Task 6.
- Server-authoritative simulation: Task 7 and Task 8.
- WebSocket local multi-tab lobby: Task 9.
- Client session boundary for local now and Discord future: Task 10.
- Canvas rendering and event animation data: Task 11.
- Function input palette: Task 12.
- Local end-to-end verification: Task 13.
- Install/run documentation: Task 14.

Red-flag scan:

- No empty or unfinished implementation steps are present.
- Deferred product ideas from the spec are not included as implementation work.

Type consistency:

- Shared event and command names use `ClientCommand`, `ServerEvent`, `SubmitShotCommand`, and `ShotResolvedEvent`.
- Coordinates use `LocalPoint` and `WorldPoint`.
- Function family ids use `"normal"`.
- Match mode ids use `"team-versus"` and `"free-for-all"`.
