# Graphwar Discord Activity

Local-first prototype for a Graphwar-inspired Discord Activity. The first milestone is a browser-based multi-tab game that connects to a local authoritative server, while keeping the client/server boundary ready for Discord's Embedded App SDK later.

## Current Status

- Design spec: `docs/superpowers/specs/2026-07-04-graphwar-discord-activity-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-04-graphwar-discord-activity-prototype.md`
- Source mechanics notes: `graphwar_cheat_sheet.md`
- Active branch: `feature/graphwar-prototype`
- Remote branch: `origin/feature/graphwar-prototype`
- Current checkpoint: client local-session parsing, Discord-ready session placeholder, schema-validating WebSocket client, Zustand room store, a practical local multi-tab lobby/match control surface, and a Canvas 2D battlefield renderer that plays back authoritative shot paths and impact markers from validated server events.
- Execution mode: subagent-driven development with review after each task

## Planned Stack

- TypeScript npm workspaces
- Vite + React client
- Canvas 2D renderer
- Fastify + `ws` server
- Zod shared protocol validation
- `expr-eval` for normal-function parsing
- `polygon-clipping` for terrain craters
- Vitest + Playwright

## Current Workspace

The workspace now contains:

- `apps/client`: Vite + React browser activity prototype with local query-parameter sessions, a Discord session factory placeholder, validated WebSocket room client, Zustand game store, Canvas 2D battlefield rendering, authoritative shot path/impact playback, connection panel, lobby roster/team display, mode controls, start-match control, turn summary, recent event log, and simple normal-function shot input.
- `apps/server`: Fastify server with a `/health` route on port `8787`, `/rooms/:roomId` WebSocket upgrades, normal-function parsing/sampling helpers for shot trajectories, authoritative shot simulation and collision resolution, server-side destructible terrain crater logic, match mode rules, deterministic map generators, a match controller for lobby joins, match starts, shot submissions, turn advancement, and victory resolution, and a local room manager for command routing.
- `packages/shared`: shared constants, geometry/state types, coordinate and polygon helpers, function validation settings, client command types, server event types, and Zod schemas for runtime protocol validation with compile-time protocol alignment checks.
- Root TypeScript project references, Vitest config, and Playwright config.

## Install And Checks

```bash
npm install
npm test -- apps/server/src/functions/NormalFunction.test.ts
npm test -- apps/server/src/simulation/ShotSimulator.test.ts
npm test -- apps/server/src/terrain/TerrainSystem.test.ts
npm test -- apps/server/src/modes apps/server/src/maps
npm test -- apps/server/src/match/MatchController.test.ts
npm test -- apps/server/src/rooms/RoomManager.integration.test.ts
npm test -- apps/client/src/game-renderer
npm test -- apps/client/src
npm test -- packages/shared/src/protocol/schemas.test.ts
npm test -- packages/shared/src/geometry
npm run check
npm test
npm --workspace apps/client run build
npm --workspace apps/server run build
```

The current checks compile the project references, validate normal-function parsing/sampling, authoritative shot simulation and collision resolution, terrain crater removal, match mode rules, deterministic map generators, match controller orchestration, WebSocket room integration, client local-session/network/store/UI/renderer behavior, shared protocol schemas, and geometry helpers with Vitest, run the full Vitest suite, and verify the client and server build outputs.

## Local Development Target

The local playable loop runs with one server and multiple mock browser clients:

```bash
npm install
npm run dev
```

Open separate browser tabs with different mock players:

```txt
http://localhost:5173/?room=local-test&mockPlayer=alice&displayName=Alice
http://localhost:5173/?room=local-test&mockPlayer=bob&displayName=Bob
http://localhost:5173/?room=local-test&mockPlayer=charlie&displayName=Charlie
```

By default the client connects to `ws://<current hostname>:8787/rooms/:roomId`. Add `server=ws://host:port` to the query string to override the WebSocket base during local testing.

## Implementation Checkpoints

Every major implementation task should:

1. Update this README when the user-facing state changes.
2. Run the relevant verification commands.
3. Commit the checkpoint.
4. Push the checkpoint branch with SSH after each major change.

## Checkpoint Log

- `74c6e70`: Added initial README and tracked Graphwar mechanics notes.
- Scaffolded the TypeScript workspace with client, server, and shared packages.
- `3c28af9`: Defined shared game constants, domain types, validation settings, and protocol schemas.
- Added shared coordinate and polygon helpers with validated circle polygon inputs and targeted geometry coverage.
- Current: added the client-side local session boundary, future Discord session placeholder, schema-validated WebSocket client, Zustand store actions for room commands/events, a usable multi-tab lobby/match control surface, and Canvas 2D world rendering with shot path/impact playback for `alice`/`bob` local testing.
