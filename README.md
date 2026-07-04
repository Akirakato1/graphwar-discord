# Graphwar Discord Activity

Local-first prototype for a Graphwar-inspired Discord Activity. The first milestone is a browser-based multi-tab game that connects to a local authoritative server, while keeping the client/server boundary ready for Discord's Embedded App SDK later.

## Current Status

- Design spec: `docs/superpowers/specs/2026-07-04-graphwar-discord-activity-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-04-graphwar-discord-activity-prototype.md`
- Source mechanics notes: `graphwar_cheat_sheet.md`
- Active branch: `feature/graphwar-prototype`
- Remote branch: `origin/feature/graphwar-prototype`
- Current checkpoint: server-side normal-function parsing, authoritative shot simulation with collision resolution, destructible terrain with circular crater explosions, match modes, deterministic map generators, and an authoritative match controller.
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

- `apps/client`: Vite + React shell for the browser activity prototype.
- `apps/server`: Fastify server with a `/health` route on port `8787`, normal-function parsing/sampling helpers for shot trajectories, authoritative shot simulation and collision resolution, server-side destructible terrain crater logic, match mode rules, deterministic map generators, and a match controller for lobby joins, match starts, shot submissions, turn advancement, and victory resolution.
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
npm test -- packages/shared/src/protocol/schemas.test.ts
npm test -- packages/shared/src/geometry
npm run check
npm test
npm --workspace apps/server run build
```

The current checks compile the project references, validate normal-function parsing/sampling, authoritative shot simulation and collision resolution, terrain crater removal, match mode rules, deterministic map generators, match controller orchestration, shared protocol schemas, and geometry helpers with Vitest, run the full Vitest suite, and verify the server build output used by `npm --workspace apps/server start`.

## Local Development Target

The first playable loop will run with one server and multiple mock browser clients:

```txt
http://localhost:5173/?room=local-test&mockPlayer=alice
http://localhost:5173/?room=local-test&mockPlayer=bob
http://localhost:5173/?room=local-test&mockPlayer=charlie
```

## Implementation Checkpoints

Every major implementation task should:

1. Update this README when the user-facing state changes.
2. Run the relevant verification commands.
3. Commit the checkpoint.
4. Push the branch with SSH.

## Checkpoint Log

- `74c6e70`: Added initial README and tracked Graphwar mechanics notes.
- Scaffolded the TypeScript workspace with client, server, and shared packages.
- `3c28af9`: Defined shared game constants, domain types, validation settings, and protocol schemas.
- Added shared coordinate and polygon helpers with validated circle polygon inputs and targeted geometry coverage.
- Current: added an authoritative match controller for lobby snapshots, match starts, shot rejection/resolution, turn advancement, and victory ending events.
