# Graphwar Discord Activity

Local-first prototype for a Graphwar-inspired Discord Activity. The first milestone is a browser-based multi-tab game that connects to a local authoritative server, while keeping the client/server boundary ready for Discord's Embedded App SDK later.

## Current Status

- Design spec: `docs/superpowers/specs/2026-07-04-graphwar-discord-activity-design.md`
- Implementation plans:
  - `docs/superpowers/plans/2026-07-04-graphwar-discord-activity-prototype.md`
  - `docs/superpowers/plans/2026-07-05-aim-direction-hud.md`
- Source mechanics notes: `graphwar_cheat_sheet.md`
- Active branch: `feature/graphwar-prototype`
- Remote branch: `origin/feature/graphwar-prototype`
- Current checkpoint: client local-session parsing, Discord-ready session placeholder, schema-validating WebSocket client, Zustand room store, a practical local multi-tab lobby/match control surface, normal-function shot input palette, 8-way rotated local aim axes, a compact in-turn HUD with own HP and direction dial, Canvas 2D battlefield rendering with attenuated authoritative shot paths, turn-start shot clearing, and a Playwright two-client local lobby smoke test.
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

- `apps/client`: Vite + React browser activity prototype with local query-parameter sessions, a Discord session factory placeholder, validated WebSocket room client, Zustand game store, Canvas 2D battlefield rendering, authoritative shot path/impact playback, connection panel, lobby roster/team display, mode controls, start-match control, turn summary, recent event log, compact playing HUD, 8-way direction dial with mouse-wheel stepping, normal-function shot input with snippet buttons for common functions, constants, operators, and templates, and Playwright coverage for two local mock clients joining, starting, firing, and advancing turns.
- `apps/server`: Fastify server with a `/health` route on port `8787`, `/rooms/:roomId` WebSocket upgrades, normal-function parsing/sampling helpers for shot trajectories, authoritative rotated-axis shot simulation and collision resolution, server-side destructible terrain crater logic, match mode rules, deterministic map generators, a match controller for lobby joins, match starts, shot submissions, turn advancement, and victory resolution, and a local room manager for command routing.
- `packages/shared`: shared constants, geometry/state types, 8-way aim direction and coordinate helpers, polygon helpers, function validation settings, client command types, server event types, and Zod schemas for runtime protocol validation with compile-time protocol alignment checks.
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
npm test -- apps/client/src/input apps/client/src/hud
npm test -- apps/client/src
npm test -- packages/shared/src/protocol/schemas.test.ts
npm test -- packages/shared/src/geometry
npm run check
npm test
npm run test:e2e
npm --workspace apps/client run build
npm --workspace apps/server run build
```

The current checks compile the project references, validate normal-function parsing/sampling, authoritative shot simulation and collision resolution, terrain crater removal, match mode rules, deterministic map generators, match controller orchestration, WebSocket room integration, client local-session/network/store/UI/renderer behavior, function input palette insertion behavior, shared protocol schemas, and geometry helpers with Vitest, run the full Vitest suite, exercise a two-client local lobby smoke test with Playwright, and verify the client and server build outputs.

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

During a match, the active player chooses one of 8 facing directions before firing. The function is evaluated in shooter-local coordinates, so local `+x` points in the selected facing direction and local `+y` rotates with it. Use the direction dial buttons or scroll the mouse wheel over the dial to rotate aim. The server simulates the rotated path authoritatively, then clients render the returned path with color attenuation as the length budget is consumed. The visible function path clears when the next turn starts.

To run the built server artifact instead of the watch-mode dev server:

```bash
npm --workspace apps/server run build
npm --workspace apps/server run start
```

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
- Current: added the client-side local session boundary, future Discord session placeholder, schema-validated WebSocket client, Zustand store actions for room commands/events, a usable multi-tab lobby/match control surface, Canvas 2D world rendering with shot path/impact playback, a normal-function shot input palette, 8-way rotated local aim directions, minimal in-turn HUD, shot path attenuation and turn-start clearing, and a Playwright two-client smoke test for `alice`/`bob` local testing.
